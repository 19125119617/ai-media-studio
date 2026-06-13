import { defineStore } from 'pinia'
import axios from 'axios'

export const useModelsStore = defineStore('models', {
  state: () => ({
    models: [],
    loading: false,
    error: null
  }),
  actions: {
    async loadModels() {
      this.loading = true
      this.error = null
      try {
        const res = await axios.get('/api/models')
        this.models = res.data
      } catch (err) {
        this.error = err.response?.data?.error || '加载失败'
      } finally {
        this.loading = false
      }
    }
  }
})
