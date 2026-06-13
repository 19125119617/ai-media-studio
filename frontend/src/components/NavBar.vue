<template>
  <nav class="topnav" v-if="!auth.loading || auth.isLoggedIn">
    <div class="nav-brand">
      <span class="nav-brand-icon">✦</span>
      <span class="nav-brand-text">AI 创作工坊</span>
    </div>
    <div class="nav-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['nav-tab', { active: route.name === tab.id }]"
        @click="go(tab.id)"
      >{{ tab.label }}</button>
    </div>
    <div class="nav-right" v-if="auth.isLoggedIn">
      <div class="nav-balance">
        <span>💰</span>
        <span class="yuan">{{ (auth.currentUser?.balance || 0).toFixed(2) }}</span>
        <span class="sep">元</span>
      </div>
      <div style="position:relative">
        <div class="nav-avatar" @click="showMenu = !showMenu">
          {{ avatarLetter }}
        </div>
        <div class="nav-user-menu" :class="{ show: showMenu }">
          <button @click="go('stats')">📊 统计概览</button>
          <hr style="border:none;border-top:1px solid var(--border);margin:6px 0">
          <button @click="doLogout()">⏻ 退出登录</button>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const showMenu = ref(false)

const tabs = [
  { id: 'home', label: '🤖 API 模型' },
  { id: 'models', label: '📚 模型库' },
  { id: 'create', label: '✨ 创作' },
  { id: 'gallery', label: '🎨 作品库' },
  { id: 'history', label: '📋 历史' },
  { id: 'stats', label: '📊 统计' }
]

const avatarLetter = computed(() =>
  (auth.currentUser?.nickname || auth.currentUser?.email || 'U').charAt(0).toUpperCase()
)

function go(page) {
  showMenu.value = false
  const map = { home: '/', models: '/models', create: '/create', gallery: '/gallery', history: '/history', stats: '/stats' }
  router.push(map[page])
}

function doLogout() {
  auth.logout()
  showMenu.value = false
  router.push('/')
}
</script>
