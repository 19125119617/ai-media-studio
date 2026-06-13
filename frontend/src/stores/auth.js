import { defineStore } from 'pinia'
import axios from 'axios'

function safeJSONParse(str) {
  try { return JSON.parse(str) } catch { return null }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    currentUser: safeJSONParse(localStorage.getItem('currentUser')),
    loading: false,
    error: null
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
    isAdmin: (state) => state.currentUser?.isAdmin || false
  },
  actions: {
    async login(email, password) {
      this.loading = true
      this.error = null
      try {
        const res = await axios.post('/api/auth/login', { email, password })
        this.token = res.data.token
        this.currentUser = res.data.user
        localStorage.setItem('token', this.token)
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser))
        axios.defaults.headers.common['Authorization'] = 'Bearer ' + this.token
        return true
      } catch (err) {
        this.error = err.response?.data?.error || '登录失败'
        return false
      } finally {
        this.loading = false
      }
    },
    async register(email, password, nickname) {
      this.loading = true
      this.error = null
      try {
        const body = { email, password }
        if (nickname) body.nickname = nickname
        const res = await axios.post('/api/auth/register', body)
        this.token = res.data.token
        this.currentUser = res.data.user
        localStorage.setItem('token', this.token)
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser))
        axios.defaults.headers.common['Authorization'] = 'Bearer ' + this.token
        return true
      } catch (err) {
        this.error = err.response?.data?.error || '注册失败'
        return false
      } finally {
        this.loading = false
      }
    },
    logout() {
      this.token = ''
      this.currentUser = null
      localStorage.removeItem('token')
      localStorage.removeItem('currentUser')
      delete axios.defaults.headers.common['Authorization']
    },
    async checkAuth() {
      if (!this.token) return false
      try {
        const res = await axios.get('/api/auth/me', {
          headers: { 'Authorization': 'Bearer ' + this.token }
        })
        this.currentUser = res.data.user
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser))
        return true
      } catch (err) {
        this.logout()
        return false
      }
    },
    initAxios() {
      if (this.token) {
        axios.defaults.headers.common['Authorization'] = 'Bearer ' + this.token
      }
    }
  }
})
