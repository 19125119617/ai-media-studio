<template>
  <div class="page">
    <h1 class="page-title">作品库</h1>
    <p class="page-sub">管理和浏览你的 AI 生成作品</p>

    <div class="gallery-header">
      <div class="gallery-filter">
        <button
          v-for="f in filters"
          :key="f.key"
          :class="['filter-btn', { active: gallery.filter === f.key }]"
          @click="setFilter(f.key)"
        >{{ f.label }}</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="gallery.loading" class="empty-state">
      <div class="icon">&#9203;</div>
      <p>正在加载作品列表...</p>
    </div>

    <!-- Error -->
    <div v-else-if="gallery.error" class="empty-state">
      <div class="icon">&#9888;</div>
      <p>{{ gallery.error }}</p>
    </div>

    <!-- Empty -->
    <div v-else-if="gallery.filteredItems.length === 0" class="empty-state">
      <div class="icon">&#128202;</div>
      <p>暂无作品</p>
    </div>

    <!-- Grid -->
    <div v-else class="gallery-grid">
      <div
        class="gallery-item"
        v-for="item in gallery.filteredItems"
        :key="item.id"
        @click="viewItem(item)"
      >
        <div class="gallery-thumb">
          <img v-if="item.type === 'image'" :src="item.thumbnail || item.url" :alt="item.prompt">
          <video v-else-if="item.type === 'video'" :src="item.thumbnail || item.url" muted></video>
          <span class="type-badge">{{ item.type === 'image' ? '图片' : '视频' }}</span>
          <span class="duration-badge" v-if="item.duration">{{ item.duration }}s</span>
        </div>
        <div class="gallery-info">
          <div class="gallery-prompt">{{ item.prompt }}</div>
          <div class="gallery-meta">
            <span class="gallery-date">{{ formatDate(item.createdAt) }}</span>
            <span class="gallery-price" v-if="item.costYuan">¥{{ item.costYuan }}</span>
          </div>
        </div>
        <div class="gallery-actions">
          <button class="btn-sm" @click.stop="downloadItem(item)">下载</button>
          <button class="btn-sm" @click.stop="deleteItem(item.id)">删除</button>
        </div>
      </div>
    </div>

    <!-- Item Detail Modal -->
    <div class="modal-overlay" :class="{ show: selectedItem }" @click.self="selectedItem = null" v-if="selectedItem">
      <div class="modal" @click.stop>
        <div class="modal-media">
          <img v-if="selectedItem.type === 'image'" :src="selectedItem.url">
          <video v-else-if="selectedItem.type === 'video'" :src="selectedItem.url" controls></video>
        </div>
        <div class="modal-info">
          <div class="modal-prompt">{{ selectedItem.prompt }}</div>
          <div class="modal-meta">
            <span>创建时间：{{ formatDate(selectedItem.createdAt) }}</span>
            <span v-if="selectedItem.planKey">方案：{{ selectedItem.planKey }}</span>
            <span v-if="selectedItem.costYuan">费用：¥{{ selectedItem.costYuan }}</span>
            <span v-if="selectedItem.duration">时长：{{ selectedItem.duration }}s</span>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-sm" @click="downloadItem(selectedItem)">下载原图</button>
          <button class="btn-sm" @click="selectedItem = null">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useGalleryStore } from '../stores/gallery.js'

const gallery = useGalleryStore()
const selectedItem = ref(null)

const filters = [
  { key: 'all', label: '全部' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
]

function setFilter(key) {
  gallery.setFilter(key)
}

function viewItem(item) {
  selectedItem.value = item
}

function downloadItem(item) {
  if (item.url) {
    const a = document.createElement('a')
    a.href = item.url
    a.download = item.prompt?.slice(0, 30) + '.' + (item.url.split('.').pop() || 'jpg')
    a.target = '_blank'
    a.click()
  }
}

function deleteItem(id) {
  gallery.deleteItem(id)
}

function formatDate(date) {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  gallery.loadGallery()
})
</script>

<style scoped>
.gallery-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.gallery-filter { display: flex; gap: 6px; }
.filter-btn {
  padding: 6px 14px; border: 1px solid var(--border); border-radius: 20px;
  background: none; color: var(--text2); font-size: 12px; cursor: pointer; transition: all .2s;
}
.filter-btn.active { border-color: var(--purple); color: var(--purple); background: var(--purple-bg); }
.gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
.gallery-item {
  background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius);
  overflow: hidden; transition: all .2s; cursor: pointer;
}
.gallery-item:hover { border-color: var(--border2); transform: translateY(-2px); }
.gallery-thumb {
  width: 100%; aspect-ratio: 16/10; background: var(--bg3); position: relative; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.gallery-thumb img, .gallery-thumb video { width: 100%; height: 100%; object-fit: cover; }
.gallery-thumb .type-badge {
  position: absolute; top: 10px; left: 10px;
  font-size: 10px; padding: 3px 8px; border-radius: 4px;
  background: rgba(0,0,0,.25); color: #fff; font-weight: 600;
}
.gallery-thumb .duration-badge {
  position: absolute; bottom: 8px; right: 8px;
  font-size: 10px; padding: 2px 6px; border-radius: 4px;
  background: rgba(0,0,0,.3); color: #fff;
}
.gallery-info { padding: 14px 16px; }
.gallery-prompt { font-size: 13px; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 8px; }
.gallery-meta { display: flex; align-items: center; justify-content: space-between; }
.gallery-date { font-size: 11px; color: var(--text3); }
.gallery-price { font-size: 12px; color: var(--amber); }
.gallery-actions { padding: 0 16px 14px; display: none; gap: 6px; }
.gallery-item:hover .gallery-actions { display: flex; }
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.3); backdrop-filter: blur(8px);
  z-index: 300; display: none; align-items: center; justify-content: center; padding: 20px;
}
.modal-overlay.show { display: flex; }
.modal {
  background: var(--bg2); border: 1px solid var(--border2); border-radius: var(--radius);
  max-width: 900px; width: 100%; max-height: 90vh; overflow-y: auto;
}
.modal-media { width: 100%; background: #000; display: flex; align-items: center; justify-content: center; max-height: 60vh; }
.modal-media img, .modal-media video { max-width: 100%; max-height: 60vh; object-fit: contain; }
.modal-info { padding: 20px 24px; }
.modal-prompt { font-size: 14px; color: var(--text2); margin-bottom: 12px; line-height: 1.7; }
.modal-meta { display: flex; gap: 16px; font-size: 12px; color: var(--text3); flex-wrap: wrap; }
.modal-actions { padding: 0 24px 20px; display: flex; gap: 8px; }
.btn-sm {
  padding: 7px 16px; border-radius: 8px; font-size: 12px; cursor: pointer;
  border: 1px solid var(--border2); background: var(--bg4); color: var(--text2); transition: all .2s;
}
.btn-sm:hover { background: var(--bg5); color: var(--text); }
.empty-state { text-align: center; padding: 80px 0; color: var(--text3); }
.empty-state .icon { font-size: 48px; margin-bottom: 14px; }
.empty-state p { font-size: 15px; }
</style>
