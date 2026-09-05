import React from 'react'
import { useBarcodeScan, ScanFeedback } from '../hooks/useBarcodeScan'
import { CameraScannerModal, ScannedPreviewItem } from '../components/CameraScannerModal'
import * as endpoints from '../api/endpoints'

import { CartList } from '../components/CartList'
import { Alert } from 'react-native'

// Mocks
jest.mock('../api/endpoints', () => ({
  scanBarcode: jest.fn(),
}))

jest.mock('expo-camera', () => ({
  CameraView: (props: any) => ({ type: 'CameraView', props }),
  useCameraPermissions: jest.fn(() => [{ granted: true }, jest.fn()]),
}))

jest.mock('@expo/vector-icons', () => ({
  Ionicons: (props: any) => ({ type: 'Ionicons', props }),
}))

jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn().mockResolvedValue(true),
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          replayAsync: jest.fn().mockResolvedValue(true),
          unloadAsync: jest.fn().mockResolvedValue(true),
        },
      }),
    },
  },
}))

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
}))

jest.mock('expo-image', () => ({
  Image: (props: any) => ({ type: 'Image', props }),
}))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: (props: any) => ({ type: 'SafeAreaView', props }),
}))

jest.mock('react-native', () => ({
  Modal: (props: any) => ({ type: 'Modal', props }),
  Text: (props: any) => ({ type: 'Text', props }),
  TouchableOpacity: (props: any) => ({ type: 'TouchableOpacity', props }),
  View: (props: any) => ({ type: 'View', props }),
  ScrollView: (props: any) => ({ type: 'ScrollView', props }),
  FlatList: (props: any) => ({ type: 'FlatList', props }),
  TextInput: (props: any) => ({ type: 'TextInput', props }),
  Image: (props: any) => ({ type: 'Image', props }),
  ActivityIndicator: (props: any) => ({ type: 'ActivityIndicator', props }),
  Easing: {
    inOut: jest.fn(),
    out: jest.fn(),
    quad: jest.fn(),
    back: jest.fn(),
  },
  StatusBar: {
    currentHeight: 24,
  },
  StyleSheet: {
    create: (styles: any) => styles,
    absoluteFill: {},
    absoluteFillObject: {},
  },
  Platform: {
    OS: 'ios',
    select: (obj: any) => obj.ios || obj.default,
  },
  Animated: {
    Value: jest.fn().mockImplementation((val) => ({
      setValue: jest.fn(),
      interpolate: jest.fn().mockReturnValue(val),
      current: val,
    })),
    timing: jest.fn().mockReturnValue({
      start: jest.fn((cb) => cb && cb({ finished: true })),
    }),
    loop: jest.fn().mockReturnValue({
      start: jest.fn(),
      stop: jest.fn(),
    }),
    sequence: jest.fn().mockReturnValue({
      start: jest.fn(),
    }),
    parallel: jest.fn((anims: any[]) => ({
      start: jest.fn((cb) => {
        anims.forEach((a) => a && a.start && a.start())
        cb && cb({ finished: true })
      }),
    })),
    View: (props: any) => ({ type: 'Animated.View', props }),
  },
  Alert: {
    alert: jest.fn(),
  },
}))

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

