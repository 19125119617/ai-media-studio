<template>
  <div class="admin-container">
    <!-- Login Overlay -->
    <div v-if="!loggedIn" class="login-overlay">
      <div class="login-box">
        <h2>🔐 管理后台</h2>
        <input v-model="adminPwd" type="password" placeholder="请输入管理密码" @keydown.enter="doLogin" />
        <button @click="doLogin">进入后台</button>
        <p v-if="loginError" class="login-error">{{ loginError }}</p>
      </div>
    </div>

    <!-- Admin Dashboard -->
    <template v-else>
      <!-- Topbar -->
      <div class="admin-topbar">
        <div class="topbar-left">
          <span class="topbar-brand">AI 创作工坊</span>
          <span class="admin-badge">ADMIN</span>
        </div>
        <div class="topbar-right">
          <a href="/" @click.prevent="goHome">← 返回前台</a>
          <button @click="loadAll">🔄 刷新</button>
        </div>
      </div>

      <div class="admin-main">
        <!-- Stats -->
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-value purple">{{ stats.totalUsers }}</div><div class="stat-label">总用户数</div></div>
          <div class="stat-card"><div class="stat-value teal">{{ stats.totalTasks }}</div><div class="stat-label">总任务数</div></div>
          <div class="stat-card"><div class="stat-value">{{ stats.totalGallery }}</div><div class="stat-label">作品数</div></div>
          <div class="stat-card"><div class="stat-value amber">{{ stats.totalRevenue.toFixed(2) }}</div><div class="stat-label">总收入（元）</div></div>
          <div class="stat-card"><div class="stat-value green">{{ stats.todayTasks }}</div><div class="stat-label">今日任务</div></div>
          <div class="stat-card"><div class="stat-value amber">{{ stats.todayRevenue.toFixed(2) }}</div><div class="stat-label">今日收入（元）</div></div>
        </div>

        <!-- Tabs -->
        <div class="admin-tabs">
          <button v-for="t in tabs" :key="t.id" :class="['tab', { active: activeTab === t.id }]" @click="activeTab = t.id">
            {{ t.icon }} {{ t.label }}
          </button>
        </div>

        <!-- Users Tab -->
        <div v-if="activeTab === 'users'" class="admin-panel">
          <table>
            <thead><tr><th>邮箱</th><th>昵称</th><th>余额</th><th>任务数</th><th>注册时间</th></tr></thead>
            <tbody>
              <tr v-for="u in users" :key="u.id">
                <td>{{ u.email }}</td><td>{{ u.nickname }}</td>
                <td><span class="tag succeed">¥{{ (u.balance || 0).toFixed(2) }}</span></td>
                <td>{{ u.taskCount || 0 }}</td>
                <td>{{ formatDate(u.createdAt) }}</td>
              </tr>
              <tr v-if="users.length === 0"><td colspan="5" class="empty-cell">暂无数据</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Tasks Tab -->
        <div v-if="activeTab === 'tasks'" class="admin-panel">
          <table>
            <thead><tr><th>用户</th><th>类型</th><th>提示词</th><th>状态</th><th>金额</th><th>时间</th></tr></thead>
            <tbody>
              <tr v-for="t in tasks" :key="t.id">
                <td>{{ t.userEmail }}</td>
                <td><span :class="['tag', t.type === 'image' ? 'image' : 'video']">{{ t.type === 'text-to-image' ? '文生图' : t.type === 'text-to-video' ? '文生视频' : '图生视频' }}</span></td>
                <td class="prompt-cell">{{ t.prompt }}</td>
                <td><span :class="['tag', t.status]">{{ statusLabel(t.status) }}</span></td>
                <td>¥{{ (t.costYuan || 0).toFixed(2) }}</td>
                <td>{{ formatDate(t.createdAt) }}</td>
              </tr>
              <tr v-if="tasks.length === 0"><td colspan="6" class="empty-cell">暂无数据</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Models Tab (模型管理) -->
        <div v-if="activeTab === 'models'" class="admin-panel">
          <div class="panel-head">
            <h3>模型列表</h3>
            <button class="btn-add" @click="showModelForm = true">+ 添加模型</button>
          </div>
          <table>
            <thead><tr><th>ID</th><th>名称</th><th>类型</th><th>价格(元)</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="m in models" :key="m.id">
                <td><code>{{ m.id }}</code></td>
                <td>{{ m.label }}</td>
                <td><span :class="['tag', m.type]">{{ m.type === 'image' ? '文生图' : '文生视频' }}</span></td>
                <td>¥{{ (m.price || 0).toFixed(2) }}{{ m.perSec ? '/秒' : '/次' }}</td>
                <td>
                  <label class="toggle">
                    <input type="checkbox" :checked="m.enabled !== false" @change="toggleModel(m)" />
                    <span class="toggle-slider"></span>
                  </label>
                </td>
                <td>
                  <button class="btn-sm btn-edit" @click="editModel(m)">编辑</button>
                  <button class="btn-sm btn-del" @click="deleteModel(m)">删除</button>
                </td>
              </tr>
              <tr v-if="models.length === 0"><td colspan="6" class="empty-cell">暂无模型</td></tr>
            </tbody>
          </table>

          <div class="panel-head" style="margin-top:16px">
            <h3>服务商列表</h3>
            <button class="btn-add" @click="showProviderForm = true">+ 添加服务商</button>
          </div>
          <table>
            <thead><tr><th>ID</th><th>名称</th><th>API Key</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="p in providers" :key="p.id">
                <td><code>{{ p.id }}</code></td>
                <td>{{ p.name }}</td>
                <td><code>{{ p.apiKey ? p.apiKey.slice(0,4)+'****'+p.apiKey.slice(-4) : '未配置' }}</code></td>
                <td>
                  <label class="toggle">
                    <input type="checkbox" :checked="p.enabled !== false" @change="toggleProvider(p)" />
                    <span class="toggle-slider"></span>
                  </label>
                </td>
                <td><button class="btn-sm btn-del" @click="deleteProvider(p)">删除</button></td>
              </tr>
              <tr v-if="providers.length === 0"><td colspan="5" class="empty-cell">暂无服务商</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Homepage Config Tab -->
        <div v-if="activeTab === 'homepage'" class="admin-panel" style="padding:24px">
          <div class="panel-head" style="padding:0 0 16px 0">
            <h3>🏠 首页展示配置</h3>
            <div>
              <button class="btn-add" @click="saveHomepageConfig" style="margin-right:8px">💾 保存</button>
              <button class="btn-cancel" @click="resetHomepageConfig">↺ 重置默认</button>
            </div>
          </div>
          
          <div class="form-row-3">
            <div class="form-row">
              <label class="form-label">徽章标签</label>
              <input v-model="hpForm.badge" class="form-input" />
              <div class="form-hint">首页顶部标签，如：统一 API · 按量计费 · 多模态</div>
            </div>
            <div class="form-row">
              <label class="form-label">主标题第一行</label>
              <input v-model="hpForm.titleLine1" class="form-input" />
              <div class="form-hint">渐变色的文字</div>
            </div>
            <div class="form-row">
              <label class="form-label">主标题第二行</label>
              <input v-model="hpForm.titleLine2" class="form-input" />
            </div>
          </div>
          
          <div class="form-row-3">
            <div class="form-row">
              <label class="form-label">副标题</label>
              <input v-model="hpForm.subtitle" class="form-input" />
            </div>
            <div class="form-row">
              <label class="form-label">API 地址</label>
              <input v-model="hpForm.apiUrl" class="form-input" />
            </div>
          </div>

          <div class="panel-head" style="padding:16px 0;margin-top:16px"><h3>统计数据（最多6个）</h3></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div v-for="(s, i) in hpForm.stats" :key="i" class="stat-edit-row">
              <input v-model="s.label" class="form-input" placeholder="标签" style="flex:1" />
              <input v-model="s.value" class="form-input" placeholder="值 ({{models}}/{{providers}}自动)" style="flex:1" />
              <button class="btn-sm btn-del" @click="removeStat(i)">✕</button>
            </div>
          </div>
          <button class="btn-add" style="margin-top:8px" @click="addStat">+ 添加统计项</button>

          <div class="panel-head" style="padding:16px 0;margin-top:16px"><h3>热门模型（展示在首页下方）</h3></div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <div v-for="(m, i) in hpForm.popularModels" :key="i" class="stat-edit-row">
              <input v-model="m.name" class="form-input" placeholder="模型名" style="flex:1" />
              <input v-model="m.color" class="form-input" placeholder="颜色代码" style="width:100px" />
              <button class="btn-sm btn-del" @click="removeModel(i)">✕</button>
            </div>
          </div>
          <button class="btn-add" style="margin-top:8px" @click="addModel">+ 添加模型</button>
        </div>

        <!-- Analytics Tab -->
        <div v-if="activeTab === 'analytics'" class="admin-panel">
          <div class="panel-head"><h3>模型使用统计</h3></div>
          <table>
            <thead><tr><th>模型</th><th>使用次数</th><th>收入（元）</th></tr></thead>
            <tbody>
              <tr v-for="m in modelStats" :key="m.name">
                <td>{{ m.name }}</td><td>{{ m.count }}</td><td>¥{{ m.revenue.toFixed(2) }}</td>
              </tr>
              <tr v-if="modelStats.length === 0"><td colspan="3" class="empty-cell">暂无数据</td></tr>
            </tbody>
          </table>
          
          <div class="panel-head" style="margin-top:16px"><h3>月度趋势</h3></div>
          <table>
            <thead><tr><th>月份</th><th>任务数</th><th>收入（元）</th></tr></thead>
            <tbody>
              <tr v-for="m in monthStats" :key="m.month">
                <td>{{ m.month }}</td><td>{{ m.tasks }}</td><td>¥{{ m.revenue.toFixed(2) }}</td>
              </tr>
              <tr v-if="monthStats.length === 0"><td colspan="3" class="empty-cell">暂无数据</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Add/Edit Model Modal -->
        <div v-if="showModelForm" class="modal-overlay" @click.self="showModelForm = false">
          <div class="modal">
            <div class="modal-head">
              <h3>{{ editingModel ? '编辑模型' : '添加模型' }}</h3>
              <button class="modal-close" @click="showModelForm = false">&times;</button>
            </div>
            <div class="modal-body">
              <div class="form-row">
                <label class="form-label">模型 ID</label>
                <input v-model="modelForm.id" class="form-input" :disabled="!!editingModel" />
              </div>
              <div class="form-row-2">
                <div class="form-row">
                  <label class="form-label">名称</label>
                  <input v-model="modelForm.label" class="form-input" />
                </div>
                <div class="form-row">
                  <label class="form-label">类型</label>
                  <select v-model="modelForm.type" class="form-input">
                    <option value="image">文生图</option>
                    <option value="video">文生视频</option>
                  </select>
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-row">
                  <label class="form-label">子类型</label>
                  <select v-model="modelForm.subtype" class="form-input">
                    <option value="text2img">文生图</option>
                    <option value="text2video">文生视频</option>
                    <option value="image2video">图生视频</option>
                  </select>
                </div>
                <div class="form-row">
                  <label class="form-label">服务商</label>
                  <select v-model="modelForm.providerId" class="form-input">
                    <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name }}</option>
                    <option value="bailian">百炼（默认）</option>
                  </select>
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-row">
                  <label class="form-label">价格 (元)</label>
                  <input v-model.number="modelForm.price" type="number" step="0.01" class="form-input" />
                </div>
                <div class="form-row">
                  <label class="form-label">成本 (元)</label>
                  <input v-model.number="modelForm.cost" type="number" step="0.01" class="form-input" />
                </div>
              </div>
              <div class="form-row">
                <label class="form-label">描述</label>
                <input v-model="modelForm.description" class="form-input" placeholder="模型描述" />
              </div>
              <div class="form-row">
                <label class="form-label">
                  <input v-model="modelForm.perSec" type="checkbox" /> 按秒计费
                </label>
              </div>
            </div>
            <div class="modal-foot">
              <span v-if="modelError" class="error-msg">{{ modelError }}</span>
              <button class="btn-cancel" @click="showModelForm = false">取消</button>
              <button class="btn-submit" @click="saveModel">{{ editingModel ? '保存' : '添加' }}</button>
            </div>
          </div>
        </div>

        <!-- Add Provider Modal -->
        <div v-if="showProviderForm" class="modal-overlay" @click.self="showProviderForm = false">
          <div class="modal">
            <div class="modal-head">
              <h3>添加服务商</h3>
              <button class="modal-close" @click="showProviderForm = false">&times;</button>
            </div>
            <div class="modal-body">
              <div class="form-row">
                <label class="form-label">ID</label>
                <input v-model="providerForm.id" class="form-input" placeholder="如: bailian" />
              </div>
              <div class="form-row">
                <label class="form-label">名称</label>
                <input v-model="providerForm.name" class="form-input" placeholder="如: 阿里云百炼" />
              </div>
              <div class="form-row">
                <label class="form-label">API Key</label>
                <input v-model="providerForm.apiKey" class="form-input" type="password" placeholder="sk-xxx" />
              </div>
              <div class="form-row">
                <label class="form-label">Base URL</label>
                <input v-model="providerForm.baseUrl" class="form-input" placeholder="https://dashscope.aliyuncs.com" />
              </div>
            </div>
            <div class="modal-foot">
              <button class="btn-cancel" @click="showProviderForm = false">取消</button>
              <button class="btn-submit" @click="saveProvider">添加</button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const ADMIN_PASSWORD = 'admin123'

