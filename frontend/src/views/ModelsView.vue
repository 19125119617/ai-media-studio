<template>
  <div class="models-page">
    <div class="page-header">
      <h1><span class="icon">🤖</span> AI 模型库</h1>
      <p class="subtitle">探索所有可用的 AI 创作模型，选择最适合你的工具</p>
    </div>

    <div class="models-filter">
      <button :class="{ active: filter === 'all' }" @click="filter = 'all'">
        <span class="filter-icon">🎯</span> 全部模型
      </button>
      <button :class="{ active: filter === 'image' }" @click="filter = 'image'">
        <span class="filter-icon">🖼️</span> 文生图
      </button>
      <button :class="{ active: filter === 'video' }" @click="filter = 'video'">
        <span class="filter-icon">🎬</span> 文生视频
      </button>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else class="models-grid">
      <div v-for="model in filteredModels" :key="model.id" class="model-card">
        <div class="model-badge" :class="model.type">
          {{ model.type === 'image' ? '🖼️ 图片' : '🎬 视频' }}
        </div>
        <h3>{{ model.label }}</h3>
        <p class="model-description">{{ model.description || '暂无描述' }}</p>
        <div class="model-meta">
          <span class="model-type">{{ model.type === 'image' ? '文生图' : '文生视频' }}</span>
          <span v-if="model.subtype" class="model-subtype">{{ model.subtype }}</span>
        </div>
        <div class="model-footer">
          <span class="price">¥{{ model.price }}<small>/次</small></span>
          <button @click="useModel(model)" class="use-btn">
            立即使用 →
          </button>
        </div>
      </div>
    </div>

    <div v-if="!loading && filteredModels.length === 0" class="empty">
      <p>暂无可用模型</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const models = ref([])
const filter = ref('all')
const loading = ref(true)

const filteredModels = computed(() => {
  if (filter.value === 'all') return models.value
  return models.value.filter(m => m.type === filter.value)
})

onMounted(async () => {
  try {
    const res = await axios.get('/api/models/pricing')
    models.value = res.data.models || []
  } catch (err) {
    console.error('Failed to load models:', err)
  } finally {
    loading.value = false
  }
})

function useModel(model) {
  if (!auth.isLoggedIn) {
    auth.showLoginModal()
    return
  }
  router.push({ name: 'create', query: { model: model.id }})
}
</script>

<style scoped>
.models-page {
  padding: 40px 20px;
  max-width: 1400px;
  margin: 0 auto;
  min-height: 100vh;
}

.page-header {
  text-align: center;
  margin-bottom: 50px;
}

.page-header h1 {
  font-size: 42px;
  background: linear-gradient(135deg, #00f5ff, #0080ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 15px;
}

.icon {
  -webkit-text-fill-color: initial;
}

.subtitle {
  color: #888;
  font-size: 18px;
}

.models-filter {
  display: flex;
  gap: 15px;
  margin-bottom: 40px;
  justify-content: center;
  flex-wrap: wrap;
}

.models-filter button {
  padding: 12px 24px;
  border: 2px solid #333;
  background: transparent;
  color: #888;
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.models-filter button.active,
.models-filter button:hover {
  background: rgba(0, 245, 255, 0.1);
  color: #00f5ff;
  border-color: #00f5ff;
}

.filter-icon {
  font-size: 18px;
}

.models-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 25px;
}

.model-card {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 2px solid #333;
  border-radius: 16px;
  padding: 25px;
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
}

.model-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #00f5ff, #0080ff);
  opacity: 0;
  transition: opacity 0.3s;
}

.model-card:hover {
  border-color: #00f5ff;
  transform: translateY(-8px);
  box-shadow: 0 10px 30px rgba(0, 245, 255, 0.2);
}

.model-card:hover::before {
  opacity: 1;
}

.model-badge {
  display: inline-block;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 15px;
}

.model-badge.image {
  background: rgba(0, 245, 255, 0.15);
  color: #00f5ff;
  border: 1px solid rgba(0, 245, 255, 0.3);
}

.model-badge.video {
  background: rgba(255, 0, 128, 0.15);
  color: #ff0080;
  border: 1px solid rgba(255, 0, 128, 0.3);
}

.model-card h3 {
  color: #fff;
  margin: 15px 0;
  font-size: 22px;
}

.model-description {
  color: #999;
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 15px;
}

.model-meta {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.model-type,
.model-subtype {
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  font-size: 12px;
  color: #aaa;
}

.model-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 20px;
  border-top: 1px solid #333;
}

.price {
  color: #00f5ff;
  font-weight: bold;
  font-size: 24px;
}

.price small {
  font-size: 14px;
  color: #888;
}

.use-btn {
  padding: 10px 24px;
  background: linear-gradient(135deg, #00f5ff, #0080ff);
  border: none;
  border-radius: 25px;
  color: #000;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 14px;
}

.use-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 5px 20px rgba(0, 245, 255, 0.4);
}

.loading {
  text-align: center;
  padding: 100px 0;
  color: #888;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #333;
  border-top-color: #00f5ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty {
  text-align: center;
  padding: 100px 0;
  color: #666;
  font-size: 18px;
}
</style>
