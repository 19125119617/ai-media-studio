import { defineStore } from 'pinia'
import axios from 'axios'

export const useStatsStore = defineStore('stats', {
  state: () => ({
    stats: null,
    rechargeRecords: [],
    loading: false,
    error: null
  }),
  actions: {
    async loadStats() {
      this.loading = true
      this.error = null
      try {
        const res = await axios.get('/api/stats')
        this.stats = res.data
      } catch (err) {
        // 用户端统计接口暂未实现，静默处理
        this.stats = null
        if (err.response?.status !== 404) {
          this.error = err.response?.data?.error || '加载失败'
        }
      } finally {
        this.loading = false
      }
    },
    async loadRechargeRecords() {
      try {
        const res = await axios.get('/api/recharge/records')
        this.rechargeRecords = res.data
      } catch (err) {
        console.error('充值记录加载失败:', err.message)
      }
    },
    async recharge(amount, method) {
      try {
        const res = await axios.post('/api/recharge', { amount, method })
        return res.data
      } catch (err) {
        console.error('充值失败:', err.message)
        throw err.response?.data?.error || '充值功能暂未开放'
      }
    }
  }
})