// Login
const loggedIn = ref(false)
const adminPwd = ref('')
const loginError = ref('')

function doLogin() {
  if (adminPwd.value === ADMIN_PASSWORD) {
    loggedIn.value = true
    loginError.value = ''
    loadAll()
  } else {
    loginError.value = '管理密码错误'
  }
}

// Admin headers
function adminHeaders() {
  return { 'X-Admin-Password': ADMIN_PASSWORD }
}

// Tabs
const activeTab = ref('users')
const tabs = [
  { id: 'users', icon: '👥', label: '用户' },
  { id: 'tasks', icon: '📋', label: '任务' },
  { id: 'models', icon: '⚙️', label: '模型管理' },
  { id: 'homepage', icon: '🏠', label: '首页配置' },
  { id: 'analytics', icon: '📈', label: '分析' },
]

// Stats
const stats = reactive({
  totalUsers: 0, totalTasks: 0, totalGallery: 0,
  totalRevenue: 0, todayTasks: 0, todayRevenue: 0
})

async function loadStats() {
  try {
    const res = await axios.get('/api/admin/stats', { headers: adminHeaders() })
    Object.assign(stats, res.data)
  } catch (e) { console.error('Stats load failed:', e) }
}

// Users
const users = ref([])
async function loadUsers() {
  try {
    const res = await axios.get('/api/admin/users', { headers: adminHeaders() })
    users.value = res.data
  } catch (e) { console.error('Users load failed:', e) }
}

