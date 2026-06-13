<template>
  <div class="page">
    <h1 class="page-title">历史记录</h1>
    <p class="page-sub">查看所有生成任务的执行历史</p>

    <!-- Loading -->
    <div v-if="history.loading" class="empty-state">
      <div class="icon">&#9203;</div>
      <p>正在加载历史记录...</p>
    </div>

    <!-- Error -->
    <div v-else-if="history.error" class="empty-state">
      <div class="icon">&#9888;</div>
      <p>{{ history.error }}</p>
    </div>

    <!-- Empty -->
    <div v-else-if="history.items.length === 0" class="empty-state">
      <div class="icon">&#128203;</div>
      <p>暂无历史记录</p>
    </div>

    <!-- Table -->
    <table class="history-table" v-else>
      <thead>
        <tr>
          <th>类型</th>
          <th>描述</th>
          <th>方案</th>
          <th>状态</th>
          <th>费用</th>
          <th>时间</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in history.items" :key="item.id">
          <td>
            <span :class="['type-badge', 'type-' + item.type]">{{ typeLabel(item.type) }}</span>
          </td>
          <td>
            <span :title="item.prompt" style="max-width:300px;display:inline-block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ item.prompt || '-' }}</span>
          </td>
          <td>{{ item.planKey || '-' }}</td>
          <td>
            <span :class="['status-dot', item.status]"></span>
            <span class="status-text">{{ statusLabel(item.status) }}</span>
          </td>
          <td>
            <span v-if="item.costYuan !== undefined">¥{{ item.costYuan }}</span>
            <span v-else class="text3">-</span>
          </td>
          <td>{{ formatDate(item.createdAt) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useHistoryStore } from '../stores/history.js'

const history = useHistoryStore()

const typeLabels = {
  'text-to-image': '文生图',
  'text-to-video': '文生视频',
  'image-to-video': '图生视频',
  'image': '图片',
  'video': '视频',
}

const statusLabels = {
  'pending': '排队中',
  'running': '生成中',
  'succeeded': '已完成',
  'failed': '失败',
  'success': '已完成',
}

function typeLabel(type) {
  return typeLabels[type] || type || '-'
}

function statusLabel(status) {
  return statusLabels[status] || status || '-'
}

function formatDate(date) {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  history.loadHistory()
})
</script>

<style scoped>
.history-table { width: 100%; border-collapse: collapse; }
.history-table th { text-align: left; padding: 10px 12px; font-size: 12px; color: var(--text3); border-bottom: 1px solid var(--border); }
.history-table td { padding: 12px; font-size: 13px; border-bottom: 1px solid var(--border); }
.history-table tr:hover { background: var(--bg3); }
.type-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.type-text-to-image, .type-image { background: #f0fdf4; color: #16a34a; }
.type-text-to-video, .type-video { background: #f5f3ff; color: #7c3aed; }
.type-image-to-video { background: #fef2f2; color: #dc2626; }
.status-dot { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; }
.status-dot::before { content: ''; width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.status-dot.pending::before, .status-dot.running::before { background: var(--amber); animation: pulse 1.2s infinite; }
.status-dot.pending, .status-dot.running { color: var(--amber); }
.status-dot.succeeded::before, .status-dot.success::before { background: var(--green); }
.status-dot.succeeded, .status-dot.success { color: var(--green); }
.status-dot.failed::before { background: var(--red); }
.status-dot.failed { color: var(--red); }
@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.35; } }
.text3 { color: var(--text3); }
.empty-state { text-align: center; padding: 80px 0; color: var(--text3); }
.empty-state .icon { font-size: 48px; margin-bottom: 14px; }
.empty-state p { font-size: 15px; }
</style>
