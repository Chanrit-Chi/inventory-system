import React from 'react'
import {
  TouchableOpacity,
  Animated,
  StyleProp,
  ViewStyle,
} from 'react-native'

export interface SpringScaleCardProps {
  onPress?: () => void
  style?: StyleProp<ViewStyle>
  touchStyle?: StyleProp<ViewStyle>
  children: React.ReactNode
  activeOpacity?: number
  testID?: string
  accessibilityLabel?: string
}

export const SpringScaleCard: React.FC<SpringScaleCardProps> = ({
  onPress,
  style,
  touchStyle,
  children,
  activeOpacity = 0.88,
  testID,
  accessibilityLabel,
}) => {
  const scaleAnim = React.useRef(new Animated.Value(1)).current

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 140,
      useNativeDriver: true,
    }).start()
  }

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        testID={testID}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={activeOpacity}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={touchStyle || { flex: 1 }}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  )
}
