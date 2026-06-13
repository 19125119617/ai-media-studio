const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const db = require('./db');  // SQLite 数据库

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'ai_media_studio_secret_2026';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// ─── 配置文件加载 ─────────────────────────────────────────────────────────
const CONFIG_PATH = path.join(__dirname, 'config.json');
let appConfig = { providers: [], models: [] };
let PRICING = {};

function saveConfig() {
  const tmp = CONFIG_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(appConfig, null, 2), 'utf8');
  fs.renameSync(tmp, CONFIG_PATH);
}

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

function rebuildPricing() {
  PRICING = {};
  for (const m of appConfig.models) {
    PRICING[m.id] = {
      type: m.type, subtype: m.subtype, providerId: m.providerId,
      cost: m.cost, price: m.price, label: m.label,
      description: m.description, perSec: m.perSec,
      enabled: m.enabled, params: m.params || {}
    };
  }
}

function getEnabledProvider(providerId) {
  return appConfig.providers.find(p => p.id === providerId && p.enabled);
}

function getEnabledModels() {
  if (!appConfig || !appConfig.models) return [];
  return appConfig.models.filter(m => m.enabled);
}

loadConfig();

// ─── 首页配置 ────────────────────────────────────────────────────────────────
const SETTINGS_PATH = path.join(__dirname, 'settings.json');
let HOMEPAGE_CONFIG = {};

function loadHomepageConfig() {
  const defaults = {
    badge: '统一 API · 按量计费 · 多模态',
    titleLine1: '统一的大模型',
    titleLine2: 'API 接口网关',
    subtitle: '一个接口 · 接入所有主流 AI 大模型',
    apiUrl: 'http://101.200.84.23:3001',
    stats: [
      { label: '可用模型', value: '{{models}}' },
      { label: '服务商', value: '{{providers}}' },
      { label: '服务可用率', value: '99.9%' },
      { label: '平均延迟', value: '<200ms' }
    ],
    popularModels: [
      { name: 'GPT-4o', color: '#10a37f' },
      { name: 'GPT-4.1', color: '#10a37f' },
      { name: 'Claude 3.5', color: '#d4a574' },
      { name: 'Gemini Pro', color: '#4285f4' },
      { name: 'DeepSeek V3', color: '#4f6ef7' },
      { name: 'Qwen-Max', color: '#8b5cf6' },
      { name: 'Llama 3', color: '#0668E1' },
      { name: 'ERNIE 4.0', color: '#2932e1' },
      { name: 'Wan2.7', color: '#8b5cf6' },
      { name: 'HappyHorse', color: '#f59e0b' },
      { name: 'GLM-4', color: '#4338ca' },
      { name: 'Kimi', color: '#c4b5fd' }
    ]
  };
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
      HOMEPAGE_CONFIG = data.homepage || {};
    }
  } catch (e) {
    console.error('首页配置加载失败，使用默认:', e.message);
  }
  // 合并默认值
  for (const key of Object.keys(defaults)) {
    if (HOMEPAGE_CONFIG[key] === undefined) HOMEPAGE_CONFIG[key] = defaults[key];
  }
}

function saveHomepageConfig() {
  try {
    let data = {};
    if (fs.existsSync(SETTINGS_PATH)) {
      data = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    }
    data.homepage = HOMEPAGE_CONFIG;
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('首页配置保存失败:', e.message);
    return false;
  }
}

function resolveHomepageConfig() {
  const config = JSON.parse(JSON.stringify(HOMEPAGE_CONFIG));
  if (config.stats) {
    config.stats = config.stats.map(s => {
      let val = s.value;
      if (val === '{{models}}') val = String(getEnabledModels().length);
      if (val === '{{providers}}') val = String(appConfig.providers.length);
      return { ...s, value: val };
    });
  }
  return config;
}

loadHomepageConfig();

// ─── Express 中间件 ─────────────────────────────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Password']
}));
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../frontend/dist')));

const upload = multer({
  dest: path.join(__dirname, '../uploads/tmp'),
  limits: { fileSize: 20 * 1024 * 1024 }
});

