import React from 'react'
import { View, Text } from 'react-native'
import { Image } from 'expo-image'
import { styles } from '../SettingsScreen.styles'
import type { StoreBranding } from '../../../types'

export interface StoreHeaderCardProps {
  branding: StoreBranding
}

export const StoreHeaderCard: React.FC<StoreHeaderCardProps> = ({ branding }) => {
  return (
    <View style={styles.storeCard}>
      <View style={styles.storeCardLeft}>
        <View style={styles.storeLogoBox}>
          {branding.logo_url ? (
            <Image
              source={{ uri: branding.logo_url }}
              style={{ width: 44, height: 44, borderRadius: 8 }}
              contentFit="contain"
            />
          ) : (
            <Image
              source={require('../../../../assets/KC SHOP-No BG.png')}
              style={{ width: 44, height: 44 }}
              contentFit="contain"
            />
          )}
        </View>
        <View style={styles.storeInfo}>
          <View style={styles.storeNameRow}>
            <Text style={styles.storeName}>{branding.store_name || 'KC Inventory'}</Text>
            <View style={styles.storeIdBadge}>
              <Text style={styles.storeIdText}>Store #01</Text>
            </View>
          </View>
          <Text style={styles.storeAddress}>
            {branding.tagline || branding.store_address || 'Omnichannel Retail Suite'}
          </Text>
          <View style={styles.terminalStatusRow}>
            <View style={styles.activeDot} />
            <Text style={styles.terminalStatusText}>Cloud Synced • Active</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
