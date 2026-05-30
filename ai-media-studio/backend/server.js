const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'ai_media_studio_secret_2026';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// ─── 配置文件加载 ───────────────────────────────────────────────────────────
const CONFIG_PATH = path.join(__dirname, 'config.json');
let appConfig = { providers: [], models: [] };
let PRICING = {};  // 从 config.models 派生，{ id: { type, cost, price, label, perSec } }

// 安全写配置（先写 .tmp 再 rename，防止写入损坏）
function saveConfig() {
  const tmp = CONFIG_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(appConfig, null, 2), 'utf8');
  fs.renameSync(tmp, CONFIG_PATH);
}

// 加载配置
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      appConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('配置文件加载失败，使用默认配置:', e.message);
  }
  rebuildPricing();
}

// 从 models 数组重建 PRICING 字典
function rebuildPricing() {
  PRICING = {};
  for (const m of appConfig.models) {
    PRICING[m.id] = {
      type: m.type,
      subtype: m.subtype,
      providerId: m.providerId,
      cost: m.cost,
      price: m.price,
      label: m.label,
      description: m.description,
      perSec: m.perSec,
      enabled: m.enabled,
      params: m.params || {}
    };
  }
}

// 获取启用的 provider
function getEnabledProvider(providerId) {
  return appConfig.providers.find(p => p.id === providerId && p.enabled);
}

// 获取启用的模型
function getEnabledModels() {
  return appConfig.models.filter(m => m.enabled);
}

// ─── 启动时加载配置 ───────────────────────────────────────────────────────
loadConfig();

// ─── Express 中间件 ───────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../frontend/public')));

const upload = multer({
  dest: path.join(__dirname, '../uploads/tmp'),
  limits: { fileSize: 20 * 1024 * 1024 }
});

// ─── 内存数据库 ─────────────────────────────────────────────────────────────
const users = [];
const tasks = [];
const gallery = [];
let taskIdCounter = 1;
let galleryIdCounter = 1;

// ─── 工具函数 ──────────────────────────────────────────────────────────────
function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: '未登录' });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token无效或已过期' });
  }
}

function findUser(id) {
  return users.find(u => u.id === id);
}

function calcCost(planKey, durationSec) {
  const p = PRICING[planKey];
  if (!p) return 0;
  if (p.perSec && durationSec) return p.price * durationSec;
  return p.price;
}

function deductBalance(user, yuan) {
  user.balance = parseFloat((user.balance - yuan).toFixed(2));
  if (user.balance < 0) user.balance = 0;
}

function saveToGallery(userId, task) {
  if (!task.result || !task.result.length) return;
  task.galleryId = (galleryIdCounter++).toString();
  const item = {
    id: task.galleryId,
    userId,
    type: task.type,
    planLabel: task.planLabel,
    prompt: task.prompt,
    result: task.result,
    costYuan: task.costYuan,
    createdAt: task.createdAt,
    tags: []
  };
  gallery.push(item);
}

function pubUser(u) {
  return { id: u.id, email: u.email, nickname: u.nickname, balance: u.balance };
}

function pubTask(t) {
  return {
    id: t.id, type: t.type, status: t.status, prompt: t.prompt,
    planLabel: t.planLabel, aspectRatio: t.aspectRatio, duration: t.duration,
    costYuan: t.costYuan,
    result: t.result, error: t.error, galleryId: t.galleryId,
    createdAt: t.createdAt
  };
}

// ─── 百炼 API 轮询（复用）──────────────────────────────────────────────────
const BAILIAN_API_KEY = (() => {
  const p = appConfig.providers.find(p => p.id === 'bailian');
  return p ? p.apiKey : (process.env.BAILIAN_API_KEY || '');
})();