// ─── SQLite 封装 ────────────────────────────────────────────────────────────
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) { err ? reject(err) : resolve(this); });
  });
}

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

function pubUser(u) {
  return { id: u.id, email: u.email, nickname: u.nickname, balance: u.balance };
}

function pubTask(t) {
  return {
    id: t.id, type: t.type, status: t.status, prompt: t.prompt,
    planLabel: t.planLabel, aspectRatio: t.aspectRatio, duration: t.duration,
    costYuan: t.costYuan,
    result: t.result ? JSON.parse(t.result) : null,
    error: t.error, galleryId: t.galleryId,
    createdAt: t.createdAt
  };
}

function pubGallery(g) {
  return {
    id: g.id, userId: g.userId, type: g.type, planLabel: g.planLabel,
    prompt: g.prompt,
    result: g.result ? JSON.parse(g.result) : [],
    costYuan: g.costYuan, createdAt: g.createdAt,
    tags: g.tags ? JSON.parse(g.tags) : []
  };
}

function calcCost(planKey, durationSec) {
  const p = PRICING[planKey];
  if (!p) return 0;
  if (p.perSec && durationSec) return p.price * durationSec;
  return p.price;
}

// ─── 百炼 API 轮询 ────────────────────────────────────────────────────────
const BAILIAN_API_KEY = (() => {
  const p = appConfig.providers.find(p => p.id === 'bailian');
  return p ? p.apiKey : (process.env.BAILIAN_API_KEY || '');
})();

async function pollBailianTask(taskId, url, maxWaitSeconds) {
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
        await dbRun(`UPDATE tasks SET status='succeeded', result=? WHERE id=?`, [
          JSON.stringify(output.results ? output.results.map(r => r.url || r.video_url).filter(Boolean) : (output.video_url ? [output.video_url] : (output.result_url ? [output.result_url] : []))),
          taskId
        ]);
        return 'succeeded';
      } else if (status === 'FAILED') {
        await dbRun(`UPDATE tasks SET status='failed', error=? WHERE id=?`, [output.message || '生成失败', taskId]);
        return 'failed';
      }
    } catch (e) {
      // 忽略轮询中的网络错误，继续轮询
    }
  }
  await dbRun(`UPDATE tasks SET status='failed', error='生成超时，请重试' WHERE id=?`, [taskId]);
  return 'failed';
}

// ─── 用户注册/登录 ─────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { email, password, nickname } = req.body;
  if (!email || !password) return res.status(400).json({ error: '邮箱和密码不能为空' });
  const existing = await dbGet(`SELECT id FROM users WHERE email=?`, [email]);
  if (existing) return res.status(400).json({ error: '该邮箱已注册' });
  const hash = await bcrypt.hash(password, 10);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const nick = nickname || email.split('@')[0];
  await dbRun(
    `INSERT INTO users (id, email, password, nickname, balance, createdAt) VALUES (?,?,?,?,?,?)`,
    [id, email, hash, nick, 0, createdAt]
  );
  const user = { id, email, nickname: nick, balance: 0 };
  const token = generateToken(user);
  res.json({ token, user });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await dbGet(`SELECT * FROM users WHERE email=?`, [email]);
  if (!user) return res.status(400).json({ error: '用户不存在' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ error: '密码错误' });
  const token = generateToken(user);
  res.json({ token, user: pubUser(user) });
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = await dbGet(`SELECT * FROM users WHERE id=?`, [req.user.id]);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json(pubUser(user));
});

// ─── 模型选项 ────────────────────────────────────────────────────────────────
app.get('/api/models', (req, res) => {
  res.json(getEnabledModels());
});

// ─── 模型定价（公开） ──────────────────────────────────────────────────────────
app.get('/api/models/pricing', (req, res) => {
  const models = (appConfig.models || []).map(m => ({
    id: m.id,
    label: m.label || m.id,
    type: m.type,
    subtype: m.subtype || null,
    provider: m.providerId || 'system',
    description: m.description || '',
    price: m.price || 0,
    perSec: m.perSec || false,
    enabled: m.enabled !== false
  }));
  const providers = (appConfig.providers || []).map(p => ({
    id: p.id,
    name: p.name,
    enabled: p.enabled !== false
  }));
  res.json({ models, providers });
});


