<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import api from '@/api/axios'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import Toast from '@/components/ui/Toast.vue'
import AppSidebar from '@/components/shell/AppSidebar.vue'
import AppHeader from '@/components/shell/AppHeader.vue'
import CommandPalette from '@/components/shell/CommandPalette.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const themeStore = useThemeStore()

// Check if currently on authentication route (login/register)
const isAuthRoute = computed(() => {
  return route.path === '/login' || route.name === 'login'
})

// Collapsible Sidebar State (persisted to localStorage)
const isSidebarCollapsed = ref<boolean>(
  window.innerWidth < 1024 ? true : localStorage.getItem('omnipos_sidebar_collapsed') === 'true'
)

function toggleSidebar() {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
  if (window.innerWidth >= 1024) {
    localStorage.setItem('omnipos_sidebar_collapsed', String(isSidebarCollapsed.value))
  }
}

// Auto-collapse sidebar on route changes for small screens
watch(() => route.path, () => {
  if (window.innerWidth < 1024) {
    isSidebarCollapsed.value = true
  }
})

// Global Command Palette (Ctrl+K) State
const isCommandPaletteOpen = ref(false)

function openCommandPalette() {
  isCommandPaletteOpen.value = true
}

// Store Branding State (Synced across devices)
export interface StoreBranding {
  store_name: string
  tagline?: string
  logo_url?: string | null
}

const branding = ref<StoreBranding>({
  store_name: localStorage.getItem('omnipos_store_name') || 'KC Inventory',
  tagline: localStorage.getItem('omnipos_tagline') || 'Omnichannel Retail Suite',
  logo_url: localStorage.getItem('omnipos_logo_url') || '/logo.png',
})

async function fetchBranding() {
  try {
    const res = await api.get('/settings/branding')
    if (res.data?.data) {
      const data = res.data.data
      branding.value = {
        store_name: data.store_name || 'KC Inventory',
        tagline: data.tagline || 'Omnichannel Retail Suite',
        logo_url: data.logo_url || '/logo.png',
      }
      localStorage.setItem('omnipos_store_name', branding.value.store_name)
      localStorage.setItem('omnipos_tagline', branding.value.tagline || '')
      if (data.logo_url) {
        localStorage.setItem('omnipos_logo_url', data.logo_url)
      }
    }
  } catch {
    // Retain fallback defaults
  }
}

// Logout Handler
function handleLogout() {
  authStore.logout()
  router.push('/login')
}

// Global Keyboard Shortcut: Ctrl+B / Cmd+B to toggle sidebar
function handleGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
    e.preventDefault()
    toggleSidebar()
  }
}

onMounted(() => {
  themeStore.initTheme()
  window.addEventListener('keydown', handleGlobalKeydown)
  fetchBranding()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <!-- Isolated Auth / Login Shell -->
  <div v-if="isAuthRoute" class="app-auth-shell">
    <RouterView />
    <Toast />
  </div>

  <!-- Authenticated Application Shell -->
  <div v-else class="app-layout" :class="{ 'app-layout--collapsed': isSidebarCollapsed }">
    <!-- Backdrop for Mobile Slide-over Drawer (< 1024px) -->
    <div
      v-if="!isSidebarCollapsed"
      class="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-xs transition-opacity"
      @click="isSidebarCollapsed = true"
    />

    <!-- Collapsible Modern Sidebar Navigation -->
    <AppSidebar
      :collapsed="isSidebarCollapsed"
      :branding="branding"
      @close="isSidebarCollapsed = true"
      @logout="handleLogout"
    />

    <!-- Main Content Shell Wrapper -->
    <div
      class="app-main-wrapper"
      :class="{
        'app-main-wrapper--collapsed': isSidebarCollapsed,
        'app-main-wrapper--pos': route.path === '/pos',
      }"
    >
      <!-- Modern Sticky Top Bar -->
      <AppHeader
        :branding="branding"
        :sidebar-collapsed="isSidebarCollapsed"
        @open-search="openCommandPalette"
        @toggle-sidebar="toggleSidebar"
        @logout="handleLogout"
      />

      <!-- Main View Content Area -->
      <main
        class="app-main-content"
        :class="{ 'app-main-content--pos': route.path === '/pos' }"
      >
        <RouterView />
        <Toast />
      </main>
    </div>

    <!-- Global Command Palette (Ctrl+K / Cmd+K / /) -->
    <CommandPalette
      v-model="isCommandPaletteOpen"
      @toggle-sidebar="toggleSidebar"
    />
  </div>
</template>

<style scoped>
.app-auth-shell {
  min-height: 100vh;
  background-color: var(--color-background, #FAF7F2);
  display: flex;
  flex-direction: column;
}

.app-layout {
  display: flex;
  min-height: 100vh;
  background-color: var(--color-background, #FAF7F2);
  color: var(--color-foreground, #1A1C1C);
  position: relative;
}

.app-main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  margin-left: 260px;
  min-height: 100vh;
  transition: margin-left 220ms cubic-bezier(0.4, 0, 0.2, 1);
  background-color: var(--color-background, #FAF7F2);
}

.app-main-wrapper--collapsed {
  margin-left: 72px;
}

.app-main-content {
  flex: 1;
  padding: 24px 32px 64px;
  max-width: 1440px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

/* Streamlined zero-padding full-height layout for POS view */
.app-main-content--pos {
  padding: 0;
  max-width: none;
  width: 100%;
  height: calc(100vh - 64px);
  overflow: hidden;
}

@media (max-width: 1023px) {
  .app-main-wrapper,
  .app-main-wrapper--collapsed {
    margin-left: 0;
  }
  .app-main-content {
    padding: 16px 16px 48px;
  }
}
</style>
