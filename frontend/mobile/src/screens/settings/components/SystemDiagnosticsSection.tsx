import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../SettingsScreen.styles'

export interface HealthStatus {
  connected: boolean
  status?: string
  version?: string
  app?: string
  database?: string
}

export interface SystemDiagnosticsSectionProps {
  healthStatus: HealthStatus
  healthLoading: boolean
  pendingCount: number
  isSyncing: boolean
  onCheckBackendHealth: () => void
  onSyncOffline: () => void
}

export const SystemDiagnosticsSection: React.FC<SystemDiagnosticsSectionProps> = ({
  healthStatus,
  healthLoading,
  pendingCount,
  isSyncing,
  onCheckBackendHealth,
  onSyncOffline,
}) => {
  return (
    <>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>System Diagnostics</Text>
        <Text style={styles.sectionSubtitle}>Live health & data synchronization</Text>
      </View>

      <View style={styles.diagnosticsCard}>
        {/* Backend API Health Status */}
        <View style={styles.diagnosticRow}>
          <View style={styles.diagnosticLeft}>
            <View
              style={[
                styles.diagnosticIconCircle,
                healthStatus.connected ? styles.diagSuccess : styles.diagError,
              ]}
            >
              <Ionicons
                name={healthStatus.connected ? 'server-outline' : 'cloud-offline-outline'}
                size={18}
                color={healthStatus.connected ? tokens.colors.statusSuccess : tokens.colors.statusError}
              />
            </View>
            <View>
              <Text style={styles.diagnosticLabel}>Backend API Connectivity</Text>
              <Text style={styles.diagnosticSub}>
                {healthStatus.status} ({healthStatus.version}) • {healthStatus.database}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.refreshHealthBtn}
            onPress={onCheckBackendHealth}
            disabled={healthLoading}
            activeOpacity={0.7}
          >
            {healthLoading ? (
              <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
            ) : (
              <Ionicons name="refresh" size={16} color={tokens.colors.primaryContainer} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Offline Queue Status */}
        <View style={styles.diagnosticRow}>
          <View style={styles.diagnosticLeft}>
            <View
              style={[
                styles.diagnosticIconCircle,
                pendingCount > 0 ? styles.diagWarning : styles.diagSuccess,
              ]}
            >
              <Ionicons
                name={pendingCount > 0 ? 'sync-outline' : 'checkmark-done-outline'}
                size={18}
                color={pendingCount > 0 ? tokens.colors.statusPending : tokens.colors.statusSuccess}
              />
            </View>
            <View>
              <Text style={styles.diagnosticLabel}>Offline Sync Queue</Text>
              <Text style={styles.diagnosticSub}>
                {pendingCount === 0
                  ? 'All local mutations synced to server'
                  : `${pendingCount} order(s) pending sync`}
              </Text>
            </View>
          </View>

          {pendingCount > 0 && (
            <TouchableOpacity
              style={styles.syncNowBtn}
              onPress={onSyncOffline}
              disabled={isSyncing}
              activeOpacity={0.8}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
              ) : (
                <Text style={styles.syncNowBtnText}>Sync Now</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.divider} />

        {/* App Version Info */}
        <View style={styles.diagnosticRow}>
          <View style={styles.diagnosticLeft}>
            <View style={[styles.diagnosticIconCircle, styles.diagNeutral]}>
              <Ionicons name="phone-portrait-outline" size={18} color={tokens.colors.secondary} />
            </View>
            <View>
              <Text style={styles.diagnosticLabel}>KC Inventory Mobile</Text>
              <Text style={styles.diagnosticSub}>Version 1.0.0 (Build 2026.08.22)</Text>
            </View>
          </View>
        </View>
      </View>
    </>
  )
}
