<template>
  <div id="app">
    <NavBar />
    <div class="main">
      <router-view />
    </div>
    <AuthModal />
    <ToastNotification />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth.js'
import NavBar from './components/NavBar.vue'
import AuthModal from './components/AuthModal.vue'
import ToastNotification from './components/ToastNotification.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

onMounted(() => {
  auth.initAxios()
  if (auth.token) {
    auth.checkAuth()
  }
})
</script>
