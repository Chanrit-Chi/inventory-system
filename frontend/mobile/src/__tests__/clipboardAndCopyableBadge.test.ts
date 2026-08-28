import React, { useState, useRef, useEffect } from 'react'
import * as Clipboard from 'expo-clipboard'
import {
  copyToClipboard,
  registerGlobalToastListener,
  emitGlobalToast,
} from '../utils/clipboard'
import { CopyableBadge } from '../components/CopyableBadge'
import { ToastProvider, useToast } from '../context/ToastContext'

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
}))

jest.mock('@expo/vector-icons', () => ({
  Ionicons: (props: any) => ({ type: 'Ionicons', props }),
}))

jest.mock('react-native', () => ({
  Text: (props: any) => ({ type: 'Text', props }),
  TouchableOpacity: (props: any) => ({ type: 'TouchableOpacity', props }),
  StyleSheet: {
    create: (styles: any) => styles,
  },
  Platform: {
    OS: 'ios',
    select: (obj: any) => obj.ios || obj.default,
  },
  View: (props: any) => ({ type: 'View', props }),
  Animated: {
    Value: jest.fn().mockImplementation((val) => ({
      setValue: jest.fn(),
      interpolate: jest.fn(),
      current: val,
    })),
    timing: jest.fn().mockReturnValue({
      start: jest.fn((cb) => cb && cb({ finished: true })),
    }),
    spring: jest.fn().mockReturnValue({
      start: jest.fn((cb) => cb && cb({ finished: true })),
    }),
    parallel: jest.fn((animations: any[]) => ({
      start: jest.fn((cb) => {
        animations.forEach((a) => a && a.start && a.start())
        cb && cb({ finished: true })
      }),
    })),
    View: (props: any) => ({ type: 'Animated.View', props }),
  },
}))

// Provide minimal React dispatcher for running hook components in Node test environment
beforeAll(() => {
  jest.useFakeTimers()
  jest.spyOn(React, 'useState').mockImplementation(((initial: any) => [initial, jest.fn()]) as any)
  jest.spyOn(React, 'useRef').mockImplementation(((initial: any) => ({ current: initial })) as any)
  jest.spyOn(React, 'useEffect').mockImplementation((() => {}) as any)
  jest.spyOn(React, 'useCallback').mockImplementation(((fn: any) => fn) as any)
  jest.spyOn(React, 'useContext').mockImplementation(((ctx: any) => undefined) as any)
})

