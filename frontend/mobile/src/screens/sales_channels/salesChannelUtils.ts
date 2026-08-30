import { Ionicons } from '@expo/vector-icons'
import type { SalesChannel } from '../../types'

export const PLATFORM_CONFIGS: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }
> = {
  pos: { icon: 'storefront', color: '#FF8800', bg: '#FFF7ED', label: 'Store POS' },
  tiktok: { icon: 'logo-tiktok', color: '#0F172A', bg: '#F1F5F9', label: 'TikTok' },
  facebook: { icon: 'logo-facebook', color: '#1877F2', bg: '#EBF5FF', label: 'Facebook' },
  telegram: { icon: 'paper-plane', color: '#229ED9', bg: '#E0F2FE', label: 'Telegram' },
  instagram: { icon: 'logo-instagram', color: '#E1306C', bg: '#FCE7F3', label: 'Instagram' },
  shopee: { icon: 'cart', color: '#EA580C', bg: '#FFEDD5', label: 'Shopee' },
  lazada: { icon: 'bag-handle', color: '#0F146D', bg: '#EEF2FF', label: 'Lazada' },
  online: { icon: 'globe', color: '#10B981', bg: '#ECFDF5', label: 'Online Web' },
  offline: { icon: 'briefcase', color: '#64748B', bg: '#F8FAFC', label: 'Wholesale B2B' },
  other: { icon: 'layers', color: '#475569', bg: '#F1F5F9', label: 'Other' },
}

export function getChannelPlatformMeta(channel: SalesChannel) {
  if (channel.platform && PLATFORM_CONFIGS[channel.platform]) {
    return PLATFORM_CONFIGS[channel.platform]
  }
  const typeLower = (channel.type || '').toLowerCase()
  if (PLATFORM_CONFIGS[typeLower]) {
    return PLATFORM_CONFIGS[typeLower]
  }
  const nameLower = (channel.name || '').toLowerCase()
  const codeLower = (channel.code || '').toLowerCase()

  if (nameLower.includes('telegram') || codeLower.includes('tg')) return PLATFORM_CONFIGS.telegram
  if (nameLower.includes('facebook') || codeLower.includes('fb')) return PLATFORM_CONFIGS.facebook
  if (nameLower.includes('instagram') || codeLower.includes('ig')) return PLATFORM_CONFIGS.instagram
  if (nameLower.includes('tiktok')) return PLATFORM_CONFIGS.tiktok
  if (nameLower.includes('shopee')) return PLATFORM_CONFIGS.shopee
  if (nameLower.includes('lazada')) return PLATFORM_CONFIGS.lazada
  if (typeLower === 'pos' || nameLower.includes('pos') || nameLower.includes('store')) return PLATFORM_CONFIGS.pos
  if (typeLower === 'online' || nameLower.includes('web') || nameLower.includes('e-commerce')) return PLATFORM_CONFIGS.online
  if (typeLower === 'offline' || nameLower.includes('b2b')) return PLATFORM_CONFIGS.offline
  return PLATFORM_CONFIGS.other
}