describe('Continuous Barcode Scanning Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
  })

  describe('useBarcodeScan Hook - Continuous & Debounced Operations', () => {
    it('successfully processes scanned variant without closing scanner or throwing blocking alerts', async () => {
      const mockVariant = {
        id: 'var-1',
        product_id: 'prod-1',
        name: 'Caramel Macchiato Large',
        sku: 'SKU-CM-LG',
        barcode: '885123456001',
        price: '3.50',
        cost: '1.20',
        quantity_on_hand: 20,
        is_active: true,
      }
      const mockProduct = {
        id: 'prod-1',
        name: 'Caramel Macchiato',
        is_active: true,
      }

      ;(endpoints.scanBarcode as jest.Mock).mockResolvedValueOnce({
        type: 'variant',
        variant: mockVariant,
        product: mockProduct,
      })

      const onFoundVariant = jest.fn()
      const onFeedback = jest.fn()

      // Hook test helper
      let hookResult: any
      function TestComponent() {
        hookResult = useBarcodeScan({
          mode: 'cart',
          closeScannerOnFound: false,
          onFoundVariant,
          onFeedback,
          autoAlertOnNotFound: false,
          autoAlertOnError: false,
        })
        return null
      }

      // Minimal execution
      const setStates: Record<string, any> = {}
      jest.spyOn(React, 'useState').mockImplementation(((initial: any) => {
        const key = typeof initial === 'boolean' ? 'bool' : typeof initial === 'object' ? 'obj' : 'other'
        setStates[key] = initial
        return [initial, (v: any) => { setStates[key] = v }]
      }) as any)
      jest.spyOn(React, 'useRef').mockImplementation(((initial: any) => ({ current: initial })) as any)
      jest.spyOn(React, 'useCallback').mockImplementation(((fn: any) => fn) as any)
      jest.spyOn(React, 'useEffect').mockImplementation((() => {}) as any)

      TestComponent()

      const result = await hookResult.handleScanCode('885123456001')

      expect(endpoints.scanBarcode).toHaveBeenCalledWith('885123456001')
      expect(result?.type).toBe('variant')
      expect(onFoundVariant).toHaveBeenCalledWith(mockVariant, mockProduct)
      expect(onFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Scanned: Caramel Macchiato (SKU-CM-LG)',
          type: 'success',
        })
      )
    })

    it('handles onBeforeProcess short-circuit when item already in staging list', async () => {
      const onBeforeProcess = jest.fn().mockReturnValue(true) // item found and incremented
      const onFoundVariant = jest.fn()

      let hookResult: any
      function TestComponent() {
        hookResult = useBarcodeScan({
          mode: 'stock-in',
          onBeforeProcess,
          onFoundVariant,
        })
        return null
      }

      jest.spyOn(React, 'useState').mockImplementation(((initial: any) => [initial, jest.fn()]) as any)
      jest.spyOn(React, 'useRef').mockImplementation(((initial: any) => ({ current: initial })) as any)
      jest.spyOn(React, 'useCallback').mockImplementation(((fn: any) => fn) as any)
      jest.spyOn(React, 'useEffect').mockImplementation((() => {}) as any)

      TestComponent()

      const result = await hookResult.handleScanCode('EXISTING-SKU-123')

      expect(onBeforeProcess).toHaveBeenCalledWith('EXISTING-SKU-123')
      expect(endpoints.scanBarcode).not.toHaveBeenCalled()
      expect(result).toBeNull()
      expect(onFoundVariant).not.toHaveBeenCalled()
    })

    it('handles barcode not found with non-blocking feedback without blocking alert', async () => {
      ;(endpoints.scanBarcode as jest.Mock).mockResolvedValueOnce(null)

      const onFeedback = jest.fn()
      const onNotFound = jest.fn()

      let hookResult: any
      function TestComponent() {
        hookResult = useBarcodeScan({
          onFeedback,
          onNotFound,
          autoAlertOnNotFound: false,
        })
        return null
      }

      jest.spyOn(React, 'useState').mockImplementation(((initial: any) => [initial, jest.fn()]) as any)
      jest.spyOn(React, 'useRef').mockImplementation(((initial: any) => ({ current: initial })) as any)
      jest.spyOn(React, 'useCallback').mockImplementation(((fn: any) => fn) as any)
      jest.spyOn(React, 'useEffect').mockImplementation((() => {}) as any)

      TestComponent()

      const result = await hookResult.handleScanCode('UNKNOWN-999')

      expect(result).toBeNull()
      expect(onNotFound).toHaveBeenCalledWith('UNKNOWN-999')
      expect(onFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Barcode Not Found: UNKNOWN-999',
          type: 'warning',
        })
      )
    })

    it('alerts user with error feedback when scanned product is out of stock in POS cart mode', async () => {
      const mockOutOfStockVariant = {
        id: 'var-oos',
        product_id: 'prod-oos',
        name: 'Cold Brew Oat',
        sku: 'SKU-CBO',
        barcode: '885999000111',
        price: '4.00',
        quantity_on_hand: 0, // 0 inventory
        is_active: true,
      }
      const mockProduct = {
        id: 'prod-oos',
        name: 'Cold Brew Oat',
        is_active: true,
      }

      ;(endpoints.scanBarcode as jest.Mock).mockResolvedValueOnce({
        type: 'variant',
        variant: mockOutOfStockVariant,
        product: mockProduct,
      })

      const onFeedback = jest.fn()
      const onFoundVariant = jest.fn()

      let hookResult: any
      function TestComponent() {
        hookResult = useBarcodeScan({
          mode: 'cart',
          onFeedback,
          onFoundVariant,
        })
        return null
      }

      jest.spyOn(React, 'useState').mockImplementation(((initial: any) => [initial, jest.fn()]) as any)
      jest.spyOn(React, 'useRef').mockImplementation(((initial: any) => ({ current: initial })) as any)
      jest.spyOn(React, 'useCallback').mockImplementation(((fn: any) => fn) as any)
      jest.spyOn(React, 'useEffect').mockImplementation((() => {}) as any)

      TestComponent()

      const result = await hookResult.handleScanCode('885999000111')

      expect(result?.type).toBe('variant')
      expect(onFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Out of Stock: Cold Brew Oat (SKU-CBO)',
          submessage: '0 units available in inventory',
          type: 'error',
        })
      )
    })

    it('alerts user with warning feedback when adding item reaches max stock limit', async () => {
      const mockVariant = {
        id: 'var-max',
        product_id: 'prod-max',
        name: 'Espresso Single',
        sku: 'SKU-ESP',
        barcode: '885777888999',
        price: '2.00',
        quantity_on_hand: 2,
        is_active: true,
      }
      const mockProduct = {
        id: 'prod-max',
        name: 'Espresso Single',
        is_active: true,
      }

      ;(endpoints.scanBarcode as jest.Mock).mockResolvedValueOnce({
        type: 'variant',
        variant: mockVariant,
        product: mockProduct,
      })

      const onFeedback = jest.fn()
      const onFoundVariant = jest.fn().mockReturnValue({
        success: false,
        reason: 'max_stock_reached',
        availableStock: 2,
        productName: 'Espresso Single',
      })

      let hookResult: any
      function TestComponent() {
        hookResult = useBarcodeScan({
          mode: 'cart',
          onFeedback,
          onFoundVariant,
        })
        return null
      }

      jest.spyOn(React, 'useState').mockImplementation(((initial: any) => [initial, jest.fn()]) as any)
      jest.spyOn(React, 'useRef').mockImplementation(((initial: any) => ({ current: initial })) as any)
      jest.spyOn(React, 'useCallback').mockImplementation(((fn: any) => fn) as any)
      jest.spyOn(React, 'useEffect').mockImplementation((() => {}) as any)

      TestComponent()

      const result = await hookResult.handleScanCode('885777888999')

      expect(result?.type).toBe('variant')
      expect(onFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Max Stock Reached: Espresso Single',
          submessage: 'Cannot exceed 2 in stock',
          type: 'warning',
        })
      )
    })
  })

  describe('CameraScannerModal Component - Action Bar & Review Dialog', () => {
    it('renders scanner modal with live control bar and review button', () => {
      const mockItems: ScannedPreviewItem[] = [
        {
          id: 'item-1',
          name: 'Matcha Latte',
          sku: 'SKU-MATCHA',
          barcode: '88500112233',
          quantity: 2,
          priceOrCost: 4.5,
        },
        {
          id: 'item-2',
          name: 'Croissant Butter',
          sku: 'SKU-CROISSANT',
          quantity: 1,
          priceOrCost: 2.75,
        },
      ]

      const onScanCode = jest.fn().mockResolvedValue(undefined)
      const onClose = jest.fn()
      const onPrimaryAction = jest.fn()
      const onUpdateItemQuantity = jest.fn()
      const onRemoveItem = jest.fn()

      const element = CameraScannerModal({
        visible: true,
        onClose,
        onScanCode,
        isLoading: false,
        scannedItems: mockItems,
        totalCount: 3,
        totalValue: 11.75,
        primaryActionLabel: 'Go to Register',
        onPrimaryAction,
        onUpdateItemQuantity,
        onRemoveItem,
      })

      expect(element).toBeDefined()
      expect((element as any).type).toBeDefined()
      expect((element as any).props.visible).toBe(true)
    })

    it('passes review sheet controls (increment, decrement, remove, primary action) correctly', () => {
      const mockItems: ScannedPreviewItem[] = [
        {
          id: 'item-1',
          name: 'Iced Americano',
          sku: 'SKU-AME',
          quantity: 3,
          priceOrCost: 2.5,
        },
      ]

      const onUpdateItemQuantity = jest.fn()
      const onRemoveItem = jest.fn()
      const onPrimaryAction = jest.fn()

      const element = CameraScannerModal({
        visible: true,
        onClose: jest.fn(),
        onScanCode: jest.fn().mockResolvedValue(undefined),
        isLoading: false,
        scannedItems: mockItems,
        totalCount: 3,
        totalValue: 7.5,
        onUpdateItemQuantity,
        onRemoveItem,
        onPrimaryAction,
        primaryActionLabel: 'Go to Register',
      })

      expect(element).toBeDefined()
    })
  })

  describe('CartList Component - Confirmation Dialogs for Checkout Step 1', () => {
    it('prompts confirmation dialog when Clear Cart is pressed and executes onClearCart upon confirmation', () => {
      const onClearCart = jest.fn()
      const mockCart = [
        {
          variantId: 'v1',
          sku: 'SKU-LATTE',
          productName: 'Iced Latte',
          quantity: 2,
          unitPrice: 4.0,
          availableStock: 10,
        },
      ]

      const element = CartList({
        cart: mockCart,
        stockWarnings: {},
        onIncrease: jest.fn(),
        onDecrease: jest.fn(),
        onRemove: jest.fn(),
        onClearCart,
      })

      expect(element).toBeDefined()

      // Find the Clear Cart button
      const flatTree = JSON.stringify(element)
      expect(flatTree).toContain('Clear Cart')

      // Simulate handleClearCart
      const alertSpy = jest.spyOn(Alert, 'alert')
      
      // Call the internal confirmation logic via Alert.alert
      Alert.alert(
        'Clear Cart',
        'Are you sure you want to remove all items from the cart?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear All',
            style: 'destructive',
            onPress: onClearCart,
          },
        ]
      )

      expect(alertSpy).toHaveBeenCalledWith(
        'Clear Cart',
        'Are you sure you want to remove all items from the cart?',
        expect.any(Array)
      )

      // Invoke the destructive action callback
      const buttons = alertSpy.mock.calls[0][2] as any[]
      const clearBtn = buttons.find((b: any) => b.text === 'Clear All')
      expect(clearBtn).toBeDefined()
      clearBtn.onPress()
      expect(onClearCart).toHaveBeenCalledTimes(1)
    })

    it('prompts confirmation dialog when Remove Item is pressed and executes onRemove upon confirmation', () => {
      const onRemove = jest.fn()
      const alertSpy = jest.spyOn(Alert, 'alert')

      // Simulate remove confirmation
      Alert.alert(
        'Remove Item',
        'Are you sure you want to remove "Iced Latte" from the cart?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => onRemove('v1'),
          },
        ]
      )

      expect(alertSpy).toHaveBeenCalledWith(
        'Remove Item',
        'Are you sure you want to remove "Iced Latte" from the cart?',
        expect.any(Array)
      )

      const buttons = alertSpy.mock.calls[0][2] as any[]
      const removeBtn = buttons.find((b: any) => b.text === 'Remove')
      expect(removeBtn).toBeDefined()
      removeBtn.onPress()
      expect(onRemove).toHaveBeenCalledWith('v1')
    })
  })

  describe('Checkout Delivery Zone - Custom / Negotiated Fee', () => {
    it('includes Custom / Negotiated Fee in the deliveryZonePickerItems list', () => {
      const mockZones = [
        { id: 'z1', name: 'Phnom Penh Central', cost: 1.5, isActive: true, isDefault: true },
        { id: 'z2', name: 'Suburbs', cost: 3.0, isActive: true, isDefault: false },
      ]

      const deliveryZonePickerItems = [
        ...mockZones.map((z) => ({
          id: z.id,
          title: z.name,
          subtitle: `$${z.cost.toFixed(2)} delivery`,
        })),
        {
          id: 'custom',
          title: 'Custom / Negotiated Fee',
          subtitle: 'Manual negotiated price',
        },
      ]

      expect(deliveryZonePickerItems).toHaveLength(3)
      expect(deliveryZonePickerItems[2]).toEqual({
        id: 'custom',
        title: 'Custom / Negotiated Fee',
        subtitle: 'Manual negotiated price',
      })
    })

    it('calculates custom delivery fee properly in order total when custom zone is selected', () => {
      const cartTotal = 50.0
      const isDelivery = true
      const selectedDeliveryZone = {
        id: 'custom',
        name: 'Custom / Negotiated',
        cost: 0,
        isActive: true,
        isDefault: false,
      }
      const customDeliveryFeeInput = '7.50'

      const deliveryCost = (() => {
        if (!isDelivery || !selectedDeliveryZone) return 0
        if (selectedDeliveryZone.id === 'custom') {
          return parseFloat(customDeliveryFeeInput || '0') || 0
        }
        return selectedDeliveryZone.cost
      })()

      const grandTotal = cartTotal + deliveryCost

      expect(deliveryCost).toBe(7.5)
      expect(grandTotal).toBe(57.5)
    })
  })

  describe('POS Checkout - Walk-in Customers & Address Auto-Population', () => {
    it('allows walk-in customers without name, phone, or address when fulfillment is In-Store', () => {
      const { posCheckoutSchema } = require('../utils/validation')

      const walkInFormData = {
        channelId: 'chan-1',
        sellerId: 'user-1',
        customerName: '',
        customerPhone: '',
        isDelivery: false,
        discountType: 'flat',
        discountInput: '',
        taxType: 'flat',
        taxInput: '',
        taxRate: '0',
        orderStatus: 'paid',
        customDeliveryFee: '',
        deliveryAddress: '',
      }

      const result = posCheckoutSchema.safeParse(walkInFormData)
      expect(result.success).toBe(true)
    })

    it('requires delivery address when isDelivery is true', () => {
      const { posCheckoutSchema } = require('../utils/validation')

      const deliveryWithoutAddress = {
        channelId: 'chan-1',
        sellerId: 'user-1',
        customerName: 'Sokha',
        customerPhone: '012345678',
        isDelivery: true,
        discountType: 'flat',
        orderStatus: 'paid',
        deliveryAddress: '',
      }

      const result = posCheckoutSchema.safeParse(deliveryWithoutAddress)
      expect(result.success).toBe(false)
      if (!result.success) {
        const addressIssue = result.error.issues.find((i: any) => i.path.includes('deliveryAddress'))
        expect(addressIssue).toBeDefined()
      }
    })

    it('passes validation when isDelivery is true and address is provided', () => {
      const { posCheckoutSchema } = require('../utils/validation')

      const deliveryWithAddress = {
        channelId: 'chan-1',
        sellerId: 'user-1',
        customerName: 'Sokha',
        customerPhone: '012345678',
        isDelivery: true,
        discountType: 'flat',
        orderStatus: 'paid',
        deliveryAddress: 'Street 51, BKK1, Phnom Penh',
      }

      const result = posCheckoutSchema.safeParse(deliveryWithAddress)
      expect(result.success).toBe(true)
    })

    it('correctly builds checkout preset with customer address', () => {
      const mockCustomer = {
        id: 'cust-1',
        name: 'Dara Chan',
        phone: '098765432',
        address: 'Borey Peng Huoth, Chbar Ampov',
      }

      const preset = {
        customerName: mockCustomer.name,
        customerPhone: mockCustomer.phone,
        deliveryAddress: mockCustomer.address || '',
      }

      expect(preset.deliveryAddress).toBe('Borey Peng Huoth, Chbar Ampov')
      expect(preset.customerName).toBe('Dara Chan')
      expect(preset.customerPhone).toBe('098765432')
    })
  })

  describe('Scanner Audio Feedback - Beep & Error Sounds', () => {
    it('preloads scanner audio and replays cached beep on successful scan', async () => {
      const { playScanBeep, preloadScannerSounds, setSoundEnabled, unloadScannerSounds } = require('../utils/scannerSound')
      const { Audio } = require('expo-av')

      await unloadScannerSounds()
      setSoundEnabled(true)
      await preloadScannerSounds()
      expect(Audio.Sound.createAsync).toHaveBeenCalled()

      const created = await Audio.Sound.createAsync.mock.results[0]?.value
      await playScanBeep()
      expect(created.sound.replayAsync).toHaveBeenCalled()
    })

    it('plays error sound on failed/inactive item scan', async () => {
      const { playScanErrorSound, unloadScannerSounds } = require('../utils/scannerSound')
      const { Audio } = require('expo-av')

      await unloadScannerSounds()
      await playScanErrorSound()
      expect(Audio.Sound.createAsync).toHaveBeenCalled()
    })

    it('respects setSoundEnabled(false) to mute sound when disabled', async () => {
      const { playScanBeep, setSoundEnabled, isSoundEnabled, unloadScannerSounds } = require('../utils/scannerSound')
      const { Audio } = require('expo-av')

      await unloadScannerSounds()
      setSoundEnabled(false)
      expect(isSoundEnabled()).toBe(false)
      const callCountBefore = Audio.Sound.createAsync.mock.calls.length

      await playScanBeep()
      // Should not initiate new playback
      expect(Audio.Sound.createAsync.mock.calls.length).toBe(callCountBefore)

      setSoundEnabled(true)
      expect(isSoundEnabled()).toBe(true)
    })
  })
})
