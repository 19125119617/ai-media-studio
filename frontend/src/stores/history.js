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
        this.items = res.data
      } catch (err) {
        this.error = err.response?.data?.error || '加载失败'
      } finally {
        this.loading = false
      }
    }
  }
})
