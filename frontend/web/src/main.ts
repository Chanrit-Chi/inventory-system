import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { router } from './router'
import App from './App.vue'
import './style.css'
import { useAuthStore } from './stores/authStore'

const app = createApp(App)
const pinia = createPinia()

// Initialize auth from localStorage on app start
const authStore = useAuthStore(pinia)
authStore.initAuth()

app.use(pinia)
app.use(router)
app.mount('#app')
