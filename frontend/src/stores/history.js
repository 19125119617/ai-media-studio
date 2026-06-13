import { defineStore } from 'pinia'
import axios from 'axios'

export const useHistoryStore = defineStore('history', {
  state: () => ({
    items: [],
    loading: false,
    error: null
  }),
  actions: {
    async loadHistory() {
      this.loading = true
      this.error = null
      try {
        const res = await axios.get('/api/tasks')
        this.items = res.data.map(item => ({
          id: item.id,
          type: item.type,
          planKey: item.planLabel || item.planKey || '',
          planLabel: item.planLabel || '',
          prompt: item.prompt || '',
          status: item.status || 'pending',
          costYuan: item.costYuan || 0,
          duration: item.duration || 0,
          aspectRatio: item.aspectRatio || '',
          error: item.error || null,
          createdAt: item.createdAt || '',
          result: item.result || null
        }))
      } catch (err) {
        this.error = err.response?.data?.error || '加载失败'
      } finally {
        this.loading = false
      }
    }
  }
})
