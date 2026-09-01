<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Sun, Moon, Laptop, Check } from 'lucide-vue-next'
import { useThemeStore, type ThemeMode } from '@/stores/themeStore'

const themeStore = useThemeStore()
const isOpen = ref(false)

const themeOptions: Array<{ mode: ThemeMode; label: string; icon: any; desc: string }> = [
  {
    mode: 'light',
    label: 'Light Mode',
    icon: Sun,
    desc: 'Warm Cream & Amber retail canvas',
  },
  {
    mode: 'dark',
    label: 'Dark Mode',
    icon: Moon,
    desc: 'Warm Obsidian & Radiant Amber',
  },
  {
    mode: 'system',
    label: 'System Theme',
    icon: Laptop,
    desc: 'Sync with operating system setting',
  },
]

function selectTheme(mode: ThemeMode) {
  themeStore.setTheme(mode)
  isOpen.value = false
}

function handleOutsideClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.theme-toggle-wrapper')) {
    isOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('click', handleOutsideClick)
})

onUnmounted(() => {
  window.removeEventListener('click', handleOutsideClick)
})
</script>

<template>
  <div class="theme-toggle-wrapper relative">
    <!-- Trigger Button -->
    <button
      type="button"
      class="theme-toggle-btn"
      :class="{ 'theme-toggle-btn--active': isOpen }"
      :title="`Theme: ${themeStore.theme.toUpperCase()} (Click to change)`"
      :aria-label="`Current theme: ${themeStore.theme}. Click to change.`"
      @click="isOpen = !isOpen"
    >
      <Transition name="theme-icon-swap" mode="out-in">
        <Sun v-if="themeStore.theme === 'light'" :size="16" class="theme-icon-sun" />
        <Moon v-else-if="themeStore.theme === 'dark'" :size="16" class="theme-icon-moon" />
        <Laptop v-else :size="16" class="theme-icon-system" />
      </Transition>
    </button>

    <!-- Theme Selection Dropdown Popover -->
    <Transition name="dropdown-pop">
      <div v-if="isOpen" class="theme-dropdown-menu">
        <div class="theme-dropdown-header">
          <span>Interface Theme</span>
        </div>

        <div class="theme-dropdown-list">
          <button
            v-for="opt in themeOptions"
            :key="opt.mode"
            type="button"
            class="theme-dropdown-item"
            :class="{ 'theme-dropdown-item--active': themeStore.theme === opt.mode }"
            @click="selectTheme(opt.mode)"
          >
            <div class="theme-option-icon-wrap" :class="`theme-option-icon-wrap--${opt.mode}`">
              <component :is="opt.icon" :size="15" />
            </div>

            <div class="theme-option-content">
              <div class="theme-option-title-row">
                <span class="theme-option-label">{{ opt.label }}</span>
                <span v-if="opt.mode === 'system'" class="theme-system-tag">Auto</span>
              </div>
              <span class="theme-option-desc">{{ opt.desc }}</span>
            </div>

            <Check
              v-if="themeStore.theme === opt.mode"
              :size="14"
              class="theme-check-icon text-cta"
            />
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.theme-toggle-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--color-border, #E8E2D9);
  background: var(--color-surface-subtle, #FAF7F2);
  color: var(--color-secondary-foreground, #574335);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 150ms ease;
  position: relative;
}

.theme-toggle-btn:hover,
.theme-toggle-btn--active {
  background: var(--color-card, #FFFFFF);
  border-color: var(--color-border-strong, #FFDCC4);
  color: var(--color-cta, #FF8800);
}

.theme-icon-sun {
  color: #D97706;
}

.theme-icon-moon {
  color: #FFB781;
}

.theme-icon-system {
  color: var(--color-muted-foreground, #6B6358);
}

/* Popover Dropdown */
.theme-dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 250px;
  background: var(--color-card, #FFFFFF);
  border: 1px solid var(--color-border, #E8E2D9);
  border-radius: var(--radius-xl, 16px);
  box-shadow: var(--shadow-lg, 0 16px 40px rgba(0, 0, 0, 0.14));
  z-index: 60;
  overflow: hidden;
}

.theme-dropdown-header {
  padding: 10px 14px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-muted-foreground, #6B6358);
  border-bottom: 1px solid var(--color-border, #E8E2D9);
  background: var(--color-surface-subtle, #FAF7F2);
}

.theme-dropdown-list {
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.theme-dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-md, 8px);
  border: 1px solid transparent;
  background: transparent;
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: all 140ms ease;
}

.theme-dropdown-item:hover {
  background-color: var(--color-muted, #FAF7F2);
}

.theme-dropdown-item--active {
  background-color: var(--color-cta-muted, #FFF3E0);
  border-color: var(--color-border, #FFDCC4);
}

.theme-option-icon-wrap {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm, 6px);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.theme-option-icon-wrap--light {
  background: #FFFBEB;
  color: #D97706;
}

.theme-option-icon-wrap--dark {
  background: #2E241A;
  color: #FFB781;
}

.theme-option-icon-wrap--system {
  background: var(--color-muted, #F0EAE1);
  color: var(--color-muted-foreground, #6B6358);
}

.theme-option-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.theme-option-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.theme-option-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-foreground, #1A1C1C);
}

.theme-system-tag {
  font-size: 9.5px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: var(--radius-full, 9999px);
  background: var(--color-muted, #F0EAE1);
  color: var(--color-muted-foreground, #6B6358);
}

.theme-option-desc {
  font-size: 11px;
  color: var(--color-muted-foreground, #6B6358);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.theme-check-icon {
  flex-shrink: 0;
  color: var(--color-cta, #FF8800);
}

/* Transitions */
.theme-icon-swap-enter-active,
.theme-icon-swap-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
}

.theme-icon-swap-enter-from {
  opacity: 0;
  transform: rotate(-30deg) scale(0.8);
}

.theme-icon-swap-leave-to {
  opacity: 0;
  transform: rotate(30deg) scale(0.8);
}

.dropdown-pop-enter-active,
.dropdown-pop-leave-active {
  transition: opacity 140ms cubic-bezier(0.16, 1, 0.3, 1), transform 140ms cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-pop-enter-from,
.dropdown-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}
</style>