// Tasks
const tasks = ref([])
async function loadTasks() {
  try {
    const res = await axios.get('/api/admin/tasks', { headers: adminHeaders() })
    tasks.value = res.data
  } catch (e) { console.error('Tasks load failed:', e) }
}

// Models
const models = ref([])
const providers = ref([])
const showModelForm = ref(false)
const showProviderForm = ref(false)
const editingModel = ref(null)
const modelError = ref('')
const modelForm = reactive({
  id: '', label: '', type: 'image', subtype: 'text2img',
  providerId: 'bailian', price: 10, cost: 5,
  description: '', perSec: false
})
const providerForm = reactive({
  id: '', name: '', apiKey: '', baseUrl: 'https://dashscope.aliyuncs.com'
})

async function loadConfig() {
  try {
    const res = await axios.get('/api/admin/config', { headers: adminHeaders() })
    providers.value = res.data.providers || []
    models.value = res.data.models || []
  } catch (e) { console.error('Config load failed:', e) }
}

async function toggleModel(m) {
  try {
    await axios.put(`/api/admin/models/${m.id}`, 
      { enabled: !(m.enabled !== false) },
      { headers: adminHeaders() }
    )
    m.enabled = !(m.enabled !== false)
  } catch (e) { console.error('Toggle model failed:', e) }
}