// ─── 余额充值 ────────────────────────────────────────────────────────────────
// 充值接口 - 需要管理员认证
app.post('/api/balance/recharge', authMiddleware, adminAuth, async (req, res) => {
  const { amount, userId: targetUserId } = req.body;
  const n = parseFloat(amount);
  if (isNaN(n) || n <= 0) return res.status(400).json({ error: '充值金额无效' });
  if (n > 10000) return res.status(400).json({ error: '单次充值不能超过10000元' });
  const uid = targetUserId || req.user.id;
  const user = await dbGet(`SELECT * FROM users WHERE id=?`, [uid]);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  const balanceBefore = user.balance;
  const balanceAfter = parseFloat((user.balance + n).toFixed(2));
  await dbRun(`UPDATE users SET balance=? WHERE id=?`, [balanceAfter, user.id]);
  await dbRun(
    `INSERT INTO recharge_records (userId, amount, balanceBefore, balanceAfter, method, status, createdAt) VALUES (?,?,?,?,?,?,?)`,
    [user.id, n, balanceBefore, balanceAfter, 'admin_manual', 'success', new Date().toISOString()]
  );
  res.json({ balance: balanceAfter, message: `充值成功${n}元，当前余额${balanceAfter}元` });
});

// ─── 文生图 ────────────────────────────────────────────────────────────────
app.post('/api/generate/text-to-image', authMiddleware, async (req, res) => {
  const user = await dbGet(`SELECT * FROM users WHERE id=?`, [req.user.id]);
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
  const taskId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await dbRun(
    `INSERT INTO tasks (id, userId, type, planKey, planLabel, status, prompt, aspectRatio, duration, costYuan, createdAt, result, error, galleryId)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,NULL)`,
    [taskId, user.id, 'text-to-image', planKey, plan.label, 'pending', prompt, aspectRatio, n, totalYuan, createdAt]
  );

  // 异步调用百炼 API
  (async () => {
    try {
      await dbRun(`UPDATE tasks SET status='running' WHERE id=?`, [taskId]);
      const provider = getEnabledProvider(plan.providerId || 'bailian');
      const apiKey = provider ? provider.apiKey : BAILIAN_API_KEY;
      const resp = await axios.post(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
        { model: planKey, input: { prompt }, parameters: { size: sizeStr, n: parseInt(n), style: '<auto>' } },
        { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-DashScope-Async': 'enable' } }
      );
      const bailianTaskId = resp.data.output?.task_id;
      if (!bailianTaskId) throw new Error('未获取到task_id');
      await dbRun(`UPDATE tasks SET bailianTaskId=? WHERE id=?`, [bailianTaskId, taskId]);
      const finalStatus = await pollBailianTask(taskId, 'https://dashscope.aliyuncs.com/api/v1/tasks/' + bailianTaskId, 60);
      if (finalStatus === 'succeeded') {
        const deducted = await dbRun(`UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?`, [totalYuan, user.id, totalYuan]);
        if (deducted.changes === 0) {
          await dbRun(`UPDATE tasks SET status='failed', error='扣费失败：余额不足' WHERE id=?`, [taskId]);
          return;
        }
        // 保存到作品库
        const task = await dbGet(`SELECT * FROM tasks WHERE id=?`, [taskId]);
        if (task.result) {
          const galleryId = Date.now().toString();
          await dbRun(
            `INSERT INTO gallery (id, userId, type, planLabel, prompt, result, costYuan, createdAt, tags) VALUES (?,?,?,?,?,?,?,?,?)`,
            [galleryId, user.id, task.type, task.planLabel, task.prompt, task.result, task.costYuan, task.createdAt, '[]']
          );
          await dbRun(`UPDATE tasks SET galleryId=? WHERE id=?`, [galleryId, taskId]);
        }
      }
    } catch (e) {
      await dbRun(`UPDATE tasks SET status='failed', error=? WHERE id=?`, [e.response?.data?.message || e.message, taskId]);
    }
  })();

  res.json({ taskId, status: 'pending', costYuan: totalYuan });
});

// ─── 文生视频 ────────────────────────────────────────────────────────────────
app.post('/api/generate/text-to-video', authMiddleware, async (req, res) => {
  const user = await dbGet(`SELECT * FROM users WHERE id=?`, [req.user.id]);
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

  const taskId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await dbRun(
    `INSERT INTO tasks (id, userId, type, planKey, planLabel, status, prompt, aspectRatio, duration, costYuan, createdAt, result, error, galleryId)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,NULL)`,
    [taskId, user.id, 'text-to-video', planKey, plan.label, 'pending', prompt, ratio, dur, costYuan, createdAt]
  );

  (async () => {
    try {
      await dbRun(`UPDATE tasks SET status='running' WHERE id=?`, [taskId]);
      const resolution = plan.params?.resolution || (planKey.includes('1080') ? '1080P' : '720P');
      const provider = getEnabledProvider(plan.providerId || 'bailian');
      const apiKey = provider ? provider.apiKey : BAILIAN_API_KEY;
      const modelName = plan.params?.modelName || 'wan2.7-t2v-2026-04-25';
      const resp = await axios.post(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
        { model: modelName, input: { prompt: prompt || undefined }, parameters: { duration: dur, resolution, ratio } },
        { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-DashScope-Async': 'enable' } }
      );
      const bailianTaskId = resp.data.output?.task_id;
      if (!bailianTaskId) throw new Error('未获取到task_id');
      await dbRun(`UPDATE tasks SET bailianTaskId=? WHERE id=?`, [bailianTaskId, taskId]);
      const finalStatus = await pollBailianTask(taskId, 'https://dashscope.aliyuncs.com/api/v1/tasks/' + bailianTaskId, 180);
      if (finalStatus === 'succeeded') {
        const deducted = await dbRun(`UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?`, [costYuan, user.id, costYuan]);
        if (deducted.changes === 0) {
          await dbRun(`UPDATE tasks SET status='failed', error='扣费失败：余额不足' WHERE id=?`, [taskId]);
          return;
        }
        const task = await dbGet(`SELECT * FROM tasks WHERE id=?`, [taskId]);
        if (task.result) {
          const galleryId = Date.now().toString();
          await dbRun(
            `INSERT INTO gallery (id, userId, type, planLabel, prompt, result, costYuan, createdAt, tags) VALUES (?,?,?,?,?,?,?,?,?)`,
            [galleryId, user.id, task.type, task.planLabel, task.prompt, task.result, task.costYuan, task.createdAt, '[]']
          );
          await dbRun(`UPDATE tasks SET galleryId=? WHERE id=?`, [galleryId, taskId]);
        }
      }
    } catch (e) {
      await dbRun(`UPDATE tasks SET status='failed', error=? WHERE id=?`, [e.response?.data?.message || e.message, taskId]);
    }
  })();

  res.json({ taskId, status: 'pending', costYuan });
});

// ─── 图生视频 ────────────────────────────────────────────────────────────────
app.post('/api/generate/image-to-video', authMiddleware, upload.single('image'), async (req, res) => {
  const user = await dbGet(`SELECT * FROM users WHERE id=?`, [req.user.id]);
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

  const taskId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await dbRun(
    `INSERT INTO tasks (id, userId, type, planKey, planLabel, status, prompt, aspectRatio, duration, costYuan, createdAt, result, error, galleryId)
     VALUES (?,?,?,?,?,?,?,NULL,?,?,?,NULL,NULL,NULL)`,
    [taskId, user.id, 'image-to-video', planKey, plan.label, 'pending', prompt, dur, costYuan, createdAt]
  );

  (async () => {
    try {
      await dbRun(`UPDATE tasks SET status='running' WHERE id=?`, [taskId]);
      const imgData = fs.readFileSync(req.file.path);
      const imgBase64 = imgData.toString('base64');
      const provider = getEnabledProvider(plan.providerId || 'bailian');
      const apiKey = provider ? provider.apiKey : BAILIAN_API_KEY;
      const series = plan.params?.series;
      let modelName, resolution, timeout;

      if (series === 'happyhorse') {
        modelName = plan.params?.modelName || 'happyhorse-1.0-i2v';
        resolution = plan.params?.resolution || (planKey.includes('1080') ? '1080p' : '720p');
        timeout = 300;
      } else {
        modelName = plan.params?.modelName || 'wan2.7-i2v-2026-04-25';
        resolution = plan.params?.resolution || (planKey.includes('1080') ? '1080P' : '720P');
        timeout = 180;
      }

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
      const bailianTaskId = resp.data.output?.task_id;
      if (!bailianTaskId) throw new Error('未获取到task_id');
      await dbRun(`UPDATE tasks SET bailianTaskId=? WHERE id=?`, [bailianTaskId, taskId]);
      const finalStatus = await pollBailianTask(taskId, 'https://dashscope.aliyuncs.com/api/v1/tasks/' + bailianTaskId, timeout);
      if (finalStatus === 'succeeded') {
        const deducted = await dbRun(`UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?`, [costYuan, user.id, costYuan]);
        if (deducted.changes === 0) {
          await dbRun(`UPDATE tasks SET status='failed', error='扣费失败：余额不足' WHERE id=?`, [taskId]);
          return;
        }
        const task = await dbGet(`SELECT * FROM tasks WHERE id=?`, [taskId]);
        if (task.result) {
          const galleryId = Date.now().toString();
          await dbRun(
            `INSERT INTO gallery (id, userId, type, planLabel, prompt, result, costYuan, createdAt, tags) VALUES (?,?,?,?,?,?,?,?,?)`,
            [galleryId, user.id, task.type, task.planLabel, task.prompt, task.result, task.costYuan, task.createdAt, '[]']
          );
          await dbRun(`UPDATE tasks SET galleryId=? WHERE id=?`, [galleryId, taskId]);
        }
      }
    } catch (e) {
      await dbRun(`UPDATE tasks SET status='failed', error=? WHERE id=?`, [e.response?.data?.message || e.message, taskId]);
      try { fs.unlinkSync(req.file.path); } catch {}
    }
  })();

  res.json({ taskId, status: 'pending', costYuan });
});

// ─── 任务状态 ────────────────────────────────────────────────────────────────
app.get('/api/task/:taskId', authMiddleware, async (req, res) => {
  const task = await dbGet(`SELECT * FROM tasks WHERE id=? AND userId=?`, [req.params.taskId, req.user.id]);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  res.json(pubTask(task));
});

// ─── 历史记录 ────────────────────────────────────────────────────────────────
app.get('/api/tasks', authMiddleware, async (req, res) => {
  const rows = await dbAll(
    `SELECT * FROM tasks WHERE userId=? ORDER BY createdAt DESC LIMIT 100`,
    [req.user.id]
  );
  res.json(rows.map(pubTask));
});

// ─── 作品库 ────────────────────────────────────────────────────────────────
app.get('/api/gallery', authMiddleware, async (req, res) => {
  const rows = await dbAll(
    `SELECT * FROM gallery WHERE userId=? ORDER BY createdAt DESC`,
    [req.user.id]
  );
  res.json(rows.map(pubGallery));
});

app.put('/api/gallery/:id', authMiddleware, async (req, res) => {
  const { title, tags } = req.body;
  const item = await dbGet(`SELECT * FROM gallery WHERE id=? AND userId=?`, [req.params.id, req.user.id]);
  if (!item) return res.status(404).json({ error: '作品不存在' });
  if (title !== undefined) await dbRun(`UPDATE gallery SET title=? WHERE id=? AND userId=?`, [title, req.params.id, req.user.id]).catch(e => console.error('title update failed:', e.message));
  if (tags !== undefined) await dbRun(`UPDATE gallery SET tags=? WHERE id=? AND userId=?`, [JSON.stringify(tags), req.params.id, req.user.id]);
  const updated = await dbGet(`SELECT * FROM gallery WHERE id=?`, [req.params.id]);
  res.json(pubGallery(updated));
});

app.delete('/api/gallery/:id', authMiddleware, async (req, res) => {
  const result = await dbRun(`DELETE FROM gallery WHERE id=? AND userId=?`, [req.params.id, req.user.id]);
  if (result.changes === 0) return res.status(404).json({ error: '作品不存在' });
  res.json({ ok: true });
});

// ─── 管理后台认证 ────────────────────────────────────────────────────────────
function adminAuth(req, res, next) {
  const pwd = req.headers['x-admin-password'];
  if (pwd !== ADMIN_PASSWORD) return res.status(403).json({ error: '管理密码错误' });
  next();
}

// ─── 管理后台 API ───────────────────────────────────────────────────────────
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  const totalUsers = (await dbGet(`SELECT COUNT(*) as c FROM users`)).c;
  const totalTasks = (await dbGet(`SELECT COUNT(*) as c FROM tasks`)).c;
  const totalGallery = (await dbGet(`SELECT COUNT(*) as c FROM gallery`)).c;
  const totalRevenue = (await dbGet(`SELECT SUM(costYuan) as s FROM tasks WHERE status='succeeded'`)).s || 0;
  const today = new Date().toISOString().slice(0, 10);
  const todayTasks = (await dbGet(`SELECT COUNT(*) as c FROM tasks WHERE createdAt LIKE ?`, [`${today}%`])).c;
  const todayRevenue = (await dbGet(`SELECT SUM(costYuan) as s FROM tasks WHERE status='succeeded' AND createdAt LIKE ?`, [`${today}%`])).s || 0;
  res.json({
    totalUsers, totalTasks, totalGallery,
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    todayTasks, todayRevenue: parseFloat(todayRevenue.toFixed(2))
  });
});

