import { useRef, useState, useCallback } from 'react'
import {
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
} from 'react-native'

export interface UseCollapsibleHeaderOptions {
  initialHeaderHeight?: number
}

export interface UseCollapsibleHeaderReturn {
  scrollY: Animated.Value
  headerTranslateY: Animated.AnimatedInterpolation<number>
  headerOpacity: Animated.AnimatedInterpolation<number>
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  onLayoutHeader: (event: LayoutChangeEvent) => void
  headerHeight: number
}

/**
 * High-performance hook for collapsible headers in React Native.
 * Uses Animated.diffClamp with useNativeDriver: true for silky 60/120fps UI responsiveness.
 *
 * Scrolling down hides the header; a slight scroll up immediately reveals it.
 */
export function useCollapsibleHeader(options: UseCollapsibleHeaderOptions = {}): UseCollapsibleHeaderReturn {
  const { initialHeaderHeight = 110 } = options

  const [headerHeight, setHeaderHeight] = useState<number>(initialHeaderHeight)
  const scrollY = useRef(new Animated.Value(0)).current

  const onLayoutHeader = useCallback(
    (event: LayoutChangeEvent) => {
      const { height } = event.nativeEvent.layout
      if (height > 0 && Math.abs(height - headerHeight) > 1) {
        setHeaderHeight(height)
      }
    },
    [headerHeight]
  )

  const onScroll = useRef(
    Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      { useNativeDriver: true }
    )
  ).current

  const effectiveHeight = Math.max(headerHeight, 1)

  const diffClamp = Animated.diffClamp(scrollY, 0, effectiveHeight)

  const headerTranslateY = diffClamp.interpolate({
    inputRange: [0, effectiveHeight],
    outputRange: [0, -effectiveHeight],
    extrapolate: 'clamp',
  })

  const headerOpacity = diffClamp.interpolate({
    inputRange: [0, effectiveHeight * 0.7, effectiveHeight],
    outputRange: [1, 0.3, 0],
    extrapolate: 'clamp',
  })

  return {
    scrollY,
    headerTranslateY,
    headerOpacity,
    onScroll,
    onLayoutHeader,
    headerHeight,
  }
}
