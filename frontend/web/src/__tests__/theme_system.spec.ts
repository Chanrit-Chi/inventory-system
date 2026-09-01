import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import fs from 'fs'
import path from 'path'
import { useThemeStore } from '@/stores/themeStore'
import ThemeToggle from '@/components/shell/ThemeToggle.vue'
import SettingsView from '@/views/SettingsView.vue'

describe('OmniPOS Dark Mode & Theme System', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    document.documentElement.className = ''
    document.documentElement.style.colorScheme = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================================================
  // 1. Theme Store State & DOM Sync
  // ============================================================================
  describe('Theme Store State Management', () => {
    it('initializes with default light mode if no stored preference exists', () => {
      const store = useThemeStore()
      expect(store.theme).toBe('light')
      expect(store.isDark).toBe(false)
    })

    it('loads existing preference from localStorage on initialization', () => {
      localStorage.setItem('omnipos_theme', 'dark')
      const store = useThemeStore()
      expect(store.theme).toBe('dark')
      expect(store.isDark).toBe(true)
    })

    it('switches to dark mode, updates localStorage, and applies .dark to <html>', () => {
      const store = useThemeStore()
      store.setTheme('dark')

      expect(store.theme).toBe('dark')
      expect(store.isDark).toBe(true)
      expect(localStorage.getItem('omnipos_theme')).toBe('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
      expect(document.documentElement.style.colorScheme).toBe('dark')
    })

    it('switches back to light mode and removes .dark from <html>', () => {
      const store = useThemeStore()
      store.setTheme('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)

      store.setTheme('light')
      expect(store.theme).toBe('light')
      expect(store.isDark).toBe(false)
      expect(localStorage.getItem('omnipos_theme')).toBe('light')
      expect(document.documentElement.classList.contains('dark')).toBe(false)
      expect(document.documentElement.style.colorScheme).toBe('light')
    })

    it('toggles cleanly between light and dark modes', () => {
      const store = useThemeStore()
      expect(store.theme).toBe('light')

      store.toggleTheme()
      expect(store.theme).toBe('dark')
      expect(store.isDark).toBe(true)
      expect(document.documentElement.classList.contains('dark')).toBe(true)

      store.toggleTheme()
      expect(store.theme).toBe('light')
      expect(store.isDark).toBe(false)
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('handles system theme mode correctly', () => {
      const store = useThemeStore()
      store.systemPrefersDark = true
      store.setTheme('system')

      expect(store.theme).toBe('system')
      expect(store.isDark).toBe(true)
      expect(document.documentElement.classList.contains('dark')).toBe(true)

      store.systemPrefersDark = false
      store.applyThemeToDOM()
      expect(store.isDark).toBe(false)
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })
  })

  // ============================================================================
  // 2. CSS Custom Properties & Dark Mode Palette Compliance
  // ============================================================================
  describe('CSS Custom Properties & Color Contrast Compliance', () => {
    it('verifies style.css contains the complete .dark block and tokens', () => {
      const styleCssPath = path.resolve(__dirname, '../style.css')
      expect(fs.existsSync(styleCssPath)).toBe(true)
      const cssContent = fs.readFileSync(styleCssPath, 'utf-8')

      // Check key dark tokens
      expect(cssContent).toContain('.dark {')
      expect(cssContent).toContain('--color-background:                 #14120E')
      expect(cssContent).toContain('--color-foreground:                 #EDE6DD')
      expect(cssContent).toContain('--color-card:                       #1E1B17')
      expect(cssContent).toContain('--color-border:                     #332C25')
      expect(cssContent).toContain('--color-cta:                        #FF941A')
      expect(cssContent).toContain('--color-primary:                    #FFB781')
    })

    it('verifies WCAG AAA / AA contrast ratios for dark mode colors', () => {
      function getLuminance(r: number, g: number, b: number) {
        const a = [r, g, b].map((v) => {
          v /= 255
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
        })
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722
      }

      function getContrastRatio(hex1: string, hex2: string) {
        const rgb1 = hex1.replace('#', '').match(/.{2}/g)!.map((x) => parseInt(x, 16))
        const rgb2 = hex2.replace('#', '').match(/.{2}/g)!.map((x) => parseInt(x, 16))
        const l1 = getLuminance(rgb1[0], rgb1[1], rgb1[2])
        const l2 = getLuminance(rgb2[0], rgb2[1], rgb2[2])
        const lighter = Math.max(l1, l2)
        const darker = Math.min(l1, l2)
        return (lighter + 0.05) / (darker + 0.05)
      }

      // Foreground text (#EDE6DD) on Obsidian Dark Canvas (#14120E) -> Must be > 7:1 (WCAG AAA)
      const textToDarkCanvas = getContrastRatio('#EDE6DD', '#14120E')
      expect(textToDarkCanvas).toBeGreaterThan(7.0)

      // Foreground text (#EDE6DD) on Elevated Card (#1E1B17) -> Must be > 7:1 (WCAG AAA)
      const textToDarkCard = getContrastRatio('#EDE6DD', '#1E1B17')
      expect(textToDarkCard).toBeGreaterThan(7.0)

      // Amber Primary (#FFB781) on Dark Card (#1E1B17) -> Must be > 4.5:1 (WCAG AA)
      const primaryToDarkCard = getContrastRatio('#FFB781', '#1E1B17')
      expect(primaryToDarkCard).toBeGreaterThan(4.5)

      // CTA Orange (#FF941A) on Obsidian Background (#14120E) -> Must be > 4.5:1 (WCAG AA)
      const ctaToDarkBg = getContrastRatio('#FF941A', '#14120E')
      expect(ctaToDarkBg).toBeGreaterThan(4.5)
    })
  })

  // ============================================================================
  // 3. UI Component Integration
  // ============================================================================
  describe('ThemeToggle UI Component', () => {
    it('renders trigger button and toggles dropdown on click', async () => {
      const wrapper = mount(ThemeToggle)

      const btn = wrapper.find('.theme-toggle-btn')
      expect(btn.exists()).toBe(true)
      expect(wrapper.find('.theme-dropdown-menu').exists()).toBe(false)

      await btn.trigger('click')
      expect(wrapper.find('.theme-dropdown-menu').exists()).toBe(true)

      const items = wrapper.findAll('.theme-dropdown-item')
      expect(items.length).toBe(3) // Light, Dark, System
    })

    it('selects dark mode when dark option is clicked in ThemeToggle', async () => {
      const wrapper = mount(ThemeToggle)
      const store = useThemeStore()

      await wrapper.find('.theme-toggle-btn').trigger('click')
      const items = wrapper.findAll('.theme-dropdown-item')
      
      // Click dark option (second item)
      await items[1].trigger('click')
      expect(store.theme).toBe('dark')
      expect(store.isDark).toBe(true)
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })
  })

  describe('SettingsView Appearance Controls', () => {
    it('renders appearance theme tiles in Branding & Appearance tab', async () => {
      const wrapper = mount(SettingsView, {
        global: {
          stubs: {
            teleport: true,
            Toast: true,
          },
        },
      })

      // Branding & Appearance is the default tab
      expect(wrapper.text()).toContain('Interface Appearance')
      expect(wrapper.text()).toContain('Light Mode')
      expect(wrapper.text()).toContain('Dark Mode')
      expect(wrapper.text()).toContain('System Default')
    })
  })

  // ============================================================================
  // 4. POS Terminal Dark Mode Tokenization Compliance
  // ============================================================================
  describe('POS Terminal Dark Mode Compliance', () => {
    it('verifies POSView.vue has no arbitrary hex classes in template', () => {
      const posViewPath = path.resolve(__dirname, '../views/POSView.vue')
      expect(fs.existsSync(posViewPath)).toBe(true)
      const content = fs.readFileSync(posViewPath, 'utf-8')
      const template = content.split('</template>')[0]

      // Ensure no raw arbitrary hex colors in class attributes
      const hexClassMatches = template.match(/(?:bg|text|border|ring)-\[#[0-9A-Fa-f]{3,6}\]/g) || []
      expect(hexClassMatches).toEqual([])
    })

    it('verifies POS modals use semantic theme variables', () => {
      const modals = [
        '../components/pos/PosCheckoutModal.vue',
        '../components/pos/CustomerLookupRow.vue',
        '../components/pos/CustomerLookupModal.vue',
        '../components/pos/PosVariantModal.vue',
        '../components/pos/PosHoldOrdersModal.vue',
        '../components/pos/PosItemNoteModal.vue',
        '../components/pos/SellerPickerModal.vue',
        '../components/pos/PosCustomerModal.vue',
        '../components/pos/PosReceiptModal.vue',
        '../components/pos/DeliveryZonePickerModal.vue',
      ]

      for (const modalRel of modals) {
        const modalPath = path.resolve(__dirname, modalRel)
        expect(fs.existsSync(modalPath)).toBe(true)
        const content = fs.readFileSync(modalPath, 'utf-8')
        const template = content.split('</template>')[0]

        // Ensure no legacy hardcoded hex classes
        const hexClassMatches = template.match(/(?:bg|text|border|ring)-\[#[0-9A-Fa-f]{3,6}\]/g) || []
        expect(hexClassMatches).toEqual([])
      }
    })
  })
})