app.get('/api/admin/users', adminAuth, async (req, res) => {
  const users = await dbAll(`SELECT id, email, nickname, balance, createdAt FROM users ORDER BY createdAt DESC`);
  // 补充任务数
  const taskCounts = await dbAll(`SELECT userId, COUNT(*) as c FROM tasks GROUP BY userId`);
  const countMap = {};
  taskCounts.forEach(t => countMap[t.userId] = t.c);
  res.json(users.map(u => ({ ...pubUser(u), taskCount: countMap[u.id] || 0 })));
});

app.get('/api/admin/tasks', adminAuth, async (req, res) => {
  const tasks = await dbAll(
    `SELECT t.*, u.email as userEmail FROM tasks t LEFT JOIN users u ON t.userId=u.id ORDER BY t.createdAt DESC LIMIT 200`
  );
  res.json(tasks.map(t => ({ ...pubTask(t), userEmail: t.userEmail || t.userId })));
});

app.get('/api/admin/gallery', adminAuth, async (req, res) => {
  const items = await dbAll(
    `SELECT g.*, u.email as userEmail FROM gallery g LEFT JOIN users u ON g.userId=u.id ORDER BY g.createdAt DESC LIMIT 200`
  );
  res.json(items.map(g => ({ ...pubGallery(g), userEmail: g.userEmail || g.userId })));
});

