<template>
  <div class="page">
    <h1 class="page-title">统计概览</h1>
    <p class="page-sub">查看你的使用情况和余额信息</p>

    <!-- Loading -->
    <div v-if="stats.loading" class="empty-state">
      <div class="icon">&#9203;</div>
      <p>正在加载数据...</p>
    </div>

    <!-- Error -->
    <div v-else-if="stats.error" class="empty-state">
      <div class="icon">&#9888;</div>
      <p>{{ stats.error }}</p>
    </div>

    <template v-else>
      <!-- Balance Card -->
      <div class="panel" style="margin-bottom: 24px;">
        <div class="panel-body" style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:12px;color:var(--text2);margin-bottom:4px;">当前余额</div>
            <div style="font-size:36px;font-weight:800;color:var(--purple);">
              ¥{{ accountBalance }}
            </div>
          </div>
          <button class="btn-outline" @click="showRecharge = !showRecharge">充值</button>
        </div>
      </div>

      <!-- Stat Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">🖼️</div>
          <div class="stat-value purple">{{ stats.stats?.textToImageCount ?? 0 }}</div>
          <div class="stat-label">文生图次数</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🎬</div>
          <div class="stat-value teal">{{ stats.stats?.textToVideoCount ?? 0 }}</div>
          <div class="stat-label">文生视频次数</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🔄</div>
          <div class="stat-value amber">{{ stats.stats?.imageToVideoCount ?? 0 }}</div>
          <div class="stat-label">图生视频次数</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💰</div>
          <div class="stat-value purple">{{ stats.stats?.totalCost ?? '0.00' }}</div>
          <div class="stat-label">总消费（元）</div>
        </div>
      </div>

      <!-- Recharge Panel -->
      <div class="panel" v-if="showRecharge">
        <div class="panel-header"><h3>充值余额</h3></div>
        <div class="panel-body">
          <label class="form-label">选择充值金额</label>
          <div class="recharge-grid">
            <button
              v-for="amount in rechargeAmounts"
              :key="amount"
              :class="['recharge-btn', { selected: selectedAmount === amount }]"
              @click="selectedAmount = amount"
            >¥{{ amount }}</button>
          </div>
          <div class="form-hint" style="margin-bottom:12px;">选择后点击下方按钮发起充值</div>
          <button class="btn-primary" :disabled="!selectedAmount" @click="handleRecharge">立即充值 ¥{{ selectedAmount || 0 }}</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useStatsStore } from '../stores/stats.js'
import { useAuthStore } from '../stores/auth.js'

const stats = useStatsStore()
const auth = useAuthStore()

const showRecharge = ref(false)
const selectedAmount = ref(0)

const rechargeAmounts = [10, 30, 50, 100]

const accountBalance = computed(() => (auth.currentUser?.balance || 0).toFixed(2))

function handleRecharge() {
  // TODO: implement recharge
}

onMounted(() => {
  stats.loadStats()
})
</script>

<style scoped>
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
.stat-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 22px; }
.stat-icon { font-size: 24px; margin-bottom: 10px; }
.stat-value { font-size: 28px; font-weight: 700; margin-bottom: 2px; }
.stat-value.purple { color: var(--purple); }
.stat-value.teal { color: var(--teal); }
.stat-value.amber { color: var(--amber); }
.stat-label { font-size: 12px; color: var(--text2); }
.recharge-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
.recharge-btn {
  padding: 12px; border: 1.5px solid var(--border); border-radius: var(--radius-sm);
  background: var(--bg3); color: var(--text); font-size: 14px; font-weight: 600;
  cursor: pointer; text-align: center; transition: all .2s;
}
.recharge-btn:hover { border-color: var(--amber); color: var(--amber); }
.recharge-btn.selected { border-color: var(--amber); background: rgba(245,166,35,.1); color: var(--amber); }
.btn-primary { background: var(--purple); color: #fff; border: none; border-radius: var(--radius-sm); padding: 13px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background .2s; width: 100%; }
.btn-primary:hover { background: var(--purple2); }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; }
.btn-outline {
  background: transparent; border: 1.5px solid var(--border2); color: var(--text2);
  border-radius: var(--radius-sm); padding: 10px 16px; font-size: 13px; cursor: pointer; transition: all .2s;
}
.btn-outline:hover { border-color: var(--purple); color: var(--purple); }
.empty-state { text-align: center; padding: 80px 0; color: var(--text3); }
.empty-state .icon { font-size: 48px; margin-bottom: 14px; }
.empty-state p { font-size: 15px; }

@media (max-width: 900px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
