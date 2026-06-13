import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import CreateView from '../views/CreateView.vue'
import GalleryView from '../views/GalleryView.vue'
import HistoryView from '../views/HistoryView.vue'
import StatsView from '../views/StatsView.vue'
import ModelsView from '../views/ModelsView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/create', name: 'create', component: CreateView },
    { path: '/gallery', name: 'gallery', component: GalleryView },
    { path: '/history', name: 'history', component: HistoryView },
    { path: '/stats', name: 'stats', component: StatsView },
    { path: '/models', name: 'models', component: ModelsView },
  ]
})

export default router