app.delete('/api/admin/gallery/:id', adminAuth, async (req, res) => {
  const result = await dbRun(`DELETE FROM gallery WHERE id=?`, [req.params.id]);
  if (result.changes === 0) return res.status(404).json({ error: '作品不存在' });
  res.json({ ok: true });
});

app.delete('/api/admin/task/:id', adminAuth, async (req, res) => {
  const result = await dbRun(`DELETE FROM tasks WHERE id=?`, [req.params.id]);
  if (result.changes === 0) return res.status(404).json({ error: '任务不存在' });
  res.json({ ok: true });
});

// ─── 管理后台：统计分析 ─────────────────────────────────────────────────────
app.get('/api/admin/analytics', adminAuth, async (req, res) => {
  const succeeded = await dbAll(`SELECT * FROM tasks WHERE status='succeeded'`);
  const modelCountMap = {};
  const modelRevenueMap = {};
  for (const t of succeeded) {
    const key = t.planLabel || '未知';
    modelCountMap[key] = (modelCountMap[key] || 0) + 1;
    modelRevenueMap[key] = (modelRevenueMap[key] || 0) + (t.costYuan || 0);
  }
  const modelStats = Object.entries(modelCountMap)
    .map(([name, count]) => ({ name, count, revenue: parseFloat((modelRevenueMap[name] || 0).toFixed(2)) }))
    .sort((a, b) => b.count - a.count);

  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const monthTaskMap = {};
  const monthRevenueMap = {};
  for (const m of months) { monthTaskMap[m] = 0; monthRevenueMap[m] = 0; }
  const allTasks = await dbAll(`SELECT * FROM tasks`);
  for (const t of allTasks) {
    if (!t.createdAt) continue;
    const ym = t.createdAt.slice(0, 7);
    if (monthTaskMap[ym] !== undefined) monthTaskMap[ym]++;
    if (t.status === 'succeeded' && monthRevenueMap[ym] !== undefined) {
      monthRevenueMap[ym] = parseFloat((monthRevenueMap[ym] + (t.costYuan || 0)).toFixed(2));
    }
  }
  const monthStats = months.map(m => ({ month: m, tasks: monthTaskMap[m], revenue: monthRevenueMap[m] }));

  res.json({ modelStats, monthStats });
});