function editModel(m) {
  editingModel.value = m
  Object.assign(modelForm, {
    id: m.id, label: m.label, type: m.type, subtype: m.subtype || 'text2img',
    providerId: m.providerId || 'bailian', price: m.price || 0, cost: m.cost || 0,
    description: m.description || '', perSec: !!m.perSec
  })
  showModelForm.value = true
}

async function saveModel() {
  modelError.value = ''
  if (!modelForm.id || !modelForm.type || !modelForm.subtype) {
    modelError.value = 'ID、类型、子类型不能为空'
    return
  }
  try {
    if (editingModel.value) {
      await axios.put(`/api/admin/models/${modelForm.id}`, modelForm, { headers: adminHeaders() })
    } else {
      await axios.post('/api/admin/models', modelForm, { headers: adminHeaders() })
    }
    showModelForm.value = false
    editingModel.value = null
    await loadConfig()
  } catch (e) {
    modelError.value = e.response?.data?.error || '保存失败'
  }
}

async function deleteModel(m) {
  if (!confirm(`确定删除模型 "${m.label}" ？`)) return
  try {
    await axios.delete(`/api/admin/models/${m.id}`, { headers: adminHeaders() })
    await loadConfig()
  } catch (e) { console.error('Delete model failed:', e) }
}

async function toggleProvider(p) {
  try {
    await axios.post('/api/admin/providers', 
      { id: p.id, name: p.name, enabled: !(p.enabled !== false) },
      { headers: adminHeaders() }
    )
    p.enabled = !(p.enabled !== false)
  } catch (e) { console.error('Toggle provider failed:', e) }
}

