<template>
  <div id="toast" :style="{ display: visible ? 'block' : 'none' }">{{ message }}</div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'

const visible = ref(false)
const message = ref('')
let timer = null

function show(msg, duration = 2500) {
  message.value = msg
  visible.value = true
  clearTimeout(timer)
  timer = setTimeout(() => { visible.value = false }, duration)
}

function hide() {
  visible.value = false
  clearTimeout(timer)
}

onUnmounted(() => clearTimeout(timer))

// 暴露方法给外部调用
defineExpose({ show, hide })
</script>
