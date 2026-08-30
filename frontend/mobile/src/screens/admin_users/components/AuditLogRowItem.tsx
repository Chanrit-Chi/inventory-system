import React from 'react'
import { View, Text, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import type { AuditLogEntry } from '../../../api/endpoints'
import { styles } from '../AdminUsersScreen.styles'

export function getAuditActionMeta(action: string = '', category: string = '') {
  const act = action.toUpperCase()
  const cat = category.toUpperCase()

  if (act.includes('LOGIN') || act.includes('AUTH') || act.includes('LOGOUT') || cat === 'SECURITY') {
    return {
      icon: 'shield-checkmark' as const,
      color: tokens.colors.primaryContainer,
      bg: tokens.colors.actionPrimaryBg,
      badgeBg: '#EDE9FE',
      badgeText: '#5B21B6',
    }
  }
  if (
    act.includes('STOCK') ||
    act.includes('ADJUST') ||
    act.includes('RESTOCK') ||
    act.includes('INVENTORY') ||
    cat === 'INVENTORY'
  ) {
    return {
      icon: 'cube' as const,
      color: '#EA580C',
      bg: '#FFF7ED',
      badgeBg: '#FFEDD5',
      badgeText: '#C2410C',
    }
  }
  if (act.includes('ORDER') || act.includes('SALE') || act.includes('POS') || cat === 'ORDERS') {
    return {
      icon: 'cart' as const,
      color: '#0284C7',
      bg: '#F0F9FF',
      badgeBg: '#E0F2FE',
      badgeText: '#0369A1',
    }
  }
  if (act.includes('INVOICE') || act.includes('BILL') || act.includes('EXPENSE') || cat === 'BILLING') {
    return {
      icon: 'receipt' as const,
      color: '#059669',
      bg: '#ECFDF5',
      badgeBg: '#D1FAE5',
      badgeText: '#047857',
    }
  }
  if (
    act.includes('USER') ||
    act.includes('ROLE') ||
    act.includes('PERM') ||
    act.includes('STAFF') ||
    cat === 'STAFF'
  ) {
    return {
      icon: 'people' as const,
      color: '#7C3AED',
      bg: '#F5F3FF',
      badgeBg: '#EDE9FE',
      badgeText: '#6D28D9',
    }
  }
  return {
    icon: 'time' as const,
    color: tokens.colors.secondary,
    bg: tokens.colors.surfaceMuted,
    badgeBg: tokens.colors.surfaceMuted,
    badgeText: tokens.colors.secondary,
  }
}

function formatAuditTime(rawTime?: string | null, occurredAt?: string | null, createdAt?: string | null): string {
  const ts = occurredAt || createdAt || rawTime
  if (!ts) return 'Recent'
  try {
    const d = new Date(ts)
    if (isNaN(d.getTime())) return rawTime || ts
    const now = new Date()
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000)
    if (diffSec < 45) return 'Just now'
    if (diffSec < 3600) return `${Math.max(1, Math.floor(diffSec / 60))}m ago`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return rawTime || ts || 'Recent'
  }
}

export interface AuditLogRowItemProps {
  log: AuditLogEntry
}

export const AuditLogRowItem: React.FC<AuditLogRowItemProps> = React.memo(({ log }) => {
  const actionName = log.action || 'SYSTEM_EVENT'
  const categoryName = log.category || 'GENERAL'
  const meta = getAuditActionMeta(actionName, categoryName)

  const actorName = log.actor_name || log.by || 'System'
  const actorRole = log.actor_role
  const displayTime = formatAuditTime(log.time, log.occurred_at, log.created_at)

  const metadata = log.metadata || {}
  const ipAddress =
    log.ip ||
    metadata.ip ||
    (log.details?.includes('IP: ') ? log.details.split('IP: ')[1]?.split(' ')[0] : null)
  const deviceName =
    log.device ||
    metadata.device ||
    (log.details?.includes('Device: ') ? log.details.split('Device: ')[1]?.split(' •')[0] : null)

  const targetText = log.target || log.details || 'System Activity'

  // Clean details text if it is just a duplicate of device/IP
  const isSecurity = categoryName.toUpperCase() === 'SECURITY' || actionName.toUpperCase().includes('LOGIN')
  const detailsText = log.details && !log.details.startsWith('Device:') ? log.details : null

  return (
    <View style={styles.auditCard}>
      {/* 1. Header Row: Action Icon + Badge + Timestamp */}
      <View style={styles.auditCardTop}>
        <View style={[styles.auditCardIconBox, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={18} color={meta.color} />
        </View>

        <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <View style={[styles.auditActionBadge, { backgroundColor: meta.badgeBg }]}>
              <Text style={[styles.auditActionBadgeText, { color: meta.badgeText }]}>
                {actionName.replace(/_/g, ' ')}
              </Text>
            </View>
            <Text style={styles.auditTimeText}>{displayTime}</Text>
          </View>

          {/* Main Target / Event Description */}
          <Text style={styles.auditTargetText} numberOfLines={2}>
            {targetText}
          </Text>
        </View>
      </View>

      {/* 2. Structured Security & Metadata Pills (Device + IP Address) */}
      {(Boolean(ipAddress) || Boolean(deviceName)) && (
        <View style={styles.auditPillsRow}>
          {Boolean(deviceName) && (
            <View style={styles.auditDevicePill}>
              <Ionicons name="phone-portrait-outline" size={12} color="#4F46E5" />
              <Text style={styles.auditDevicePillText}>{deviceName}</Text>
            </View>
          )}
          {Boolean(ipAddress) && (
            <View style={styles.auditIpPill}>
              <Ionicons name="globe-outline" size={12} color="#0284C7" />
              <Text style={styles.auditIpPillText}>IP: {ipAddress}</Text>
            </View>
          )}
        </View>
      )}

      {/* 3. Details description if present */}
      {Boolean(detailsText && detailsText !== targetText) && (
        <View style={{ marginTop: 6, backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
          <Text style={{ fontSize: 11, color: tokens.colors.secondary, lineHeight: 15 }} numberOfLines={3}>
            {detailsText}
          </Text>
        </View>
      )}

      {/* 4. Bottom Footer: Actor & Role Badge */}
      <View style={styles.auditCardDivider} />
      <View style={styles.auditCardBottom}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}>
          <Ionicons name="person-circle-outline" size={15} color={tokens.colors.secondary} />
          <Text style={styles.auditActorText} numberOfLines={1}>
            By: <Text style={{ fontWeight: '700', color: tokens.colors.onBackground }}>{actorName}</Text>
          </Text>
          {Boolean(actorRole) && (
            <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={{ fontSize: 9.5, fontWeight: '800', color: tokens.colors.secondary, textTransform: 'uppercase' }}>
                {actorRole}
              </Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: meta.color }} />
          <Text style={{ fontSize: 10, fontWeight: '700', color: meta.color }}>{categoryName}</Text>
        </View>
      </View>
    </View>
  )
})

export default AuditLogRowItem
