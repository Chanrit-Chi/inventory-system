<script lang="ts">
export interface PlatformMeta {
  type: string
  label: string
  shortCode: string
  color: string
  bg: string
  border: string
  badgeBg: string
  badgeText: string
}

export function getPlatformMeta(platform?: string, name?: string): PlatformMeta {
  const p = (platform || '').toLowerCase().trim()
  const n = (name || '').toLowerCase().trim()

  if (p === 'telegram' || p.includes('tg') || n.includes('telegram')) {
    return {
      type: 'telegram',
      label: 'Telegram',
      shortCode: 'TG',
      color: '#0284C7',
      bg: 'rgba(2, 132, 199, 0.14)',
      border: 'rgba(2, 132, 199, 0.3)',
      badgeBg: 'rgba(2, 132, 199, 0.1)',
      badgeText: '#0284C7',
    }
  }
  if (p === 'facebook' || p.includes('fb') || n.includes('facebook')) {
    return {
      type: 'facebook',
      label: 'Facebook',
      shortCode: 'FB',
      color: '#1877F2',
      bg: 'rgba(24, 119, 242, 0.14)',
      border: 'rgba(24, 119, 242, 0.3)',
      badgeBg: 'rgba(24, 119, 242, 0.1)',
      badgeText: '#1877F2',
    }
  }
  if (p === 'tiktok' || p.includes('tt') || n.includes('tiktok')) {
    return {
      type: 'tiktok',
      label: 'TikTok',
      shortCode: 'TT',
      color: '#FE2C55',
      bg: 'rgba(254, 44, 85, 0.15)',
      border: 'rgba(254, 44, 85, 0.35)',
      badgeBg: 'rgba(254, 44, 85, 0.12)',
      badgeText: '#FE2C55',
    }
  }
  if (p === 'instagram' || p.includes('ig') || n.includes('instagram')) {
    return {
      type: 'instagram',
      label: 'Instagram',
      shortCode: 'IG',
      color: '#E1306C',
      bg: 'rgba(225, 48, 108, 0.14)',
      border: 'rgba(225, 48, 108, 0.3)',
      badgeBg: 'rgba(225, 48, 108, 0.1)',
      badgeText: '#E1306C',
    }
  }
  if (p === 'whatsapp' || p.includes('wa') || n.includes('whatsapp')) {
    return {
      type: 'whatsapp',
      label: 'WhatsApp',
      shortCode: 'WA',
      color: '#16A34A',
      bg: 'rgba(22, 163, 74, 0.14)',
      border: 'rgba(22, 163, 74, 0.3)',
      badgeBg: 'rgba(22, 163, 74, 0.1)',
      badgeText: '#16A34A',
    }
  }
  if (p === 'line' || n.includes('line')) {
    return {
      type: 'line',
      label: 'LINE',
      shortCode: 'LN',
      color: '#059669',
      bg: 'rgba(5, 150, 105, 0.14)',
      border: 'rgba(5, 150, 105, 0.3)',
      badgeBg: 'rgba(5, 150, 105, 0.1)',
      badgeText: '#059669',
    }
  }
  if (p === 'shopee' || n.includes('shopee')) {
    return {
      type: 'shopee',
      label: 'Shopee',
      shortCode: 'SP',
      color: '#EA580C',
      bg: 'rgba(234, 88, 12, 0.14)',
      border: 'rgba(234, 88, 12, 0.3)',
      badgeBg: 'rgba(234, 88, 12, 0.1)',
      badgeText: '#EA580C',
    }
  }
  if (p === 'lazada' || n.includes('lazada')) {
    return {
      type: 'lazada',
      label: 'Lazada',
      shortCode: 'LZ',
      color: '#4338CA',
      bg: 'rgba(67, 56, 202, 0.14)',
      border: 'rgba(67, 56, 202, 0.3)',
      badgeBg: 'rgba(67, 56, 202, 0.1)',
      badgeText: '#6366F1',
    }
  }
  if (p === 'web' || p === 'online' || p === 'website' || n.includes('web') || n.includes('online')) {
    return {
      type: 'web',
      label: 'Webstore',
      shortCode: 'WEB',
      color: '#059669',
      bg: 'rgba(5, 150, 105, 0.14)',
      border: 'rgba(5, 150, 105, 0.3)',
      badgeBg: 'rgba(5, 150, 105, 0.1)',
      badgeText: '#059669',
    }
  }
  if (p === 'wholesale' || p === 'b2b' || n.includes('wholesale') || n.includes('b2b')) {
    return {
      type: 'wholesale',
      label: 'Wholesale',
      shortCode: 'B2B',
      color: '#64748B',
      bg: 'rgba(100, 116, 139, 0.14)',
      border: 'rgba(100, 116, 139, 0.3)',
      badgeBg: 'rgba(100, 116, 139, 0.1)',
      badgeText: '#94A3B8',
    }
  }
  // Default to Store POS
  return {
    type: 'pos',
    label: 'Store POS',
    shortCode: 'POS',
    color: '#FF8800',
    bg: 'rgba(255, 136, 0, 0.14)',
    border: 'rgba(255, 136, 0, 0.3)',
    badgeBg: 'rgba(255, 136, 0, 0.1)',
    badgeText: 'var(--color-primary)',
  }
}
</script>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  platform?: string
  name?: string
  size?: number | string
  colored?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  platform: 'pos',
  name: '',
  size: 16,
  colored: true,
})

