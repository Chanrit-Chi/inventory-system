import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import { useNetworkStatus } from '../../../hooks/useNetworkStatus'
import { tokens } from '../../../theme/tokens'
import { styles } from '../SettingsScreen.styles'

export interface HealthStatus {
  connected: boolean
  status?: string
  version?: string
  app?: string
  database?: string
  databaseDriver?: string
  databaseStatus?: string
  databaseLatencyMs?: number
  latencyMs?: number
  lastChecked?: string
  serverTime?: string
  environment?: string
  phpVersion?: string
  laravelVersion?: string
  queueDriver?: string
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
  const { isDeviceOnline, isBackendReachable } = useNetworkStatus()
  const appVersion = Constants.expoConfig?.version || '1.0.0'
  const deviceModel = Device.modelName || (Platform.OS === 'ios' ? 'iOS Device' : 'Android Device')

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
            <View style={{ flex: 1 }}>
              <Text style={styles.diagnosticLabel}>Backend API Connectivity</Text>
              <Text style={styles.diagnosticSub}>
                {healthStatus.status}
                {healthStatus.latencyMs !== undefined ? ` • ${healthStatus.latencyMs}ms latency` : ''}
                {healthStatus.lastChecked ? ` (checked ${healthStatus.lastChecked})` : ''}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.refreshHealthBtn}
            onPress={onCheckBackendHealth}
            disabled={healthLoading}
            activeOpacity={0.7}
            accessibilityLabel="Refresh system diagnostics"
          >
            {healthLoading ? (
              <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
            ) : (
              <Ionicons name="refresh" size={16} color={tokens.colors.primaryContainer} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Database & Server Runtime */}
        <View style={styles.diagnosticRow}>
          <View style={styles.diagnosticLeft}>
            <View
              style={[
                styles.diagnosticIconCircle,
                healthStatus.connected ? styles.diagSuccess : styles.diagError,
              ]}
            >
              <Ionicons
                name="server"
                size={18}
                color={healthStatus.connected ? tokens.colors.statusSuccess : tokens.colors.statusError}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.diagnosticLabel}>Database & Core Services</Text>
              <Text style={styles.diagnosticSub}>
                {healthStatus.databaseDriver
                  ? `${healthStatus.databaseDriver.toUpperCase()} (${healthStatus.databaseStatus || 'online'}${healthStatus.databaseLatencyMs !== undefined ? ` • ${healthStatus.databaseLatencyMs}ms` : ''})`
                  : (healthStatus.database || 'Database Online')}
                {healthStatus.queueDriver ? ` • Queue: ${healthStatus.queueDriver}` : ''}
                {healthStatus.environment ? ` • ${healthStatus.environment}` : ''}
              </Text>
            </View>
          </View>
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
            <View style={{ flex: 1 }}>
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

        {/* App Version & Network Info */}
        <View style={styles.diagnosticRow}>
          <View style={styles.diagnosticLeft}>
            <View style={[styles.diagnosticIconCircle, isDeviceOnline ? styles.diagSuccess : styles.diagWarning]}>
              <Ionicons
                name={isDeviceOnline ? 'phone-portrait-outline' : 'wifi-outline'}
                size={18}
                color={isDeviceOnline ? tokens.colors.statusSuccess : tokens.colors.statusPending}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.diagnosticLabel}>KC Shop Mobile Client</Text>
              <Text style={styles.diagnosticSub}>
                v{appVersion} • {deviceModel} • {isDeviceOnline ? 'Network Connected' : 'Device Offline'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </>
  )
}