async function pollBailianTask(taskRecord, url, maxWaitSeconds) {
  const interval = 4000;
  const maxAttempts = Math.floor((maxWaitSeconds * 1000) / interval);
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, interval));
    try {
      const resp = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${BAILIAN_API_KEY}` }
      });
      const output = resp.data.output;
      const status = output?.task_status;
      if (status === 'SUCCEEDED') {
        taskRecord.status = 'succeeded';
        if (output.results) {
          taskRecord.result = output.results.map(r => r.url || r.video_url).filter(Boolean);
        } else if (output.video_url) {
          taskRecord.result = [output.video_url];
        } else if (output.result_url) {
          taskRecord.result = [output.result_url];
        }
        return;
      } else if (status === 'FAILED') {
        taskRecord.status = 'failed';
        taskRecord.error = output.message || '生成失败';
        return;
      }
    } catch {}
  }
  taskRecord.status = 'failed';
  taskRecord.error = '生成超时，请重试';
}

// ─── 用户注册/登录 ─────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { email, password, nickname } = req.body;
  if (!email || !password) return res.status(400).json({ error: '邮箱和密码不能为空' });
  if (users.find(u => u.email === email)) return res.status(400).json({ error: '该邮箱已注册' });
  const hash = await bcrypt.hash(password, 10);
  const user = {
    id: Date.now().toString(),
    email,
    password: hash,
    nickname: nickname || email.split('@')[0],
    createdAt: new Date().toISOString()
  };
  users.push(user);
  const token = generateToken(user);
  res.json({ token, user: pubUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(400).json({ error: '用户不存在' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ error: '密码错误' });
  const token = generateToken(user);
  res.json({ token, user: pubUser(user) });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = findUser(req.user.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json(pubUser(user));
});

// ─── 模型选项（公开 - 前台用）──────────────────────────────────────────────
app.get('/api/models', (req, res) => {
  // 返回启用的模型，给前台动态渲染用
  res.json(getEnabledModels());
});

// ─── 余额充值 ──────────────────────────────────────────────────────────────
app.post('/api/balance/recharge', authMiddleware, (req, res) => {
  const { amount } = req.body;
  const user = findUser(req.user.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  const n = parseFloat(amount);
  if (isNaN(n) || n <= 0) return res.status(400).json({ error: '充值金额无效' });
  user.balance = parseFloat((user.balance + n).toFixed(2));
  res.json({ balance: user.balance, message: `充值成功${n}元，当前余额${user.balance}元` });
});

// ─── 文生图 ───────────────────────────────────────────────────────────────
app.post('/api/generate/text-to-image', authMiddleware, async (req, res) => {
  const user = findUser(req.user.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const { prompt, planKey = 'wan2.7-image', aspectRatio = '1:1', n = 1 } = req.body;
  if (!prompt) return res.status(400).json({ error: '提示词不能为空' });
  const plan = PRICING[planKey];
  if (!plan || plan.type !== 'image') return res.status(400).json({ error: '无效的画图方案' });
  if (!plan.enabled) return res.status(400).json({ error: '该模型已下架' });

  const totalYuan = parseFloat((plan.price * parseInt(n)).toFixed(2));
  if (user.balance < totalYuan) {
    return res.status(402).json({ error: `余额不足，该操作需要 ${totalYuan} 元，当前余额 ${user.balance.toFixed(2)} 元` });
  }

  const sizeMap = {
    '1:1': '1024*1024', '9:16': '864*1536', '16:9': '1536*864',
    '3:4': '896*1152', '4:3': '1152*896', '2:3': '832*1216', '3:2': '1216*832'
  };
  const sizeStr = sizeMap[aspectRatio] || '1024*1024';

  const task = {
    id: (taskIdCounter++).toString(),
    userId: user.id,
    type: 'text-to-image',
    planKey, planLabel: plan.label,
    status: 'pending', prompt, aspectRatio, sizeStr, n: parseInt(n),
    costYuan: totalYuan,
    createdAt: new Date().toISOString(), result: null, error: null, galleryId: null
  };
  tasks.push(task);

  (async () => {
    try {
      task.status = 'running';
      const provider = getEnabledProvider(plan.providerId || 'bailian');
      const apiKey = provider ? provider.apiKey : BAILIAN_API_KEY;
      const resp = await axios.post(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
        { model: planKey, input: { prompt }, parameters: { size: sizeStr, n: parseInt(n), style: '<auto>' } },
        { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-DashScope-Async': 'enable' } }
      );
      const taskId = resp.data.output?.task_id;
      if (!taskId) throw new Error('未获取到task_id');
      task.bailianTaskId = taskId;
      await pollBailianTask(task, 'https://dashscope.aliyuncs.com/api/v1/tasks/' + taskId, 60);
      if (task.status === 'succeeded') {
        deductBalance(user, task.costYuan);
        saveToGallery(user.id, task);
      }
    } catch (e) {
      task.status = 'failed';
      task.error = e.response?.data?.message || e.message;
    }
  })();

  res.json({ taskId: task.id, status: 'pending', costYuan: totalYuan });
});

// ─── 文生视频 ─────────────────────────────────────────────────────────────
app.post('/api/generate/text-to-video', authMiddleware, async (req, res) => {
  const user = findUser(req.user.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const { prompt, planKey = 'wan2.7-t2v-720', duration = 5, ratio = '16:9' } = req.body;
  if (!prompt) return res.status(400).json({ error: '提示词不能为空' });
  const plan = PRICING[planKey];
  if (!plan || plan.type !== 'video') return res.status(400).json({ error: '无效的视频方案' });
  if (!plan.enabled) return res.status(400).json({ error: '该模型已下架' });

  const dur = parseInt(duration);
  const costYuan = parseFloat((plan.price * dur).toFixed(2));
  if (user.balance < costYuan) {
    return res.status(402).json({ error: `余额不足，该操作需要 ${costYuan} 元，当前余额 ${user.balance.toFixed(2)} 元` });
  }

  const task = {
    id: (taskIdCounter++).toString(),
    userId: user.id,
    type: 'text-to-video',
    planKey, planLabel: plan.label, duration: dur,
    status: 'pending', prompt,
    costYuan,
    createdAt: new Date().toISOString(), result: null, error: null, galleryId: null
  };
  tasks.push(task);

  (async () => {
    try {
      task.status = 'running';
      const resolution = plan.params?.resolution || (planKey.includes('1080') ? '1080P' : '720P');
      const provider = getEnabledProvider(plan.providerId || 'bailian');
      const apiKey = provider ? provider.apiKey : BAILIAN_API_KEY;
      const modelName = plan.params?.modelName || 'wan2.7-t2v-2026-04-25';
      const resp = await axios.post(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
        {
          model: modelName,
          input: { prompt: prompt || undefined },
          parameters: { duration: dur, resolution, ratio }
        },
        { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-DashScope-Async': 'enable' } }
      );
      const taskId = resp.data.output?.task_id;
      if (!taskId) throw new Error('未获取到task_id');
      task.bailianTaskId = taskId;
      await pollBailianTask(task, 'https://dashscope.aliyuncs.com/api/v1/tasks/' + taskId, 180);
      if (task.status === 'succeeded') {
        deductBalance(user, task.costYuan);
        saveToGallery(user.id, task);
      }
    } catch (e) {
      task.status = 'failed';
      task.error = e.response?.data?.message || e.message;
    }
  })();

  res.json({ taskId: task.id, status: 'pending', costYuan });
});

// ─── 图生视频 ─────────────────────────────────────────────────────────────
app.post('/api/generate/image-to-video', authMiddleware, upload.single('image'), async (req, res) => {
  const user = findUser(req.user.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (!req.file) return res.status(400).json({ error: '请上传图片' });

  const { prompt = '', planKey = 'wan2.7-i2v-720', duration = 5 } = req.body;
  const plan = PRICING[planKey];
  if (!plan || plan.type !== 'video') return res.status(400).json({ error: '无效的视频方案' });
  if (!plan.enabled) return res.status(400).json({ error: '该模型已下架' });

  const dur = parseInt(duration);
  const costYuan = parseFloat((plan.price * dur).toFixed(2));
  if (user.balance < costYuan) {
    return res.status(402).json({ error: `余额不足，该操作需要 ${costYuan} 元，当前余额 ${user.balance.toFixed(2)} 元` });
  }

  const task = {
    id: (taskIdCounter++).toString(),
    userId: user.id,
    type: 'image-to-video',
    planKey, planLabel: plan.label, duration: dur,
    status: 'pending', prompt,
    costYuan,
    createdAt: new Date().toISOString(), result: null, error: null, galleryId: null,
    tmpFile: req.file.path
  };
  tasks.push(task);

  (async () => {
    try {
      task.status = 'running';
      const imgData = fs.readFileSync(req.file.path);
      const imgBase64 = imgData.toString('base64');
      const provider = getEnabledProvider(plan.providerId || 'bailian');
      const apiKey = provider ? provider.apiKey : BAILIAN_API_KEY;
      const series = plan.params?.series;

      if (series === 'happyhorse') {
        // HappyHorse 专用接口：直接返回结果，无需轮询
        const resolution = plan.params?.resolution || (planKey.includes('1080') ? '1080p' : '720p');
        const resp = await axios.post(
          `${provider?.baseUrl || 'https://dashscope.aliyuncs.com/api/v1'}/services/aigc/video-generation/video-synthesis`,
          {
            model: plan.params?.modelName || 'happyhorse-1.0-i2v',
            input: {
              prompt: prompt || undefined,
              media: [{ type: 'first_frame', url: `data:image/jpeg;base64,${imgBase64}` }]
            },
            parameters: { duration: dur, resolution }
          },
          { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-DashScope-Async': 'enable' } }
        );
        fs.unlinkSync(req.file.path);
        const taskId = resp.data.output?.task_id;
        if (!taskId) throw new Error('未获取到 task_id');
        task.bailianTaskId = taskId;
        await pollBailianTask(task, 'https://dashscope.aliyuncs.com/api/v1/tasks/' + taskId, 300);
        if (task.status === 'succeeded') {
          deductBalance(user, task.costYuan);
          saveToGallery(user.id, task);
        }
      } else {
        // wan2.7 原生接口
        const resolution = plan.params?.resolution || (planKey.includes('1080') ? '1080P' : '720P');
        const modelName = plan.params?.modelName || 'wan2.7-i2v-2026-04-25';
        const resp = await axios.post(
          'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
          {
            model: modelName,
            input: {
              prompt: prompt || undefined,
              media: [{ type: 'first_frame', url: `data:image/jpeg;base64,${imgBase64}` }]
            },
            parameters: { duration: dur, resolution }
          },
          { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-DashScope-Async': 'enable' } }
        );
        fs.unlinkSync(req.file.path);
        const taskId = resp.data.output?.task_id;
        if (!taskId) throw new Error('未获取到task_id');
        task.bailianTaskId = taskId;
        await pollBailianTask(task, 'https://dashscope.aliyuncs.com/api/v1/tasks/' + taskId, 180);
        if (task.status === 'succeeded') {
          deductBalance(user, task.costYuan);
          saveToGallery(user.id, task);
        }
      }
    } catch (e) {
      task.status = 'failed';
      task.error = e.response?.data?.message || e.message;
      try { fs.unlinkSync(req.file.path); } catch {}
    }
  })();

  res.json({ taskId: task.id, status: 'pending', costYuan });
});

// ─── 任务状态 ─────────────────────────────────────────────────────────────
app.get('/api/task/:taskId', authMiddleware, (req, res) => {
  const task = tasks.find(t => t.id === req.params.taskId && t.userId === req.user.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  res.json(pubTask(task));
});

// ─── 历史记录 ─────────────────────────────────────────────────────────────
app.get('/api/tasks', authMiddleware, (req, res) => {
  const userTasks = tasks
    .filter(t => t.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 100)
    .map(pubTask);
  res.json(userTasks);
});

// ─── 作品库 ───────────────────────────────────────────────────────────────
app.get('/api/gallery', authMiddleware, (req, res) => {
  const items = gallery
    .filter(g => g.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(items);
});

app.put('/api/gallery/:id', authMiddleware, (req, res) => {
  const item = gallery.find(g => g.id === req.params.id && g.userId === req.user.id);
  if (!item) return res.status(404).json({ error: '作品不存在' });
  const { title, tags } = req.body;
  if (title !== undefined) item.title = title;
  if (tags !== undefined) item.tags = tags;
  res.json(item);
});

app.delete('/api/gallery/:id', authMiddleware, (req, res) => {
  const idx = gallery.findIndex(g => g.id === req.params.id && g.userId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: '作品不存在' });
  gallery.splice(idx, 1);
  res.json({ ok: true });
});

// ─── 管理后台认证 ─────────────────────────────────────────────────────────
function adminAuth(req, res, next) {
  const pwd = req.headers['x-admin-password'];
  if (pwd !== ADMIN_PASSWORD) return res.status(403).json({ error: '管理密码错误' });
  next();
}

// ─── 管理后台 API：统计/用户/任务/作品库 ─────────────────────────────────
app.get('/api/admin/stats', adminAuth, (req, res) => {
  const totalUsers = users.length;
  const totalTasks = tasks.length;
  const totalGallery = gallery.length;
  const totalRevenue = tasks.filter(t => t.status === 'succeeded').reduce((s, t) => s + (t.costYuan || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayTasks = tasks.filter(t => t.createdAt && t.createdAt.startsWith(today)).length;
  const todayRevenue = tasks.filter(t => t.status === 'succeeded' && t.createdAt && t.createdAt.startsWith(today)).reduce((s, t) => s + (t.costYuan || 0), 0);
  res.json({ totalUsers, totalTasks, totalGallery, totalRevenue: parseFloat(totalRevenue.toFixed(2)), todayTasks, todayRevenue: parseFloat(todayRevenue.toFixed(2)) });
});

app.get('/api/admin/users', adminAuth, (req, res) => {
  res.json(users.map(u => ({
    id: u.id, email: u.email, nickname: u.nickname,
    balance: u.balance,
    createdAt: u.createdAt,
    taskCount: tasks.filter(t => t.userId === u.id).length
  })));
});

app.get('/api/admin/tasks', adminAuth, (req, res) => {
  const all = tasks
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(t => {
      const u = users.find(x => x.id === t.userId);
      return { ...pubTask(t), userEmail: u ? u.email : t.userId };
    });
  res.json(all);
});

app.get('/api/admin/gallery', adminAuth, (req, res) => {
  const all = gallery
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(g => {
      const u = users.find(x => x.id === g.userId);
      return { ...g, userEmail: u ? u.email : g.userId };
    });
  res.json(all);
});

app.delete('/api/admin/gallery/:id', adminAuth, (req, res) => {
  const idx = gallery.findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '作品不存在' });
  gallery.splice(idx, 1);
  res.json({ ok: true });
});

app.delete('/api/admin/task/:id', adminAuth, (req, res) => {
  const idx = tasks.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '任务不存在' });
  tasks.splice(idx, 1);
  res.json({ ok: true });
});

// ─── 管理后台 API：统计分析 ───────────────────────────────────────────────
app.get('/api/admin/analytics', adminAuth, (req, res) => {
  const succeeded = tasks.filter(t => t.status === 'succeeded');

  // 1. 各模型使用占比（按 planLabel 分组）
  const modelCountMap = {};
  const modelRevenueMap = {};
  for (const t of succeeded) {
    const key = t.planLabel || '未知';
    modelCountMap[key] = (modelCountMap[key] || 0) + 1;
    modelRevenueMap[key] = parseFloat(((modelRevenueMap[key] || 0) + (t.costYuan || 0)).toFixed(2));
  }
  const modelStats = Object.entries(modelCountMap)
    .map(([name, count]) => ({ name, count, revenue: modelRevenueMap[name] || 0 }))
    .sort((a, b) => b.count - a.count);

  // 2. 最近 12 个月：每月任务量 + 收入（所有任务，含失败的仅计数）
  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const monthTaskMap = {};
  const monthRevenueMap = {};
  for (const m of months) {
    monthTaskMap[m] = 0;
    monthRevenueMap[m] = 0;
  }
  for (const t of tasks) {
    if (!t.createdAt) continue;
    const ym = t.createdAt.slice(0, 7);
    if (monthTaskMap[ym] !== undefined) {
      monthTaskMap[ym]++;
    }
    if (t.status === 'succeeded' && monthRevenueMap[ym] !== undefined) {
      monthRevenueMap[ym] = parseFloat((monthRevenueMap[ym] + (t.costYuan || 0)).toFixed(2));
    }
  }
  const monthStats = months.map(m => ({
    month: m,
    tasks: monthTaskMap[m],
    revenue: monthRevenueMap[m]
  }));

  res.json({ modelStats, monthStats });
});

// ─── 管理后台 API：配置管理 ───────────────────────────────────────────────

// 获取完整配置（不含 API Key 明文）
app.get('/api/admin/config', adminAuth, (req, res) => {
  const safeProviders = appConfig.providers.map(p => ({
    ...p,
    apiKey: p.apiKey ? p.apiKey.slice(0, 4) + '****' + p.apiKey.slice(-4) : ''
  }));
  res.json({ providers: safeProviders, models: appConfig.models });
});

// 新增/更新服务商
app.post('/api/admin/providers', adminAuth, (req, res) => {
  const { id, name, baseUrl, apiKey, enabled } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id 和名称不能为空' });
  const idx = appConfig.providers.findIndex(p => p.id === id);
  if (idx >= 0) {
    // 更新（apiKey 传空表示不修改）
    if (apiKey) appConfig.providers[idx].apiKey = apiKey;
    if (name) appConfig.providers[idx].name = name;
    if (baseUrl) appConfig.providers[idx].baseUrl = baseUrl;
    if (enabled !== undefined) appConfig.providers[idx].enabled = enabled;
  } else {
    appConfig.providers.push({ id, name, baseUrl: baseUrl || '', apiKey: apiKey || '', enabled: enabled !== false });
  }
  saveConfig();
  rebuildPricing();
  res.json({ ok: true });
});

app.delete('/api/admin/providers/:id', adminAuth, (req, res) => {
  const idx = appConfig.providers.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '服务商不存在' });
  appConfig.providers.splice(idx, 1);
  saveConfig();
  rebuildPricing();
  res.json({ ok: true });
});

// 新增模型
app.post('/api/admin/models', adminAuth, (req, res) => {
  const { id, providerId, type, subtype, label, description, cost, price, perSec, enabled, params } = req.body;
  if (!id || !type || !subtype) return res.status(400).json({ error: 'id、type、subtype 不能为空' });
  if (appConfig.models.find(m => m.id === id)) return res.status(400).json({ error: '模型 ID 已存在' });
  appConfig.models.push({
    id, providerId: providerId || 'bailian', type, subtype,
    label: label || id, description: description || '',
    cost: parseFloat(cost) || 0, price: parseFloat(price) || 0,
    perSec: !!perSec, enabled: enabled !== false, params: params || {}
  });
  saveConfig();
  rebuildPricing();
  res.json({ ok: true });
});

// 更新模型
app.put('/api/admin/models/:id', adminAuth, (req, res) => {
  const model = appConfig.models.find(m => m.id === req.params.id);
  if (!model) return res.status(404).json({ error: '模型不存在' });
  const { providerId, type, subtype, label, description, cost, price, perSec, enabled, params } = req.body;
  if (providerId !== undefined) model.providerId = providerId;
  if (type !== undefined) model.type = type;
  if (subtype !== undefined) model.subtype = subtype;
  if (label !== undefined) model.label = label;
  if (description !== undefined) model.description = description;
  if (cost !== undefined) model.cost = parseFloat(cost);
  if (price !== undefined) model.price = parseFloat(price);
  if (perSec !== undefined) model.perSec = !!perSec;
  if (enabled !== undefined) model.enabled = !!enabled;
  if (params !== undefined) model.params = params;
  saveConfig();
  rebuildPricing();
  res.json({ ok: true });
});

// 删除模型
app.delete('/api/admin/models/:id', adminAuth, (req, res) => {
  const idx = appConfig.models.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '模型不存在' });
  appConfig.models.splice(idx, 1);
  saveConfig();
  rebuildPricing();
  res.json({ ok: true });
});

// ─── 健康检查 ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  time: new Date().toISOString(),
  models: getEnabledModels().length,
  providers: appConfig.providers.length
}));

// ─── 前端路由兜底 ─────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI Media Studio running on http://0.0.0.0:${PORT}`);
  console.log(`已加载 ${appConfig.models.length} 个模型，${appConfig.providers.length} 个服务商`);
});
