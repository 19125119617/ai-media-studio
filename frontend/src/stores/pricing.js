import { defineStore } from 'pinia'
import axios from 'axios'

export const usePricingStore = defineStore('pricing', {
  state: () => ({
    plans: [],
    loading: false,
    error: null
  }),
  actions: {
    async loadPricing() {
      this.loading = true
      this.error = null
      try {
        const res = await axios.get('/api/pricing')
        this.plans = res.data
      } catch (err) {
        this.error = err.response?.data?.error || '加载失败'
      } finally {
        this.loading = false
      }
    }
  }
})
