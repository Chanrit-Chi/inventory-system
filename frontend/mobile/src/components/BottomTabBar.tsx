import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../theme/tokens'
import type { TabType } from '../types'
import { usePermissions } from '../hooks/usePermissions'

export interface BottomTabBarProps {
  activeTab: TabType
  onSelectTab: (tab: TabType) => void
  onOpenHub?: () => void
  cartItemCount?: number
  pendingSyncCount?: number
}

interface TabItemConfig {
  key: TabType
  label: string
  activeIcon: keyof typeof Ionicons.glyphMap
  inactiveIcon: keyof typeof Ionicons.glyphMap
  badgeCount?: number
}

interface AnimatedTabButtonProps {
  tab: TabItemConfig
  isActive: boolean
  onPress: () => void
}

const AnimatedTabButton: React.FC<AnimatedTabButtonProps> = ({ tab, isActive, onPress }) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current

  React.useEffect(() => {
    if (isActive) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.92,
          duration: 70,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 140,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [isActive, scaleAnim])

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.94,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 100,
      useNativeDriver: true,
    }).start()
  }

  return (
    <Animated.View style={[{ flex: 1, transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        testID={`tab-${tab.key}`}
        style={[
          styles.tabButton,
          isActive && styles.tabButtonActive,
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.85}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={`${tab.label} tab`}
      >
        <View style={styles.iconWrapper}>
          <Ionicons
            name={isActive ? tab.activeIcon : tab.inactiveIcon}
            size={19}
            color={isActive ? tokens.colors.onPrimary : tokens.colors.secondary}
          />
          {tab.badgeCount !== undefined && tab.badgeCount > 0 && (
            <View
              style={[
                styles.badge,
                isActive ? styles.badgeOnActive : styles.badgeOnInactive,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  isActive ? styles.badgeTextOnActive : styles.badgeTextOnInactive,
                ]}
              >
                {tab.badgeCount > 99 ? '99+' : tab.badgeCount}
              </Text>
            </View>
          )}
        </View>

        <Text
          style={[
            styles.tabLabel,
            isActive ? styles.tabLabelActive : styles.tabLabelInactive,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit={Platform.OS === 'ios'}
          minimumFontScale={0.8}
        >
          {tab.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onSelectTab,
  cartItemCount = 0,
  pendingSyncCount = 0,
}) => {
  const { canAccessTab } = usePermissions()

  const allTabs: TabItemConfig[] = [
    {
      key: 'home',
      label: 'Home',
      activeIcon: 'home',
      inactiveIcon: 'home-outline',
    },
    {
      key: 'pos',
      label: 'Sales',
      activeIcon: 'cart',
      inactiveIcon: 'cart-outline',
      badgeCount: cartItemCount,
    },
    {
      key: 'products',
      label: 'Products',
      activeIcon: 'cube',
      inactiveIcon: 'cube-outline',
    },
    {
      key: 'transactions',
      label: 'Transactions',
      activeIcon: 'receipt',
      inactiveIcon: 'receipt-outline',
      badgeCount: pendingSyncCount > 0 ? pendingSyncCount : undefined,
    },
    {
      key: 'hub',
      label: 'More',
      activeIcon: 'grid',
      inactiveIcon: 'grid-outline',
    },
  ]

  const tabs = allTabs.filter(t => canAccessTab(t.key))

  return (
    <View style={styles.outerContainer}>
      <View style={styles.barContainer}>
        {tabs.map((tab) => (
          <AnimatedTabButton
            key={tab.key}
            tab={tab}
            isActive={activeTab === tab.key}
            onPress={() => onSelectTab(tab.key)}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    borderTopLeftRadius: tokens.borderRadius.navBar,
    borderTopRightRadius: tokens.borderRadius.navBar,
    ...tokens.shadows.bottomNavBar,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderTopLeftRadius: tokens.borderRadius.navBar,
    borderTopRightRadius: tokens.borderRadius.navBar,
    paddingHorizontal: tokens.spacing.xs,
    paddingTop: tokens.spacing.xs + 2,
    paddingBottom: Platform.OS === 'ios' ? tokens.spacing.sm + 4 : tokens.spacing.xs + 2,
    minHeight: 60,
  },
  tabButton: {
    flex: 1,
    minHeight: tokens.touchTarget.minHeight,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: tokens.borderRadius.pill,
    marginHorizontal: 2,
  },
  tabButtonActive: {
    backgroundColor: tokens.colors.primaryContainer,
    paddingHorizontal: 6,
  },
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    lineHeight: 13,
    marginTop: 2,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: tokens.colors.onPrimary,
    fontWeight: '700',
  },
  tabLabelInactive: {
    color: tokens.colors.secondary,
    fontWeight: '500',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeOnActive: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
  },
  badgeOnInactive: {
    backgroundColor: tokens.colors.primaryContainer,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  badgeTextOnActive: {
    color: tokens.colors.primaryContainer,
  },
  badgeTextOnInactive: {
    color: tokens.colors.onPrimary,
  },
})

export default BottomTabBar
