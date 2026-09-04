import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { tokens } from '../theme/tokens'

interface SplashScreenProps {
  storeName?: string | null
  logoUrl?: string | null
  subtitle?: string | null
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  storeName = 'KC Shop',
  logoUrl,
  subtitle = 'Inventory & Point of Sale',
}) => {
  const fadeAnim = useRef(new Animated.Value(0.1)).current
  const scaleAnim = useRef(new Animated.Value(0.95)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start()
  }, [fadeAnim, scaleAnim])

  const hasRemoteLogo = Boolean(logoUrl && typeof logoUrl === 'string' && logoUrl.startsWith('http'))

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" />

      {/* Decorative subtle background gradient aura */}
      <View style={styles.topAccentBar} />

      <Animated.View
        style={[
          styles.contentBox,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* LOGO HERO */}
        <View style={styles.logoContainer}>
          <Image
            source={
              hasRemoteLogo
                ? { uri: logoUrl as string }
                : require('../../assets/KC SHOP-No BG.png')
            }
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* APP BRAND TITLES */}
        <Text style={styles.brandTitle} numberOfLines={1}>
          {storeName}
        </Text>
        <Text style={styles.brandSubtitle}>
          {subtitle}
        </Text>

        {/* LOADING INDICATOR */}
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color={tokens.colors.primaryContainer} />
        </View>
      </Animated.View>

      {/* FOOTER METADATA */}
      <View style={styles.footer}>
        <Text style={styles.footerBadge}>KC INVENTORY SYSTEM</Text>
        <Text style={styles.footerVersion}>v1.0.0 • Cloud POS & Warehouse</Text>
      </View>
    </View>
  )
}

const { width } = Dimensions.get('window')

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: tokens.colors.primaryContainer,
  },
  contentBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    maxWidth: width * 0.85,
  },
  logoContainer: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: 150,
    height: 150,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  brandSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  loaderContainer: {
    marginTop: 32,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.colors.primaryContainer,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  footerVersion: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
  },
})
