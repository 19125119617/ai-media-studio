<template>
  <div id="auth-overlay" v-if="show">
    <div class="auth-box">
      <div class="auth-logo">✦</div>
      <div class="auth-title">AI 创作工坊</div>
      <div class="auth-sub">阿里云万相驱动 · 图像与视频生成</div>

      <div class="auth-tabs">
        <button :class="['auth-tab', { active: mode === 'login' }]" @click="mode = 'login'">登 录</button>
        <button :class="['auth-tab', { active: mode === 'register' }]" @click="mode = 'register'">注 册</button>
      </div>

      <form class="auth-form" @submit.prevent="submit">
        <input v-if="mode === 'register'" v-model="nick" type="text" placeholder="昵称（可选）" class="optional">
        <input v-model="email" type="email" placeholder="邮箱地址" required>
        <input v-model="password" type="password" placeholder="密码（至少6位）" required minlength="6">
        <div class="auth-error">{{ error }}</div>
        <button type="submit" class="btn-primary" :disabled="loading">{{ mode === 'login' ? '登 录' : '注 册' }}</button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()

const mode = ref('login')
const email = ref('')
const password = ref('')
const nick = ref('')
const error = ref('')
const loading = ref(false)
const show = computed(() => !auth.isLoggedIn)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    let ok
    if (mode.value === 'login') {
      ok = await auth.login(email.value, password.value)
    } else {
      ok = await auth.register(email.value, password.value, nick.value)
    }
    if (ok) {
      // 登录成功，Vue Router 会自动更新
    }
  } catch (e) {
    error.value = e.message || '操作失败'
  } finally {
    loading.value = false
  }
}
</script>