async function saveProvider() {
  if (!providerForm.id || !providerForm.name) return
  try {
    await axios.post('/api/admin/providers', providerForm, { headers: adminHeaders() })
    showProviderForm.value = false
    await loadConfig()
  } catch (e) { console.error('Save provider failed:', e) }
}

async function deleteProvider(p) {
  if (!confirm(`确定删除服务商 "${p.name}" ？`)) return
  try {
    await axios.delete(`/api/admin/providers/${p.id}`, { headers: adminHeaders() })
    await loadConfig()
  } catch (e) { console.error('Delete provider failed:', e) }
}

// Homepage Config
const hpForm = reactive({
  badge: '', titleLine1: '', titleLine2: '', subtitle: '', apiUrl: '',
  stats: [],
  popularModels: []
})

async function loadHomepageConfig() {
  try {
    const res = await axios.get('/api/homepage/config')
    Object.assign(hpForm, res.data)
  } catch (e) { console.error('Homepage config load failed:', e) }
}

async function saveHomepageConfig() {
  try {
    const res = await axios.put('/api/admin/homepage/config', hpForm, { headers: adminHeaders() })
    if (res.data.ok) {
      Object.assign(hpForm, res.data.config)
      alert('✅ 首页配置已保存！刷新前台页面即可看到效果。')
    }
  } catch (e) {
    alert('❌ 保存失败: ' + (e.response?.data?.error || e.message))
  }
}

async function resetHomepageConfig() {
  if (!confirm('确定重置为默认配置？')) return
  try {
    const res = await axios.post('/api/admin/homepage/reset', {}, { headers: adminHeaders() })
    Object.assign(hpForm, res.data.config)
    alert('✅ 已重置为默认配置！')
  } catch (e) {
    alert('❌ 重置失败')
  }
}

function addStat() {
  hpForm.stats.push({ label: '新统计', value: '0' })
}

function removeStat(i) {
  hpForm.stats.splice(i, 1)
}

function addModel() {
  hpForm.popularModels.push({ name: '新模型', color: '#6366f1' })
}

function removeModel(i) {
  hpForm.popularModels.splice(i, 1)
}

// Analytics
const modelStats = ref([])
const monthStats = ref([])
async function loadAnalytics() {
  try {
    const res = await axios.get('/api/admin/analytics', { headers: adminHeaders() })
    modelStats.value = res.data.modelStats || []
    monthStats.value = res.data.monthStats || []
  } catch (e) { console.error('Analytics load failed:', e) }
}

// Helpers
function formatDate(d) {
  if (!d) return '-'
  return d.slice(0, 16).replace('T', ' ')
}

function statusLabel(s) {
  const map = { pending: '排队中', running: '生成中', succeeded: '成功', failed: '失败' }
  return map[s] || s
}

function loadAll() {
  loadStats()
  loadUsers()
  loadTasks()
  loadConfig()
  loadHomepageConfig()
  loadAnalytics()
}

function goHome() {
  router.push('/')
}
</script>