const meta = computed(() => getPlatformMeta(props.platform, props.name))

const computedSize = computed(() => {
  if (typeof props.size === 'number') return `${props.size}px`
  if (!props.size.includes('px') && !props.size.includes('rem') && !props.size.includes('em')) {
    return `${props.size}px`
  }
  return props.size
})

const iconFill = computed(() => {
  if (!props.colored) return 'currentColor'
  return meta.value.color
})
</script>

<template>
  <span
    class="inline-flex items-center justify-center shrink-0"
    :style="{ width: computedSize, height: computedSize }"
    :title="meta.label"
  >
    <!-- 1. Facebook Official 'f' Logo -->
    <svg
      v-if="meta.type === 'facebook'"
      viewBox="0 0 24 24"
      class="w-full h-full"
      :fill="iconFill"
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>

    <!-- 2. Telegram Official Paper Plane in Circle -->
    <svg
      v-else-if="meta.type === 'telegram'"
      viewBox="0 0 24 24"
      class="w-full h-full"
      :fill="iconFill"
    >
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.3-.61.3l.213-3.053 5.56-5.023c.242-.213-.054-.334-.373-.121l-6.87 4.326-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.536-.196 1.006.128.834.937z"/>
    </svg>

    <!-- 3. TikTok Official Chromatic Glyph -->
    <svg
      v-else-if="meta.type === 'tiktok'"
      viewBox="0 0 24 24"
      class="w-full h-full"
    >
      <path
        d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.88 2.89 2.89 0 01-2.88-2.88 2.89 2.89 0 012.88-2.88c.4 0 .78.08 1.13.22v-3.52a6.37 6.37 0 00-1.13-.1 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.05a8.27 8.27 0 005.13 1.78v-3.45a4.87 4.87 0 01-1.38-.69z"
        fill="#25F4EE"
        transform="translate(-0.8, -0.8)"
        opacity="0.9"
      />
      <path
        d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.88 2.89 2.89 0 01-2.88-2.88 2.89 2.89 0 012.88-2.88c.4 0 .78.08 1.13.22v-3.52a6.37 6.37 0 00-1.13-.1 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.05a8.27 8.27 0 005.13 1.78v-3.45a4.87 4.87 0 01-1.38-.69z"
        fill="#FE2C55"
        transform="translate(0.8, 0.8)"
        opacity="0.9"
      />
      <path
        d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.88 2.89 2.89 0 01-2.88-2.88 2.89 2.89 0 012.88-2.88c.4 0 .78.08 1.13.22v-3.52a6.37 6.37 0 00-1.13-.1 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.05a8.27 8.27 0 005.13 1.78v-3.45a4.87 4.87 0 01-1.38-.69z"
        fill="currentColor"
      />
    </svg>

    <!-- 4. Instagram Official Camera -->
    <svg
      v-else-if="meta.type === 'instagram'"
      viewBox="0 0 24 24"
      class="w-full h-full"
      :fill="iconFill"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>

    <!-- 5. WhatsApp Official Speech Bubble -->
    <svg
      v-else-if="meta.type === 'whatsapp'"
      viewBox="0 0 24 24"
      class="w-full h-full"
      :fill="iconFill"
    >
      <path d="M12.031 0C5.396 0 .017 5.378.017 12.013c0 2.12.553 4.188 1.603 6.009L0 24l6.155-1.614c1.761.96 3.748 1.466 5.876 1.466 6.635 0 12.014-5.378 12.014-12.013C24.045 5.378 18.666 0 12.031 0zm0 21.986c-1.815 0-3.593-.488-5.143-1.408l-.369-.219-3.824 1.003 1.02-3.727-.24-.382a9.923 9.923 0 01-1.52-5.24c0-5.503 4.478-9.98 9.982-9.98 2.666 0 5.172 1.038 7.058 2.924a9.927 9.927 0 012.923 7.056c0 5.503-4.478 9.98-9.887 9.98zm5.474-7.483c-.3-.15-1.774-.875-2.05-.975-.275-.1-.475-.15-.675.15s-.775.975-.95 1.175-.35.225-.65.075c-.3-.15-1.267-.467-2.413-1.488-.893-.797-1.496-1.78-1.671-2.08-.175-.3-.019-.462.131-.612.135-.135.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525s-.675-1.625-.925-2.225c-.244-.585-.492-.505-.675-.515-.175-.008-.375-.01-.575-.01s-.525.075-.8.375c-.275.3-1.05 1.025-1.05 2.5s1.075 2.9 1.225 3.1c.15.2 2.115 3.23 5.124 4.53.716.31 1.275.495 1.71.633.72.23 1.375.197 1.892.12.576-.086 1.774-.725 2.024-1.425.25-.7.25-1.3.175-1.425-.075-.125-.275-.2-.575-.35z"/>
    </svg>

    <!-- 6. LINE Official Logo -->
    <svg
      v-else-if="meta.type === 'line'"
      viewBox="0 0 24 24"
      class="w-full h-full"
      :fill="iconFill"
    >
      <path d="M24 10.304c0-5.369-5.383-9.738-12-9.738-6.616 0-12 4.369-12 9.738 0 4.814 4.269 8.846 10.035 9.608.391.084.922.258 1.057.592.121.303.079.778.039 1.085l-.171 1.027c-.053.303-.242 1.186 1.039.647 1.281-.54 6.911-4.069 9.428-6.967 1.739-1.907 2.573-3.844 2.573-5.992zM7.228 12.871H5.161V7.728h2.067v5.143zm3.766 0H8.927V7.728h2.067v5.143zm3.766 0h-2.067V7.728h2.067v5.143zm4.512-3.32h-2.067v-.914h2.067v-.909h-3.076v5.143h3.076v-.91h-2.067v-.895h2.067v-.915z"/>
    </svg>

    <!-- 7. Shopee Official Bag -->
    <svg
      v-else-if="meta.type === 'shopee'"
      viewBox="0 0 24 24"
      class="w-full h-full"
      :fill="iconFill"
    >
      <path d="M19.5 7.5h-2.25V6a5.25 5.25 0 00-10.5 0v1.5H4.5A1.5 1.5 0 003 9v11.5A2.5 2.5 0 005.5 23h13a2.5 2.5 0 002.5-2.5V9a1.5 1.5 0 00-1.5-1.5zM8.25 6a3.75 3.75 0 017.5 0v1.5h-7.5V6zm5.85 9.75c0 1.24-1.01 2.25-2.25 2.25-1.07 0-1.95-.75-2.18-1.75h1.56c.12.29.4.5.72.5.41 0 .75-.34.75-.75 0-.32-.21-.6-.5-.69l-1.12-.37c-.89-.3-1.51-1.13-1.51-2.09 0-1.24 1.01-2.25 2.25-2.25 1.07 0 1.95.75 2.18 1.75h-1.56a.8.8 0 00-.72-.5c-.41 0-.75.34-.75.75 0 .32.21.6.5.69l1.12.37c.89.3 1.51 1.13 1.51 2.09z"/>
    </svg>

    <!-- 8. Lazada Official -->
    <svg
      v-else-if="meta.type === 'lazada'"
      viewBox="0 0 24 24"
      class="w-full h-full"
      :fill="iconFill"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5zm0 8.5L4 6.5 12 3.5l8 3-8 4zm-8 3.5l8 4 8-4v3l-8 4-8-4v-3zm0 4.5l8 4 8-4v3l-8 4-8-4v-3z"/>
    </svg>

    <!-- 9. Webstore / Online Website -->
    <svg
      v-else-if="meta.type === 'web'"
      viewBox="0 0 24 24"
      class="w-full h-full"
      fill="none"
      :stroke="iconFill"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>

    <!-- 10. Wholesale / B2B -->
    <svg
      v-else-if="meta.type === 'wholesale'"
      viewBox="0 0 24 24"
      class="w-full h-full"
      fill="none"
      :stroke="iconFill"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>

    <!-- 11. Store POS / Retail Register (Default) -->
    <svg
      v-else
      viewBox="0 0 24 24"
      class="w-full h-full"
      fill="none"
      :stroke="iconFill"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M3 3h18v4H3z"/>
      <path d="M3 7v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7"/>
      <path d="M9 11h6"/>
      <path d="M9 15h6"/>
    </svg>
  </span>
</template>