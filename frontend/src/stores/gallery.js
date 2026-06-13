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
        this.items = res.data
      } catch (err) {
        this.error = err.response?.data?.error || '加载失败'
      } finally {
        this.loading = false
      }
    },
    async deleteItem(id) {
      try {
        await axios.delete('/api/gallery/' + id)
        this.items = this.items.filter(item => item.id !== id)
      } catch (err) {
        throw err.response?.data?.error || '删除失败'
      }
    },
    setFilter(f) {
      this.filter = f
    }
  }
})