<style scoped>
.admin-container {
  min-height: 100vh;
  background: #080910;
  color: #e8eaf0;
  font-family: -apple-system,'PingFang SC','Microsoft YaHei',sans-serif;
}

/* Login */
.login-overlay {
  position: fixed; inset: 0; background: #080910; z-index: 500;
  display: flex; align-items: center; justify-content: center;
}
.login-box {
  width: 360px; background: #0f1219; border: 1px solid rgba(255,255,255,.13);
  border-radius: 20px; padding: 40px; text-align: center;
}
.login-box h2 { font-size: 20px; margin-bottom: 24px; color: #e8eaf0; }
.login-box input {
  width: 100%; background: #161b27; border: 1px solid rgba(255,255,255,.07);
  border-radius: 10px; color: #e8eaf0; padding: 12px 16px; font-size: 14px;
  outline: none; margin-bottom: 12px;
}
.login-box input:focus { border-color: #8b6cf5; }
.login-box button {
  width: 100%; background: #8b6cf5; color: #fff; border: none;
  border-radius: 10px; padding: 12px; font-size: 14px; font-weight: 600;
  cursor: pointer; margin-top: 8px;
}
.login-box button:hover { background: #6d4fd4; }
.login-error { color: #f04040; font-size: 12px; margin-top: 8px; }

/* Topbar */
.admin-topbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  height: 56px; background: #0f1219; border-bottom: 1px solid rgba(255,255,255,.07);
  display: flex; align-items: center; padding: 0 32px; justify-content: space-between;
}
.topbar-left { display: flex; align-items: center; gap: 8px; }
.topbar-brand { font-size: 16px; font-weight: 700; color: #e8eaf0; }
.admin-badge { font-size: 11px; background: #f04040; color: #fff; padding: 2px 8px; border-radius: 4px; }
.topbar-right { display: flex; align-items: center; gap: 12px; }
.topbar-right a { color: #9ba3b8; text-decoration: none; font-size: 13px; cursor: pointer; }
.topbar-right a:hover { color: #e8eaf0; }
.topbar-right button {
  background: #8b6cf5; color: #fff; border: none; border-radius: 8px;
  padding: 6px 16px; font-size: 13px; cursor: pointer;
}
.topbar-right button:hover { background: #6d4fd4; }

/* Main */
.admin-main {
  padding: 76px 32px 32px; max-width: 1400px; margin: 0 auto;
}

/* Stats */
.stats-grid {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; margin-bottom: 32px;
}
.stat-card {
  background: #0f1219; border: 1px solid rgba(255,255,255,.07);
  border-radius: 16px; padding: 20px;
}
.stat-value { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
.stat-value.purple { color: #8b6cf5; }
.stat-value.teal { color: #00d4aa; }
.stat-value.amber { color: #f5a623; }
.stat-value.green { color: #22c97d; }
.stat-label { font-size: 12px; color: #9ba3b8; }

/* Tabs */
.admin-tabs {
  display: flex; gap: 4px; margin-bottom: 20px; background: #161b27;
  border-radius: 10px; padding: 4px; flex-wrap: wrap;
}
.admin-tabs .tab {
  padding: 8px 20px; border: none; background: transparent; color: #9ba3b8;
  border-radius: 8px; cursor: pointer; font-size: 14px; white-space: nowrap;
}
.admin-tabs .tab.active { background: #8b6cf5; color: #fff; }
.admin-tabs .tab:hover:not(.active) { color: #e8eaf0; }

/* Panel */
.admin-panel {
  background: #0f1219; border: 1px solid rgba(255,255,255,.07);
  border-radius: 16px; overflow: hidden; margin-bottom: 24px;
}
.admin-panel table { width: 100%; border-collapse: collapse; font-size: 13px; }
.admin-panel th {
  padding: 12px 16px; text-align: left; color: #9ba3b8; font-weight: 500;
  border-bottom: 1px solid rgba(255,255,255,.07); background: #161b27; white-space: nowrap;
}
.admin-panel td {
  padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,.07);
  color: #e8eaf0; vertical-align: middle;
}
.admin-panel tr:last-child td { border-bottom: none; }
.admin-panel tr:hover td { background: #161b27; }
.empty-cell { text-align: center; padding: 40px; color: #555e78; }
.prompt-cell { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #9ba3b8; }

/* Tags */
.tag {
  font-size: 11px; padding: 2px 8px; border-radius: 4px; display: inline-block;
}
.tag.succeeded { background: rgba(34,201,125,.15); color: #22c97d; }
.tag.failed { background: rgba(240,64,64,.15); color: #f04040; }
.tag.pending { background: rgba(245,166,35,.15); color: #f5a623; }
.tag.running { background: rgba(139,108,245,.15); color: #8b6cf5; }
.tag.image { background: rgba(0,212,170,.15); color: #00d4aa; }
.tag.video { background: rgba(139,108,245,.15); color: #8b6cf5; }
.tag.succeed { background: rgba(34,201,125,.15); color: #22c97d; }
code { font-family: monospace; color: #f5a623; }

/* Panel head */
.panel-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,.07);
}
.panel-head h3 { font-size: 14px; font-weight: 600; }

.btn-add, .btn-submit {
  background: #8b6cf5; color: #fff; border: none; border-radius: 8px;
  padding: 7px 16px; font-size: 13px; cursor: pointer;
}
.btn-add:hover, .btn-submit:hover { background: #6d4fd4; }
.btn-cancel { background: #1e2537; color: #9ba3b8; border: none; border-radius: 8px; padding: 8px 20px; font-size: 13px; cursor: pointer; }
.btn-cancel:hover { color: #e8eaf0; }
.btn-sm {
  padding: 4px 10px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px;
}
.btn-edit { background: #1e2537; color: #9ba3b8; margin-right: 4px; }
.btn-edit:hover { background: rgba(139,108,245,.12); color: #8b6cf5; }
.btn-del { background: rgba(240,64,64,.1); color: #f04040; }
.btn-del:hover { background: rgba(240,64,64,.2); }

/* Toggle */
.toggle { position: relative; width: 36px; height: 20px; display: inline-block; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute; inset: 0; background: #26304a; border-radius: 20px;
  cursor: pointer; transition: .2s;
}
.toggle-slider::before {
  content: ''; position: absolute; height: 14px; width: 14px; left: 3px;
  bottom: 3px; background: #fff; border-radius: 50%; transition: .2s;
}
.toggle input:checked + .toggle-slider { background: #22c97d; }
.toggle input:checked + .toggle-slider::before { transform: translateX(16px); }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.7); z-index: 300;
  display: flex; align-items: center; justify-content: center;
}
.modal {
  background: #0f1219; border: 1px solid rgba(255,255,255,.13);
  border-radius: 20px; width: 520px; max-height: 85vh; overflow-y: auto;
}
.modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,.07);
}
.modal-head h3 { font-size: 16px; font-weight: 600; color: #e8eaf0; }
.modal-close { background: none; border: none; color: #9ba3b8; font-size: 20px; cursor: pointer; }
.modal-close:hover { color: #e8eaf0; }
.modal-body { padding: 24px; }
.modal-foot {
  display: flex; gap: 8px; justify-content: flex-end;
  padding: 16px 24px; border-top: 1px solid rgba(255,255,255,.07);
}

.form-row { margin-bottom: 16px; }
.form-row:last-child { margin-bottom: 0; }
.form-label { font-size: 12px; color: #9ba3b8; margin-bottom: 6px; display: block; }
.form-input {
  width: 100%; background: #161b27; border: 1px solid rgba(255,255,255,.07);
  border-radius: 10px; color: #e8eaf0; padding: 9px 14px; font-size: 13px; outline: none;
}
.form-input:focus { border-color: #8b6cf5; }
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
select.form-input { cursor: pointer; }
select.form-input option { background: #0f1219; color: #e8eaf0; }
.error-msg { color: #f04040; font-size: 12px; margin-right: auto; align-self: center; }

.form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }

.stat-edit-row {
  display: flex; align-items: center; gap: 8px;
  background: #161b27; border: 1px solid rgba(255,255,255,.07);
  border-radius: 10px; padding: 8px 12px;
}
.stat-edit-row .form-input { margin-bottom: 0; }

@media (max-width: 1100px) {
  .stats-grid { grid-template-columns: repeat(3, 1fr); }
  .admin-main { padding: 76px 16px 16px; }
}
</style>
