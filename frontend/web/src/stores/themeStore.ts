import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'omnipos_theme'

export const useThemeStore = defineStore('theme', () => {
  // Saved preference in localStorage: 'light' | 'dark' | 'system'
  const savedPreference = (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null) as ThemeMode | null
  const theme = ref<ThemeMode>(savedPreference && ['light', 'dark', 'system'].includes(savedPreference) ? savedPreference : 'light')

  // Reactive flag tracking system preference (prefers-color-scheme: dark)
  const systemPrefersDark = ref<boolean>(false)

  // Initialize system media query listener
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    systemPrefersDark.value = mediaQuery.matches

    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      systemPrefersDark.value = e.matches
      if (theme.value === 'system') {
        applyThemeToDOM()
      }
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange)
    } else if (mediaQuery.addListener) {
      // Compatibility for older browser engines
      mediaQuery.addListener(handleSystemThemeChange)
    }
  }

  // Active theme calculation (resolves 'system' into true/false dark mode)
  const isDark = computed<boolean>(() => {
    if (theme.value === 'dark') return true
    if (theme.value === 'light') return false
    return systemPrefersDark.value
  })

  // Apply dark mode class to HTML document root
  function applyThemeToDOM() {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    if (isDark.value) {
      root.classList.add('dark')
      root.style.colorScheme = 'dark'
    } else {
      root.classList.remove('dark')
      root.style.colorScheme = 'light'
    }
  }

  // Set specific theme mode
  function setTheme(mode: ThemeMode) {
    theme.value = mode
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, mode)
    }
    applyThemeToDOM()
  }

  // Quick toggle between light and dark
  function toggleTheme() {
    if (theme.value === 'light') {
      setTheme('dark')
    } else if (theme.value === 'dark') {
      setTheme('light')
    } else {
      // If currently on system, toggle to the opposite of resolved isDark
      setTheme(isDark.value ? 'light' : 'dark')
    }
  }

  // Lifecycle initialization
  function initTheme() {
    if (typeof window !== 'undefined' && window.matchMedia) {
      systemPrefersDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    applyThemeToDOM()
  }

  return {
    theme,
    isDark,
    systemPrefersDark,
    setTheme,
    toggleTheme,
    initTheme,
    applyThemeToDOM,
  }
})