// ─── 管理后台：配置管理 ───────────────────────────────────────────────────
app.get('/api/admin/config', adminAuth, (req, res) => {
  const safeProviders = appConfig.providers.map(p => ({
    ...p,
    apiKey: p.apiKey ? p.apiKey.slice(0, 4) + '****' + p.apiKey.slice(-4) : ''
  }));
  res.json({ providers: safeProviders, models: appConfig.models });
});

app.post('/api/admin/providers', adminAuth, (req, res) => {
  const { id, name, baseUrl, apiKey, enabled } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id 和名称不能为空' });
  const idx = appConfig.providers.findIndex(p => p.id === id);
  if (idx >= 0) {
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

app.delete('/api/admin/models/:id', adminAuth, (req, res) => {
  const idx = appConfig.models.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '模型不存在' });
  appConfig.models.splice(idx, 1);
  saveConfig();
  rebuildPricing();
  res.json({ ok: true });
});

// ─── 首页配置 API ────────────────────────────────────────────────────────────
// 公开接口：获取首页配置（已解析）
app.get('/api/homepage/config', (req, res) => {
  res.json(resolveHomepageConfig());
});

// 管理接口：更新首页配置
app.put('/api/admin/homepage/config', adminAuth, (req, res) => {
  const updates = req.body;
  if (updates.badge !== undefined) HOMEPAGE_CONFIG.badge = updates.badge;
  if (updates.titleLine1 !== undefined) HOMEPAGE_CONFIG.titleLine1 = updates.titleLine1;
  if (updates.titleLine2 !== undefined) HOMEPAGE_CONFIG.titleLine2 = updates.titleLine2;
  if (updates.subtitle !== undefined) HOMEPAGE_CONFIG.subtitle = updates.subtitle;
  if (updates.apiUrl !== undefined) HOMEPAGE_CONFIG.apiUrl = updates.apiUrl;
  if (updates.stats !== undefined) HOMEPAGE_CONFIG.stats = updates.stats;
  if (updates.popularModels !== undefined) HOMEPAGE_CONFIG.popularModels = updates.popularModels;
  if (saveHomepageConfig()) {
    res.json({ ok: true, config: resolveHomepageConfig() });
  } else {
    res.status(500).json({ error: '保存失败' });
  }
});

// 管理接口：重置首页配置（带 X-Admin-Password 头）
app.post('/api/admin/homepage/reset', adminAuth, (req, res) => {
  HOMEPAGE_CONFIG = {};
  loadHomepageConfig(); // 重新加载默认值
  saveHomepageConfig();
  res.json({ ok: true, config: resolveHomepageConfig() });
});

// ─── 健康检查 ────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({
  status: 'ok', time: new Date().toISOString(),
  models: getEnabledModels().length, providers: appConfig.providers.length
}));

// ─── 管理后台页面 ────────────────────────────────────────────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/admin.html'));
});

// ─── 前端路由兜底 ────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/v1/')) {
    return res.status(404).json({ error: '接口不存在' });
  }
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI Media Studio running on http://0.0.0.0:${PORT}`);
  console.log(`已加载 ${appConfig.models.length} 个模型，${appConfig.providers.length} 个服务商`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => { db.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.close(() => process.exit(0));
});
