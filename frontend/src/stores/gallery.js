import { defineStore } from 'pinia'
import axios from 'axios'

export const useGalleryStore = defineStore('gallery', {
  state: () => ({
    items: [],
    filter: 'all',
    loading: false,
    error: null
  }),
  getters: {
    filteredItems: (state) => {
      if (state.filter === 'all') return state.items
      return state.items.filter(item => item.type === state.filter)
    }
  },
  actions: {
    async loadGallery() {
      this.loading = true
      this.error = null
      try {
        const res = await axios.get('/api/gallery')
        // 转换后端数据格式为前端可用格式
        this.items = res.data.map(item => {
          const urls = Array.isArray(item.result) ? item.result : (item.result ? [item.result] : [])
          const itemType = item.type?.includes('video') ? 'video' : 'image'
          return {
            id: item.id,
            type: itemType,
            url: urls[0] || '',
            thumbnail: urls[0] || '',
            prompt: item.prompt || '',
            planKey: item.planLabel || item.type || '',
            duration: item.duration || 0,
            costYuan: item.costYuan || 0,
            createdAt: item.createdAt || '',
            tags: item.tags || []
          }
        })
      } catch (err) {
        this.error = err.response?.data?.error || '加载失败'
      } finally {
        this.loading = false
      }
    },
    async deleteItem(id) {
      if (!confirm('确定要删除这个作品吗？')) return
      try {
        await axios.delete('/api/gallery/' + id)
        this.items = this.items.filter(item => item.id !== id)
      } catch (err) {
        alert(err.response?.data?.error || '删除失败')
      }
    },
    setFilter(f) {
      this.filter = f
    }
  }
})