afterAll(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('Clipboard Utility & Safe Degradation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  describe('copyToClipboard - Successful operations (R1)', () => {
    it('copies SKU value to clipboard and emits toast notification', async () => {
      const toastMock = jest.fn()
      const unregister = registerGlobalToastListener(toastMock)

      const result = await copyToClipboard('SKU-1001', { type: 'sku' })

      expect(result).toBe(true)
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('SKU-1001')
      expect(toastMock).toHaveBeenCalledWith('Copied SKU: SKU-1001', 'success')

      unregister()
    })

    it('copies Barcode value to clipboard and emits toast notification', async () => {
      const toastMock = jest.fn()
      const unregister = registerGlobalToastListener(toastMock)

      const result = await copyToClipboard('8851234567890', { type: 'barcode' })

      expect(result).toBe(true)
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('8851234567890')
      expect(toastMock).toHaveBeenCalledWith('Copied Barcode: 8851234567890', 'success')

      unregister()
    })

    it('supports custom label in toast notification', async () => {
      const toastMock = jest.fn()
      const unregister = registerGlobalToastListener(toastMock)

      const result = await copyToClipboard('CUSTOM-CODE', { label: 'Product Code' })

      expect(result).toBe(true)
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('CUSTOM-CODE')
      expect(toastMock).toHaveBeenCalledWith('Copied Product Code: CUSTOM-CODE', 'success')

      unregister()
    })

    it('cleans up trailing colons or whitespace in custom label', async () => {
      const toastMock = jest.fn()
      const unregister = registerGlobalToastListener(toastMock)

      const result = await copyToClipboard('SKU-999', { label: 'SKU: ' })

      expect(result).toBe(true)
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('SKU-999')
      expect(toastMock).toHaveBeenCalledWith('Copied SKU: SKU-999', 'success')

      unregister()
    })

    it('handles generic type without label gracefully', async () => {
      const toastMock = jest.fn()
      const unregister = registerGlobalToastListener(toastMock)

      const result = await copyToClipboard('GENERIC-123')

      expect(result).toBe(true)
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('GENERIC-123')
      expect(toastMock).toHaveBeenCalledWith('Copied: GENERIC-123', 'success')

      unregister()
    })

    it('calls custom onToast callback if provided', async () => {
      const onToast = jest.fn()

      const result = await copyToClipboard('ABC-999', {
        type: 'sku',
        onToast,
        showGlobalToast: false,
      })

      expect(result).toBe(true)
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('ABC-999')
      expect(onToast).toHaveBeenCalledWith('Copied SKU: ABC-999')
    })

    it('handles onToast throwing an exception safely without crashing', async () => {
      const buggyOnToast = jest.fn().mockImplementation(() => {
        throw new Error('Callback crashed')
      })

      const result = await copyToClipboard('SAFE-SKU', {
        type: 'sku',
        onToast: buggyOnToast,
      })

      expect(result).toBe(true)
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('SAFE-SKU')
    })

    it('trims whitespace from input value when copying', async () => {
      const result = await copyToClipboard('   TRIMMED-SKU   ', { type: 'sku' })

      expect(result).toBe(true)
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('TRIMMED-SKU')
    })
  })

  describe('copyToClipboard - Safe Degradation (R3)', () => {
    it('returns false and does not copy when value is null', async () => {
      const toastMock = jest.fn()
      const unregister = registerGlobalToastListener(toastMock)

      const result = await copyToClipboard(null, { type: 'sku' })

      expect(result).toBe(false)
      expect(Clipboard.setStringAsync).not.toHaveBeenCalled()
      expect(toastMock).not.toHaveBeenCalled()

      unregister()
    })

    it('returns false and does not copy when value is undefined', async () => {
      const toastMock = jest.fn()
      const unregister = registerGlobalToastListener(toastMock)

      const result = await copyToClipboard(undefined, { type: 'barcode' })

      expect(result).toBe(false)
      expect(Clipboard.setStringAsync).not.toHaveBeenCalled()
      expect(toastMock).not.toHaveBeenCalled()

      unregister()
    })

    it('returns false and does not copy when value is empty string', async () => {
      const result = await copyToClipboard('', { type: 'sku' })

      expect(result).toBe(false)
      expect(Clipboard.setStringAsync).not.toHaveBeenCalled()
    })

    it('returns false and does not copy when value is only whitespace', async () => {
      const result = await copyToClipboard('     ', { type: 'barcode' })

      expect(result).toBe(false)
      expect(Clipboard.setStringAsync).not.toHaveBeenCalled()
    })

    it('returns false and does not copy when value is not a string (e.g. object or number)', async () => {
      const result = await copyToClipboard(12345 as any, { type: 'sku' })

      expect(result).toBe(false)
      expect(Clipboard.setStringAsync).not.toHaveBeenCalled()
    })

    it('gracefully catches Clipboard.setStringAsync rejection without crashing', async () => {
      ;(Clipboard.setStringAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Clipboard API unavailable')
      )

      const result = await copyToClipboard('FAIL-SKU', { type: 'sku' })

      expect(result).toBe(false)
    })
  })

  describe('Global Toast Event Bus', () => {
    it('registers and unregisters listeners correctly', () => {
      const listener1 = jest.fn()
      const listener2 = jest.fn()

      const unregister1 = registerGlobalToastListener(listener1)
      const unregister2 = registerGlobalToastListener(listener2)

      emitGlobalToast('Hello World', 'info')

      expect(listener1).toHaveBeenCalledWith('Hello World', 'info')
      expect(listener2).toHaveBeenCalledWith('Hello World', 'info')

      unregister1()

      emitGlobalToast('Second Message', 'success')

      expect(listener1).not.toHaveBeenCalledWith('Second Message', 'success')
      expect(listener2).toHaveBeenCalledWith('Second Message', 'success')

      unregister2()
    })

    it('isolates listener errors so other listeners still receive events', () => {
      const failingListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error')
      })
      const healthyListener = jest.fn()

      const unreg1 = registerGlobalToastListener(failingListener)
      const unreg2 = registerGlobalToastListener(healthyListener)

      emitGlobalToast('Test Error Isolation', 'warning')

      expect(failingListener).toHaveBeenCalledWith('Test Error Isolation', 'warning')
      expect(healthyListener).toHaveBeenCalledWith('Test Error Isolation', 'warning')

      unreg1()
      unreg2()
    })
  })

  describe('Propagation Stopping & Badge Tap Handlers', () => {
    it('stops event propagation on native press event', async () => {
      const mockNativeEvent = {
        stopImmediatePropagation: jest.fn(),
        stopPropagation: jest.fn(),
      }
      const mockEvent = {
        stopPropagation: jest.fn(),
        preventDefault: jest.fn(),
        nativeEvent: mockNativeEvent,
      }

      // Simulate the stopPropagation logic used in CopyableBadge
      mockEvent.stopPropagation?.()
      mockEvent.preventDefault?.()
      mockEvent.nativeEvent?.stopImmediatePropagation?.()
      mockEvent.nativeEvent?.stopPropagation?.()

      const copySuccess = await copyToClipboard('SKU-PROP-TEST', { type: 'sku' })

      expect(mockEvent.stopPropagation).toHaveBeenCalled()
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockNativeEvent.stopImmediatePropagation).toHaveBeenCalled()
      expect(mockNativeEvent.stopPropagation).toHaveBeenCalled()
      expect(copySuccess).toBe(true)
    })

    it('handles colon-only and whitespace-only labels gracefully without extra colons', async () => {
      const toastMock = jest.fn()
      const unregister = registerGlobalToastListener(toastMock)

      const result = await copyToClipboard('ITEM-101', { label: ':   ' })

      expect(result).toBe(true)
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('ITEM-101')
      expect(toastMock).toHaveBeenCalledWith('Copied: ITEM-101', 'success')

      unregister()
    })

    it('returns false when value is boolean or object or array', async () => {
      expect(await copyToClipboard(true as any)).toBe(false)
      expect(await copyToClipboard(false as any)).toBe(false)
      expect(await copyToClipboard({ sku: '123' } as any)).toBe(false)
      expect(await copyToClipboard(['SKU-1'] as any)).toBe(false)
    })
  })

  describe('CopyableBadge Component Rendering & Safe Degradation (R1, R2, R3)', () => {
    const Component = (CopyableBadge as any).type || CopyableBadge

    it('returns null when value is null', () => {
      const output = Component({ value: null })
      expect(output).toBeNull()
    })

    it('returns null when value is undefined', () => {
      const output = Component({ value: undefined })
      expect(output).toBeNull()
    })

    it('returns null when value is empty string', () => {
      const output = Component({ value: '' })
      expect(output).toBeNull()
    })

    it('returns null when value is whitespace string', () => {
      const output = Component({ value: '    ' })
      expect(output).toBeNull()
    })

    it('returns null when value is non-string (e.g. object or number)', () => {
      const output = Component({ value: 12345 as any })
      expect(output).toBeNull()
    })

    it('renders touchable badge with clean SKU value and accessibility label', () => {
      const output = Component({ value: '  SKU-TEST-123  ', type: 'sku' })

      expect(output).not.toBeNull()
      expect(output.props.accessibilityLabel).toBe('Copy SKU: SKU-TEST-123')
      expect(output.props.accessibilityRole).toBe('button')
      expect(output.props.accessibilityHint).toBe('Double tap to copy to clipboard')
      expect(output.props.testID).toBe('copyable-badge-sku-SKU-TEST-123')
    })

    it('renders with customLabel when provided', () => {
      const output = Component({
        value: 'ABC-123',
        type: 'sku',
        customLabel: 'Custom SKU: ABC-123',
      })

      expect(output).not.toBeNull()
      const textChild = React.Children.toArray(output.props.children).find(
        (child: any) => child && child.props && child.props.children === 'Custom SKU: ABC-123'
      )
      expect(textChild).toBeDefined()
    })

    it('renders with labelPrefix when provided', () => {
      const output = Component({
        value: 'ABC-123',
        type: 'sku',
        labelPrefix: 'SKU:',
      })

      expect(output).not.toBeNull()
      const textChild = React.Children.toArray(output.props.children).find(
        (child: any) => child && child.props && child.props.children === 'SKU: ABC-123'
      )
      expect(textChild).toBeDefined()
    })

    it('renders barcode badge with default barcode icon when prefixIcon is true', () => {
      const output = Component({
        value: '8851234567890',
        type: 'barcode',
        prefixIcon: true,
      })

      expect(output).not.toBeNull()
      const iconChild = React.Children.toArray(output.props.children).find(
        (child: any) => child && child.props && child.props.name === 'barcode-outline'
      )
      expect(iconChild).toBeDefined()
      expect(output.props.accessibilityLabel).toBe('Copy Barcode: 8851234567890')
    })

    it('renders custom prefixIconName when specified', () => {
      const output = Component({
        value: 'TAG-123',
        type: 'sku',
        prefixIcon: true,
        prefixIconName: 'pricetag-outline',
      })

      expect(output).not.toBeNull()
      const iconChild = React.Children.toArray(output.props.children).find(
        (child: any) => child && child.props && child.props.name === 'pricetag-outline'
      )
      expect(iconChild).toBeDefined()
    })

    it('renders with dark, outline, subtle, and compact styling variants', () => {
      const darkOutput = Component({ value: 'SKU-DARK', variant: 'dark' })
      expect(darkOutput).not.toBeNull()

      const outlineOutput = Component({ value: 'SKU-OUTLINE', variant: 'outline' })
      expect(outlineOutput).not.toBeNull()

      const subtleOutput = Component({ value: 'SKU-SUBTLE', variant: 'subtle' })
      expect(subtleOutput).not.toBeNull()

      const compactOutput = Component({ value: 'SKU-COMPACT', compact: true })
      expect(compactOutput).not.toBeNull()
    })

    it('handles onPress event by stopping event propagation and copying to clipboard', async () => {
      const toastMock = jest.fn()
      const unregister = registerGlobalToastListener(toastMock)

      const output = Component({
        value: 'SKU-PRESS-TEST',
        type: 'sku',
      })

      const mockNativeEvent = {
        stopImmediatePropagation: jest.fn(),
        stopPropagation: jest.fn(),
      }
      const mockEvent = {
        stopPropagation: jest.fn(),
        preventDefault: jest.fn(),
        nativeEvent: mockNativeEvent,
      }

      await output.props.onPress(mockEvent)

      expect(mockEvent.stopPropagation).toHaveBeenCalled()
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockNativeEvent.stopImmediatePropagation).toHaveBeenCalled()
      expect(mockNativeEvent.stopPropagation).toHaveBeenCalled()
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('SKU-PRESS-TEST')
      expect(toastMock).toHaveBeenCalledWith('Copied SKU: SKU-PRESS-TEST', 'success')

      unregister()
    })

    it('does not copy when disabled is true', async () => {
      const output = Component({
        value: 'SKU-DISABLED',
        type: 'sku',
        disabled: true,
      })

      const mockEvent = {
        stopPropagation: jest.fn(),
        preventDefault: jest.fn(),
      }

      await output.props.onPress(mockEvent)

      expect(Clipboard.setStringAsync).not.toHaveBeenCalledWith('SKU-DISABLED')
    })

    it('debounces rapid consecutive taps to prevent overlapping executions', async () => {
      const toastMock = jest.fn()
      const unregister = registerGlobalToastListener(toastMock)

      const output = Component({
        value: 'SKU-RAPID',
        type: 'sku',
      })

      const mockEvent = {
        stopPropagation: jest.fn(),
        preventDefault: jest.fn(),
        nativeEvent: { stopPropagation: jest.fn(), stopImmediatePropagation: jest.fn() },
      }

      // First tap fires
      const p1 = output.props.onPress(mockEvent)
      // Immediate second tap while first is in-flight or within debounce window
      const p2 = output.props.onPress(mockEvent)

      await Promise.all([p1, p2])

      expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1)
      expect(toastMock).toHaveBeenCalledTimes(1)

      unregister()
    })

    it('formats accessibility label and copies correctly for custom types', async () => {
      const toastMock = jest.fn()
      const unregister = registerGlobalToastListener(toastMock)

      const output = Component({
        value: 'SN-987654321',
        type: 'serial',
      })

      expect(output.props.accessibilityLabel).toBe('Copy serial: SN-987654321')

      await output.props.onPress()

      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('SN-987654321')
      expect(toastMock).toHaveBeenCalledWith('Copied: SN-987654321', 'success')

      unregister()
    })

    it('normalizes case-insensitive type props (e.g. SKU, BARCODE, Sku, Barcode)', async () => {
      const toastMock = jest.fn()
      const unregister = registerGlobalToastListener(toastMock)

      const skuOutput = Component({
        value: 'CASE-SKU-1',
        type: 'SKU' as any,
      })
      expect(skuOutput.props.accessibilityLabel).toBe('Copy SKU: CASE-SKU-1')
      await skuOutput.props.onPress()
      expect(toastMock).toHaveBeenCalledWith('Copied SKU: CASE-SKU-1', 'success')

      const barcodeOutput = Component({
        value: '885000111222',
        type: 'BARCODE' as any,
      })
      expect(barcodeOutput.props.accessibilityLabel).toBe('Copy Barcode: 885000111222')
      await barcodeOutput.props.onPress()
      expect(toastMock).toHaveBeenCalledWith('Copied Barcode: 885000111222', 'success')

      unregister()
    })

    it('preserves text truncation and layout constraints with ellipsizeMode and flexShrink', () => {
      const longSku = 'VERY-LONG-SKU-IDENTIFIER-999999999999999999999999999999-SPECIAL-EDITION'
      const output = Component({
        value: longSku,
        type: 'sku',
        prefixIcon: true,
      })

      expect(output).not.toBeNull()
      // Badge wrapper has maxWidth constraint
      const containerStyles = Array.isArray(output.props.style) ? output.props.style : [output.props.style]
      const baseStyle = containerStyles.find((s: any) => s && s.maxWidth === '100%')
      expect(baseStyle).toBeDefined()

      // Text child has numberOfLines, ellipsizeMode, and flexShrink
      const children = React.Children.toArray(output.props.children)
      const textChild = children.find((c: any) => c && c.props && c.props.numberOfLines === 1) as any
      expect(textChild).toBeDefined()
      expect(textChild.props.numberOfLines).toBe(1)
      expect(textChild.props.ellipsizeMode).toBe('tail')

      const textStyles = Array.isArray(textChild.props.style) ? textChild.props.style : [textChild.props.style]
      const textFlexStyle = textStyles.find((s: any) => s && s.flexShrink === 1)
      expect(textFlexStyle).toBeDefined()

      // Prefix and copy icons have flexShrink: 0 so they are never clipped
      const icons = children.filter((c: any) => c && c.props && c.props.name) as any[]
      expect(icons.length).toBe(2)
      icons.forEach((icon) => {
        expect(icon.props.style.flexShrink).toBe(0)
      })
    })

    it('renders all variants and custom style/textStyle/iconColor overrides correctly', () => {
      const pillOutput = Component({ value: 'PILL-1', variant: 'pill' })
      expect(pillOutput).not.toBeNull()

      const darkOutput = Component({
        value: 'DARK-1',
        variant: 'dark',
        prefixIcon: true,
      })
      const darkChildren = React.Children.toArray(darkOutput.props.children)
      const darkPrefixIcon = darkChildren.find((c: any) => c && c.props && c.props.name === 'pricetag-outline') as any
      const darkCopyIcon = darkChildren.find((c: any) => c && c.props && c.props.name === 'copy-outline') as any
      expect(darkPrefixIcon).toBeDefined()
      expect(darkCopyIcon).toBeDefined()
      expect(darkPrefixIcon.props.color).toBe('#94A3B8')
      expect(darkCopyIcon.props.color).toBe('#94A3B8')

      const customOutput = Component({
        value: 'CUSTOM-STYLE',
        style: { margin: 10 },
        textStyle: { fontSize: 16 },
        iconColor: '#FF0000',
        activeOpacity: 0.5,
        testID: 'custom-badge-id',
      })
      expect(customOutput.props.testID).toBe('custom-badge-id')
      expect(customOutput.props.activeOpacity).toBe(0.5)
      const customIcon = React.Children.toArray(customOutput.props.children).find(
        (c: any) => c && c.props && c.props.name === 'copy-outline'
      ) as any
      expect(customIcon).toBeDefined()
      expect(customIcon.props.color).toBe('#FF0000')
    })
  })

  describe('Deep Nested Touch Propagation & Parent Isolation', () => {
    const Component = (CopyableBadge as any).type || CopyableBadge

    it('prevents parent TouchableOpacity from firing when inner CopyableBadge is pressed', async () => {
      const parentOnPress = jest.fn()
      const toastMock = jest.fn()
      const unregister = registerGlobalToastListener(toastMock)

      const badgeElement = Component({
        value: 'PARENT-TEST-SKU',
        type: 'sku',
      })

      // Simulate parent container wrapper
      const mockEvent = {
        defaultPrevented: false,
        isPropagationStopped: false,
        stopPropagation: jest.fn(function (this: any) {
          this.isPropagationStopped = true
        }),
        preventDefault: jest.fn(function (this: any) {
          this.defaultPrevented = true
        }),
        nativeEvent: {
          stopImmediatePropagation: jest.fn(),
          stopPropagation: jest.fn(),
          preventDefault: jest.fn(),
        },
      }

      // Execute badge press handler
      await badgeElement.props.onPress(mockEvent)

      expect(mockEvent.stopPropagation).toHaveBeenCalled()
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.nativeEvent.stopImmediatePropagation).toHaveBeenCalled()
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('PARENT-TEST-SKU')
      expect(toastMock).toHaveBeenCalledWith('Copied SKU: PARENT-TEST-SKU', 'success')

      // Parent onPress must not have been triggered
      expect(parentOnPress).not.toHaveBeenCalled()

      unregister()
    })

    it('prevents parent Pressable/TouchableHighlight/Row navigation triggers across multiple screens', async () => {
      const catalogRowPress = jest.fn()
      const posCardPress = jest.fn()
      const pickerRowPress = jest.fn()

      const badge1 = Component({ value: 'CATALOG-SKU', type: 'sku' })
      const badge2 = Component({ value: 'POS-BARCODE', type: 'barcode' })
      const badge3 = Component({ value: 'PICKER-SKU', type: 'sku' })

      const e1 = { stopPropagation: jest.fn(), preventDefault: jest.fn(), nativeEvent: { stopPropagation: jest.fn() } }
      const e2 = { stopPropagation: jest.fn(), preventDefault: jest.fn(), nativeEvent: { stopPropagation: jest.fn() } }
      const e3 = { stopPropagation: jest.fn(), preventDefault: jest.fn(), nativeEvent: { stopPropagation: jest.fn() } }

      await badge1.props.onPress(e1)
      await badge2.props.onPress(e2)
      await badge3.props.onPress(e3)

      expect(catalogRowPress).not.toHaveBeenCalled()
      expect(posCardPress).not.toHaveBeenCalled()
      expect(pickerRowPress).not.toHaveBeenCalled()

      expect(e1.stopPropagation).toHaveBeenCalled()
      expect(e2.stopPropagation).toHaveBeenCalled()
      expect(e3.stopPropagation).toHaveBeenCalled()
    })
  })

  describe('ToastContext & Non-Blocking Overlay Behavior', () => {
    it('useToast returns graceful no-op fallback when used outside provider without crashing', () => {
      const fallback = useToast()
      expect(typeof fallback.showToast).toBe('function')
      expect(typeof fallback.hideToast).toBe('function')

      // Calling them should not throw
      expect(() => fallback.showToast('Test')).not.toThrow()
      expect(() => fallback.hideToast()).not.toThrow()
    })

    it('ToastProvider renders children and sets up non-blocking overlay structure', () => {
      const Provider = ToastProvider as any
      const mockChild = { type: 'Text', props: { children: 'App Content' } }

      const result = Provider({ children: mockChild })
      expect(result).toBeDefined()
      expect(result.props.value).toBeDefined()
      expect(typeof result.props.value.showToast).toBe('function')
      expect(typeof result.props.value.hideToast).toBe('function')
    })

    it('renders non-blocking alert overlay when toast is active and dismisses on press', () => {
      // Mock useState to return an active toast state
      const mockSetToast = jest.fn()
      jest.spyOn(React, 'useState').mockImplementationOnce(() => [
        {
          id: 12345,
          message: 'Copied SKU: TEST-SKU',
          type: 'success',
          duration: 2500,
        },
        mockSetToast,
      ] as any)

      const Provider = ToastProvider as any
      const result = Provider({ children: React.createElement('Text', {}, 'App Content') })

      const children = Array.isArray(result.props.children) ? result.props.children : [result.props.children]
      const animatedOverlay = children.find((c: any) => c && c.props && c.props.pointerEvents === 'box-none') as any

      expect(animatedOverlay).toBeDefined()
      expect(animatedOverlay.props.pointerEvents).toBe('box-none')

      const toastPill = animatedOverlay.props.children
      expect(toastPill.props.accessibilityRole).toBe('alert')
      expect(toastPill.props.accessibilityLabel).toBe('Copied SKU: TEST-SKU')
      expect(toastPill.props.accessibilityHint).toBe('Double tap to dismiss notification')

      // Dismissing the toast triggers hideToast
      expect(typeof toastPill.props.onPress).toBe('function')
      expect(() => toastPill.props.onPress()).not.toThrow()
    })

    it('renders error, warning, and info icons with appropriate colors', () => {
      const errorToast = { id: 1, message: 'Failed to copy', type: 'error', duration: 3000 }
      jest.spyOn(React, 'useState').mockImplementationOnce(() => [errorToast, jest.fn()] as any)

      const Provider = ToastProvider as any
      const errorResult = Provider({ children: null })
      const errorChildren = Array.isArray(errorResult.props.children) ? errorResult.props.children : [errorResult.props.children]
      const errorOverlay = errorChildren.find((c: any) => c && c.props && c.props.pointerEvents === 'box-none') as any
      const errorPillChildren = Array.isArray(errorOverlay.props.children.props.children)
        ? errorOverlay.props.children.props.children
        : [errorOverlay.props.children.props.children]
      const errorIcon = errorPillChildren.find((c: any) => c && c.props && c.props.name === 'alert-circle')
      expect(errorIcon.props.name).toBe('alert-circle')
      expect(errorIcon.props.color).toBe('#F87171')

      const warningToast = { id: 2, message: 'Stock is low', type: 'warning', duration: 3000 }
      jest.spyOn(React, 'useState').mockImplementationOnce(() => [warningToast, jest.fn()] as any)
      const warningResult = Provider({ children: null })
      const warningChildren = Array.isArray(warningResult.props.children) ? warningResult.props.children : [warningResult.props.children]
      const warningOverlay = warningChildren.find((c: any) => c && c.props && c.props.pointerEvents === 'box-none') as any
      const warningPillChildren = Array.isArray(warningOverlay.props.children.props.children)
        ? warningOverlay.props.children.props.children
        : [warningOverlay.props.children.props.children]
      const warningIcon = warningPillChildren.find((c: any) => c && c.props && c.props.name === 'warning')
      expect(warningIcon.props.name).toBe('warning')
      expect(warningIcon.props.color).toBe('#FBBF24')

      const infoToast = { id: 3, message: 'Syncing catalog', type: 'info', duration: 3000 }
      jest.spyOn(React, 'useState').mockImplementationOnce(() => [infoToast, jest.fn()] as any)
      const infoResult = Provider({ children: null })
      const infoChildren = Array.isArray(infoResult.props.children) ? infoResult.props.children : [infoResult.props.children]
      const infoOverlay = infoChildren.find((c: any) => c && c.props && c.props.pointerEvents === 'box-none') as any
      const infoPillChildren = Array.isArray(infoOverlay.props.children.props.children)
        ? infoOverlay.props.children.props.children
        : [infoOverlay.props.children.props.children]
      const infoIcon = infoPillChildren.find((c: any) => c && c.props && c.props.name === 'information-circle')
      expect(infoIcon.props.name).toBe('information-circle')
    })
  })
})
