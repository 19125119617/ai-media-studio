<template>
  <div class="create-page">
    <div class="create-container">
      <!-- Header -->
      <div class="create-header">
        <div>
          <div class="create-title">AI 创作</div>
          <div class="create-subtitle">选择场景，上传素材，输入提示词，一键生成专业内容</div>
        </div>
      </div>

      <!-- Top Tabs: function selector -->
      <div class="create-tabs">
        <button
          v-for="tab in functionTabs"
          :key="tab.key"
          :class="['create-tab', { active: activeTab === tab.key }]"
          @click="switchTab(tab.key)"
        >{{ tab.icon }} {{ tab.label }}</button>
      </div>

      <!-- Body -->
      <div class="create-body">
        <!-- Left: Config Panel -->
        <div class="create-left">
          <!-- Scene Selector -->
          <div class="panel">
            <div class="panel-body">
              <div class="form-label">选择场景</div>
              <div class="scene-card" @click="showToast('场景面板开发中', 'info')">
                <div class="scene-icon">{{ sceneIcon }}</div>
                <div>
                  <div class="scene-info-title">{{ sceneTitle }}</div>
                  <div class="scene-info-desc">{{ sceneDesc }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Upload -->
          <div class="panel">
            <div class="panel-header"><h3>上传素材</h3></div>
            <div class="panel-body">
              <div class="upload-zone">
                <input type="file" accept="image/*" @change="handleUpload">
                <div class="icon">⬆️</div>
                <p>点击或拖拽上传图片</p>
                <div class="hint">JPG / PNG / WEBP，最大 20MB</div>
                <img v-if="previewUrl" :src="previewUrl" class="upload-preview" alt="预览">
              </div>
            </div>
          </div>

          <!-- Options Row -->
          <div class="panel">
            <div class="panel-header"><h3>生成设置</h3></div>
            <div class="panel-body">
              <div class="form-group">
                <div class="option-row">
                  <span class="form-label" style="margin-bottom:0">生图数量</span>
                  <div class="option-btns">
                    <button
                      v-for="n in countOptions"
                      :key="n"
                      :class="['option-btn', { active: selectedCount === n }]"
                      @click="selectedCount = n"
                    >{{ n }}</button>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <div class="option-row">
                  <span class="form-label" style="margin-bottom:0">图片质量</span>
                  <div class="option-btns">
                    <button
                      v-for="q in qualityOptions"
                      :key="q"
                      :class="['option-btn', { active: selectedQuality === q }]"
                      @click="selectedQuality = q"
                    >{{ q }}</button>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <div class="option-row">
                  <span class="form-label" style="margin-bottom:0">生图比例</span>
                  <select v-model="selectedRatio" class="form-control" style="width:auto;min-width:80px">
                    <option v-for="r in ratioOptions" :key="r" :value="r">{{ r }}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- Prompt -->
          <div class="panel">
            <div class="panel-header"><h3>提示词</h3></div>
            <div class="panel-body">
              <textarea v-model="promptText" class="form-control" placeholder="描述你想要的画面，如：生成图片的6宫格分镜图，服装视觉大片，4K，相机拍摄真实风格。包含特写与局部，远景与近景..."></textarea>
            </div>
          </div>

          <!-- Generate Button -->
          <button class="btn-generate" @click="doGenerate" :disabled="!promptText.trim()">
            ✦ 开始 AI 生成
          </button>

          <!-- Result Panel -->
          <div v-if="showResult" class="result-panel show">
            <div class="result-status">
              <div :class="['status-dot', resultStatus]"></div>
              <span class="status-text">{{ resultText }}</span>
              <span v-if="resultCost" class="result-cost">¥{{ resultCost }}</span>
            </div>
            <div class="result-media">
              <img v-if="resultType === 'image' && resultUrl" :src="resultUrl">
              <video v-else-if="resultType === 'video' && resultUrl" :src="resultUrl" controls></video>
            </div>
            <div class="result-actions">
              <button class="btn-sm" @click="downloadResult">下载</button>
              <button class="btn-sm" @click="saveToGallery">保存到作品库</button>
              <button class="btn-sm" @click="showResult = false">清除</button>
            </div>
            <div v-if="resultError" class="result-error">{{ resultError }}</div>
          </div>
        </div><!-- /create-left -->

        <!-- Right: Cases -->
        <div>
          <div class="create-right-header">
            <div class="create-right-title">优秀案例</div>
          </div>

          <!-- Category Tabs -->
          <div class="category-tabs">
            <button
              v-for="cat in categories"
              :key="cat.key"
              :class="['category-tab', { active: activeCategory === cat.key }]"
              @click="filterCases(cat.key)"
            >{{ cat.label }}</button>
          </div>

          <!-- Cases Grid -->
          <div class="cases-grid">
            <div v-for="item in filteredCases" :key="item.id" class="case-card">
              <div class="case-card-title">{{ item.title }}</div>
              <div class="case-card-images">
                <div class="case-img-wrap">
                  <span class="case-label">原图</span>
                  <img :src="item.inputImg" :alt="item.title">
                </div>
                <div class="case-img-wrap">
                  <span class="case-label">生成</span>
                  <img :src="item.outputImg" :alt="item.title">
                </div>
              </div>
              <div class="case-card-actions">
                <button class="case-btn" @click="showToast('使用此模板', 'info')">使用此模板</button>
                <button class="case-btn primary" @click="showToast('查看大图', 'info')">查看大图</button>
              </div>
            </div>
          </div>
        </div><!-- /create-right -->
      </div><!-- /create-body -->
    </div><!-- /create-container -->

    <!-- Toast Container -->
    <div class="toast-container">
      <div
        v-for="(toast, i) in toasts"
        :key="i"
        :class="['toast', toast.type]"
      >{{ toast.message }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useModelsStore } from '../stores/models.js'
import { useAuthStore } from '../stores/auth.js'

const modelsStore = useModelsStore()
const auth = useAuthStore()

// ====== State ======
const activeTab = ref('storyboard')
const promptText = ref('')
const selectedCount = ref(1)
const selectedQuality = ref('2K')
const selectedRatio = ref('3:4')
const previewUrl = ref('')
const uploadedFile = ref(null)
const showResult = ref(false)
const resultStatus = ref('pending')
const resultText = ref('正在提交...')
const resultCost = ref('')
const resultType = ref('image')
const resultUrl = ref('')
const resultError = ref('')
const activeCategory = ref('all')
const toasts = ref([])

// ====== Data ======
const functionTabs = [
  { key: 'storyboard', icon: '🎨', label: '分镜图' },
  { key: 'smart-video', icon: '🎬', label: '智能视频' },
  { key: 'full-video', icon: '✨', label: '全能视频' },
  { key: 'video-understand', icon: '🧠', label: '视频理解' },
]

const countOptions = [1, 2, 3]
const qualityOptions = ['1K', '2K', '4K']
const ratioOptions = ['3:4', '1:1', '16:9', '9:16', '4:3']

const categories = [
  { key: 'all', label: '全部' },
  { key: 'clothing', label: '服装类' },
  { key: 'home', label: '家居类' },
  { key: 'architecture', label: '建筑类' },
  { key: 'electronics', label: '电子产品' },
  { key: 'jewelry', label: '珠宝首饰' },
  { key: 'beauty', label: '美妆护肤' },
  { key: 'food', label: '食品饮料' },
  { key: 'auto', label: '汽车交通' },
  { key: 'creative', label: '文创IP' },
  { key: 'outdoor', label: '运动户外' },
]

const cases = ref([
  { id: 1, title: '分镜图', category: 'clothing', inputImg: 'https://picsum.photos/seed/case1a/300/400', outputImg: 'https://picsum.photos/seed/case1b/300/400' },
  { id: 2, title: '沙发', category: 'home', inputImg: 'https://picsum.photos/seed/case2a/300/400', outputImg: 'https://picsum.photos/seed/case2b/300/400' },
  { id: 3, title: '耳环', category: 'jewelry', inputImg: 'https://picsum.photos/seed/case3a/300/400', outputImg: 'https://picsum.photos/seed/case3b/300/400' },
  { id: 4, title: '建筑外观', category: 'architecture', inputImg: 'https://picsum.photos/seed/case4a/300/400', outputImg: 'https://picsum.photos/seed/case4b/300/400' },
  { id: 5, title: '电子产品', category: 'electronics', inputImg: 'https://picsum.photos/seed/case5a/300/400', outputImg: 'https://picsum.photos/seed/case5b/300/400' },
  { id: 6, title: '美妆产品', category: 'beauty', inputImg: 'https://picsum.photos/seed/case6a/300/400', outputImg: 'https://picsum.photos/seed/case6b/300/400' },
  { id: 7, title: '食品饮料', category: 'food', inputImg: 'https://picsum.photos/seed/case7a/300/400', outputImg: 'https://picsum.photos/seed/case7b/300/400' },
  { id: 8, title: '汽车展示', category: 'auto', inputImg: 'https://picsum.photos/seed/case8a/300/400', outputImg: 'https://picsum.photos/seed/case8b/300/400' },
  { id: 9, title: '文创IP', category: 'creative', inputImg: 'https://picsum.photos/seed/case9a/300/400', outputImg: 'https://picsum.photos/seed/case9b/300/400' },
])

// ====== Computed ======
const sceneTitle = computed(() => {
  const map = { 'storyboard': '分镜图', 'smart-video': '智能视频', 'full-video': '全能视频', 'video-understand': '视频理解' }
  return map[activeTab.value] || '分镜图'
})

const sceneDesc = computed(() => {
  const map = { 'storyboard': '上传图片，AI 生成分镜脚本', 'smart-video': '智能生成视频内容', 'full-video': '全能视频处理', 'video-understand': 'AI 分析视频内容' }
  return map[activeTab.value] || '上传图片，AI 生成分镜脚本'
})

const sceneIcon = computed(() => {
  const map = { 'storyboard': '🎬', 'smart-video': '🎥', 'full-video': '✨', 'video-understand': '🧠' }
  return map[activeTab.value] || '🎬'
})

const filteredCases = computed(() => {
  if (activeCategory.value === 'all') return cases.value
  return cases.value.filter(c => c.category === activeCategory.value)
})

// ====== Methods ======
function switchTab(key) {
  activeTab.value = key
}

function handleUpload(e) {
  const file = e.target.files[0]
  if (file) {
    uploadedFile.value = file
    previewUrl.value = URL.createObjectURL(file)
  }
}

function filterCases(key) {
  activeCategory.value = key
}

function doGenerate() {
  // TODO: implement generation
}

function downloadResult() {
  // TODO: implement download
}

function saveToGallery() {
  // TODO: implement save to gallery
}

function showToast(message, type = 'info') {
  const toast = { message, type }
  toasts.value.push(toast)
  setTimeout(() => {
    const idx = toasts.value.indexOf(toast)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }, 3000)
}

onMounted(() => {
  modelsStore.loadModels()
})
</script>
