import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  StatusBar as RNStatusBar,
  ScrollView,
  Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera'
import { tokens } from '../theme/tokens'

export interface ScannedPreviewItem {
  id: string
  name: string
  sku?: string | null
  barcode?: string | null
  quantity: number
  priceOrCost?: number
  priceOrCostLabel?: string
  imageUrl?: string | null
}

export interface ScannerFeedbackState {
  message: string
  submessage?: string
  type?: 'success' | 'warning' | 'error' | 'info'
  timestamp: number
}

export interface CameraScannerModalProps {
  visible: boolean
  onClose: () => void
  onScanCode: (code: string) => Promise<void>
  isLoading: boolean
  // Continuous scanning enhancements
  scannedItems?: ScannedPreviewItem[]
  onUpdateItemQuantity?: (id: string, delta: number) => void
  onRemoveItem?: (id: string) => void
  onPrimaryAction?: () => void
  primaryActionLabel?: string
  primaryActionIcon?: any
  totalCount?: number
  totalValue?: number
  currencySymbol?: string
  feedback?: ScannerFeedbackState | null
  title?: string
  subtitle?: string
}

const RETICLE_WIDTH = 280
const RETICLE_HEIGHT = 190

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  visible,
  onClose,
  onScanCode,
  isLoading,
  scannedItems = [],
  onUpdateItemQuantity,
  onRemoveItem,
  onPrimaryAction,
  primaryActionLabel = 'Go to Register',
  primaryActionIcon = 'arrow-forward-outline',
  totalCount,
  totalValue,
  currencySymbol = '$',
  feedback,
  title = 'Scan Barcode / SKU',
  subtitle,
}) => {
  const [permission, requestPermission] = useCameraPermissions()
  const [isTorchOn, setIsTorchOn] = useState(false)
  const [isReviewOpen, setIsReviewOpen] = useState(false)

  // Animated laser line translation
  const laserAnim = useRef(new Animated.Value(0)).current

  // Animated feedback banner (in-viewfinder toast)
  const feedbackOpacity = useRef(new Animated.Value(0)).current
  const feedbackTranslateY = useRef(new Animated.Value(-12)).current
  const [currentFeedback, setCurrentFeedback] = useState<ScannerFeedbackState | null>(null)

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null

    if (visible && permission?.granted) {
      laserAnim.setValue(0)
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      )
      animation.start()
    } else {
      laserAnim.stopAnimation()
    }

    return () => {
      animation?.stop()
    }
  }, [visible, permission?.granted, laserAnim])

  // Reset torch and review dialog on modal close
  useEffect(() => {
    if (!visible) {
      setIsTorchOn(false)
      setIsReviewOpen(false)
      setCurrentFeedback(null)
    }
  }, [visible])

  // Handle incoming feedback updates
  useEffect(() => {
    if (feedback && feedback.timestamp) {
      setCurrentFeedback(feedback)
      feedbackOpacity.setValue(0)
      feedbackTranslateY.setValue(-12)

      Animated.parallel([
        Animated.timing(feedbackOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(feedbackTranslateY, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]).start()

      const timer = setTimeout(() => {
        Animated.timing(feedbackOpacity, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }).start(() => {
          setCurrentFeedback((prev) => (prev?.timestamp === feedback.timestamp ? null : prev))
        })
      }, 2400)

      return () => clearTimeout(timer)
    }
  }, [feedback, feedbackOpacity, feedbackTranslateY])

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (isLoading || !result.data) return
    onScanCode(result.data)
  }

  const toggleTorch = () => {
    setIsTorchOn((prev) => !prev)
  }

  const laserTranslateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, RETICLE_HEIGHT - 10],
  })

  // Derive counts
  const itemsCount =
    totalCount !== undefined
      ? totalCount
      : scannedItems.reduce((sum, item) => sum + (item.quantity || 1), 0)

  const itemsValue =
    totalValue !== undefined
      ? totalValue
      : scannedItems.reduce(
          (sum, item) => sum + (item.priceOrCost || 0) * (item.quantity || 1),
          0
        )

  const handlePrimaryPress = () => {
    if (onPrimaryAction) {
      onPrimaryAction()
    } else {
      onClose()
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.container}>
        {/* Top Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerTitleGroup}>
            <View style={styles.scannerBadge}>
              <Ionicons name="barcode-outline" size={18} color={tokens.colors.primaryContainer} />
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
              <View style={styles.liveStatusRow}>
                <View style={styles.livePulseDot} />
                <Text style={styles.liveStatusText}>
                  {subtitle || `${itemsCount} item${itemsCount === 1 ? '' : 's'} scanned • Live`}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.headerActions}>
            {/* Torch Toggle Button */}
            {Boolean(permission?.granted) && (
              <TouchableOpacity
                testID="btn-toggle-torch"
                style={[
                  styles.torchButton,
                  isTorchOn && styles.torchButtonActive,
                ]}
                onPress={toggleTorch}
                accessibilityRole="button"
                accessibilityLabel={isTorchOn ? 'Turn torch off' : 'Turn torch on'}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={isTorchOn ? 'flash' : 'flash-outline'}
                  size={16}
                  color={isTorchOn ? tokens.colors.primaryContainer : tokens.colors.surfaceBase}
                />
                <Text
                  style={[
                    styles.torchText,
                    isTorchOn && styles.torchTextActive,
                  ]}
                >
                  {isTorchOn ? 'Torch On' : 'Torch'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Close Button */}
            <TouchableOpacity
              testID="btn-close-scanner"
              style={styles.closeButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close scanner"
              activeOpacity={0.75}
            >
              <Text style={styles.closeButtonText}>✕ Close</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Viewfinder Camera Area */}
        <View style={styles.cameraWrapper}>
          {!permission?.granted ? (
            <View style={styles.permissionContainer}>
              <View style={styles.permissionIconCircle}>
                <Ionicons name="camera" size={32} color={tokens.colors.primaryContainer} />
              </View>
              <Text style={styles.permissionTitle}>Camera Access Needed</Text>
              <Text style={styles.permissionText}>
                Camera permission is required to scan product barcodes and QR codes directly.
              </Text>
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={requestPermission}
                accessibilityRole="button"
                activeOpacity={0.85}
              >
                <Text style={styles.permissionButtonText}>Grant Camera Permission</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                enableTorch={isTorchOn}
                onBarcodeScanned={handleBarcodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
                }}
              />

              {/* Masked Overlay with Viewfinder Window */}
              <View style={styles.maskContainer} pointerEvents="none">
                {/* Top Mask with Live In-Camera Feedback HUD */}
                <View style={styles.maskTop}>
                  {currentFeedback ? (
                    <Animated.View
                      style={[
                        styles.feedbackBanner,
                        currentFeedback.type === 'success' && styles.feedbackSuccess,
                        currentFeedback.type === 'warning' && styles.feedbackWarning,
                        currentFeedback.type === 'error' && styles.feedbackError,
                        currentFeedback.type === 'info' && styles.feedbackInfo,
                        {
                          opacity: feedbackOpacity,
                          transform: [{ translateY: feedbackTranslateY }],
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          currentFeedback.type === 'success'
                            ? 'checkmark-circle'
                            : currentFeedback.type === 'warning'
                            ? 'warning'
                            : currentFeedback.type === 'error'
                            ? 'close-circle'
                            : 'information-circle'
                        }
                        size={18}
                        color={tokens.colors.onPrimary}
                      />
                      <View style={{ flexShrink: 1 }}>
                        <Text style={styles.feedbackMessage} numberOfLines={2}>
                          {currentFeedback.message}
                        </Text>
                        {currentFeedback.submessage ? (
                          <Text style={styles.feedbackSubmessage} numberOfLines={1}>
                            {currentFeedback.submessage}
                          </Text>
                        ) : null}
                      </View>
                    </Animated.View>
                  ) : null}
                </View>

                {/* Center Row */}
                <View style={styles.maskCenterRow}>
                  <View style={styles.maskSide} />

                  {/* Reticle Focus Window */}
                  <View style={styles.reticle}>
                    <View style={[styles.corner, styles.topLeft]} />
                    <View style={[styles.corner, styles.topRight]} />
                    <View style={[styles.corner, styles.bottomLeft]} />
                    <View style={[styles.corner, styles.bottomRight]} />

                    <View style={styles.crosshairH} />
                    <View style={styles.crosshairV} />

                    <Animated.View
                      style={[
                        styles.laserLine,
                        {
                          transform: [{ translateY: laserTranslateY }],
                        },
                      ]}
                    >
                      <View style={styles.laserGlow} />
                    </Animated.View>
                  </View>

                  <View style={styles.maskSide} />
                </View>

                {/* Bottom Mask with Scan Hint */}
                <View style={styles.maskBottom}>
                  <View style={styles.hintContainer}>
                    <Ionicons name="scan-outline" size={16} color={tokens.colors.primaryContainer} />
                    <Text style={styles.hintText}>
                      Keep scanning barcodes continuously
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* Loading Overlay */}
          {Boolean(isLoading) && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color={tokens.colors.primaryContainer} />
                <Text style={styles.loadingTitle}>Looking up item...</Text>
                <Text style={styles.loadingSubtitle}>Resolving barcode in catalog</Text>
              </View>
            </View>
          )}
        </View>

        {/* Bottom Uninterrupted Scanner Control Bar */}
        <View style={styles.bottomControlBar}>
          {/* Review Scanned Items Button */}
          <TouchableOpacity
            testID="btn-view-scanned-items"
            style={[
              styles.reviewItemsButton,
              itemsCount > 0 && styles.reviewItemsButtonActive,
            ]}
            onPress={() => setIsReviewOpen(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Review ${itemsCount} scanned items`}
          >
            <View style={styles.reviewBadgeIcon}>
              <Ionicons
                name="list-outline"
                size={20}
                color={itemsCount > 0 ? tokens.colors.primaryContainer : tokens.colors.secondary}
              />
              {Boolean(itemsCount > 0) && (
                <View style={styles.counterBadge}>
                  <Text style={styles.counterBadgeText}>{itemsCount > 99 ? '99+' : itemsCount}</Text>
                </View>
              )}
            </View>
            <View style={styles.reviewTextGroup}>
              <Text style={styles.reviewButtonTitle}>
                {itemsCount > 0 ? `Scanned (${itemsCount})` : 'Scanned List'}
              </Text>
              <Text style={styles.reviewButtonSubtitle}>
                {itemsCount > 0 && itemsValue > 0
                  ? `${currencySymbol}${itemsValue.toFixed(2)}`
                  : 'Tap to view list'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Primary Action Button (e.g. Go to Register / Done) */}
          <TouchableOpacity
            testID="btn-scanner-primary-action"
            style={[
              styles.primaryActionButton,
              itemsCount === 0 && styles.primaryActionButtonSecondary,
            ]}
            onPress={handlePrimaryPress}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={primaryActionLabel}
          >
            <Text style={styles.primaryActionText}>{primaryActionLabel}</Text>
            <Ionicons
              name={primaryActionIcon}
              size={18}
              color={tokens.colors.onPrimary}
            />
          </TouchableOpacity>
        </View>

        {/* Scanned Items Review Dialog / Bottom Sheet Modal */}
        <Modal
          visible={isReviewOpen}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsReviewOpen(false)}
        >
          <View style={styles.sheetOverlay}>
            <View style={styles.sheetContainer}>
              {/* Sheet Handle */}
              <View style={styles.sheetHandle} />

              {/* Sheet Header */}
              <View style={styles.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.sheetTitle}>Scanned Items</Text>
                    <View style={styles.sheetCountPill}>
                      <Text style={styles.sheetCountText}>{itemsCount} items</Text>
                    </View>
                  </View>
                  {Boolean(itemsValue > 0) && (
                    <Text style={styles.sheetSubtotalText}>
                      Total: {currencySymbol}{itemsValue.toFixed(2)}
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  testID="btn-close-review-sheet"
                  style={styles.sheetCloseBtn}
                  onPress={() => setIsReviewOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close review sheet"
                >
                  <Text style={styles.sheetCloseBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Scanned Items List */}
              <ScrollView
                style={styles.sheetScrollView}
                contentContainerStyle={styles.sheetScrollContent}
                showsVerticalScrollIndicator={true}
              >
                {scannedItems.length === 0 ? (
                  <View style={styles.emptyScannedContainer}>
                    <Ionicons name="scan-circle-outline" size={54} color={tokens.colors.secondaryFixedDim} />
                    <Text style={styles.emptyScannedTitle}>No Items Scanned Yet</Text>
                    <Text style={styles.emptyScannedSubtitle}>
                      Aim the camera at product barcodes to quickly scan and add items continuously.
                    </Text>
                  </View>
                ) : (
                  scannedItems.map((item, index) => {
                    const priceOrCost = item.priceOrCost !== undefined ? item.priceOrCost : 0
                    const itemTotal = priceOrCost * (item.quantity || 1)
                    return (
                      <View key={item.id || `scanned-${index}`} style={styles.itemRowCard}>
                        {/* Thumbnail or Fallback Icon */}
                        <View style={styles.itemThumbnailWrapper}>
                          {item.imageUrl ? (
                            <Image
                              source={{ uri: item.imageUrl }}
                              style={styles.itemThumbnail}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.itemThumbnailFallback}>
                              <Ionicons name="cube-outline" size={20} color={tokens.colors.primaryContainer} />
                            </View>
                          )}
                        </View>

                        {/* Item Details */}
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                          <View style={styles.itemMetaRow}>
                            {Boolean(item.sku) && (
                              <View style={styles.metaBadge}>
                                <Text style={styles.metaBadgeText}>{item.sku}</Text>
                              </View>
                            )}
                            {Boolean(item.barcode) && (
                              <View style={styles.barcodeBadge}>
                                <Ionicons name="barcode-outline" size={12} color={tokens.colors.secondary} />
                                <Text style={styles.barcodeBadgeText}>{item.barcode}</Text>
                              </View>
                            )}
                          </View>
                          {Boolean(priceOrCost > 0) && (
                            <Text style={styles.itemPriceText}>
                              {currencySymbol}{priceOrCost.toFixed(2)} each • Total: {currencySymbol}{itemTotal.toFixed(2)}
                            </Text>
                          )}
                        </View>

                        {/* Quantity Stepper & Remove */}
                        <View style={styles.itemActionsColumn}>
                          {onUpdateItemQuantity ? (
                            <View style={styles.quantityStepper}>
                              <TouchableOpacity
                                testID={`btn-dec-qty-${item.id}`}
                                style={styles.stepperBtn}
                                onPress={() => onUpdateItemQuantity(item.id, -1)}
                                accessibilityRole="button"
                                accessibilityLabel={`Decrease quantity for ${item.name}`}
                              >
                                <Ionicons
                                  name={item.quantity <= 1 ? 'trash-outline' : 'remove'}
                                  size={14}
                                  color={item.quantity <= 1 ? tokens.colors.statusError : tokens.colors.onBackground}
                                />
                              </TouchableOpacity>
                              <Text style={styles.stepperQtyText}>{item.quantity}</Text>
                              <TouchableOpacity
                                testID={`btn-inc-qty-${item.id}`}
                                style={styles.stepperBtn}
                                onPress={() => onUpdateItemQuantity(item.id, 1)}
                                accessibilityRole="button"
                                accessibilityLabel={`Increase quantity for ${item.name}`}
                              >
                                <Ionicons name="add" size={14} color={tokens.colors.onBackground} />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <View style={styles.readonlyQtyBadge}>
                              <Text style={styles.readonlyQtyText}>x{item.quantity}</Text>
                            </View>
                          )}

                          {onRemoveItem ? (
                            <TouchableOpacity
                              testID={`btn-remove-${item.id}`}
                              style={styles.trashBtn}
                              onPress={() => onRemoveItem(item.id)}
                              accessibilityRole="button"
                              accessibilityLabel={`Remove ${item.name}`}
                            >
                              <Ionicons name="trash-outline" size={15} color={tokens.colors.textMuted} />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                    )
                  })
                )}
              </ScrollView>

              {/* Sheet Bottom Footer Actions */}
              <View style={styles.sheetFooter}>
                <TouchableOpacity
                  testID="btn-sheet-keep-scanning"
                  style={styles.sheetKeepScanningBtn}
                  onPress={() => setIsReviewOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Keep scanning"
                >
                  <Ionicons name="camera-outline" size={18} color={tokens.colors.onBackground} />
                  <Text style={styles.sheetKeepScanningText}>Keep Scanning</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  testID="btn-sheet-go-register"
                  style={styles.sheetPrimaryBtn}
                  onPress={() => {
                    setIsReviewOpen(false)
                    handlePrimaryPress()
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={primaryActionLabel}
                >
                  <Text style={styles.sheetPrimaryBtnText}>{primaryActionLabel}</Text>
                  <Ionicons name={primaryActionIcon} size={18} color={tokens.colors.onPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surfaceInverse,
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : (Platform.OS === 'ios' ? 44 : 0),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm + 2,
    backgroundColor: tokens.colors.surfaceInverse,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232, 226, 217, 0.15)',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flexShrink: 1,
  },
  scannerBadge: {
    width: 36,
    height: 36,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: tokens.colors.actionPrimaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
  },
  headerTitle: {
    color: tokens.colors.surfaceBase,
    fontSize: tokens.typography.section.fontSize,
    fontWeight: '700',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  liveStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 5,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: tokens.colors.statusSuccess,
  },
  liveStatusText: {
    color: tokens.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs + 2,
    flexShrink: 0,
  },
  torchButton: {
    minHeight: tokens.touchTarget.minHeight,
    paddingHorizontal: tokens.spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    gap: 4,
  },
  torchButtonActive: {
    backgroundColor: tokens.colors.actionPrimaryBg,
    borderColor: tokens.colors.primaryContainer,
  },
  torchText: {
    color: tokens.colors.surfaceBase,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600',
  },
  torchTextActive: {
    color: tokens.colors.primaryContainer,
  },
  closeButton: {
    minHeight: tokens.touchTarget.minHeight,
    paddingHorizontal: tokens.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: tokens.borderRadius.pill,
  },
  closeButtonText: {
    color: tokens.colors.surfaceBase,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '700',
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#1D1B16',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.xl,
  },
  permissionIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.colors.actionPrimaryBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
  },
  permissionTitle: {
    color: tokens.colors.surfaceBase,
    fontSize: tokens.typography.title.fontSize,
    fontWeight: '700',
    marginBottom: tokens.spacing.xs,
    textAlign: 'center',
  },
  permissionText: {
    color: tokens.colors.textMuted,
    fontSize: tokens.typography.body.fontSize,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: tokens.spacing.lg,
  },
  permissionButton: {
    minHeight: tokens.touchTarget.actionButtonHeight,
    paddingHorizontal: tokens.spacing.xl,
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: tokens.borderRadius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.shadows.card,
  },
  permissionButtonText: {
    color: tokens.colors.onPrimary,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '700',
  },
  maskContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
  },
  maskTop: {
    flex: 1,
    backgroundColor: 'rgba(29, 27, 22, 0.7)',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing.xs + 4,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: '#1E1E1E',
    borderWidth: 1.5,
    borderColor: tokens.colors.primaryContainer,
    gap: 8,
    maxWidth: '92%',
    ...tokens.shadows.modal,
  },
  feedbackSuccess: {
    backgroundColor: 'rgba(22, 101, 52, 0.94)',
    borderColor: '#4ADE80',
  },
  feedbackWarning: {
    backgroundColor: 'rgba(146, 76, 0, 0.94)',
    borderColor: '#FDBA74',
  },
  feedbackError: {
    backgroundColor: 'rgba(186, 26, 26, 0.94)',
    borderColor: '#FCA5A5',
  },
  feedbackInfo: {
    backgroundColor: 'rgba(14, 116, 144, 0.94)',
    borderColor: '#67E8F9',
  },
  feedbackMessage: {
    color: tokens.colors.onPrimary,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '700',
  },
  feedbackSubmessage: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  maskCenterRow: {
    flexDirection: 'row',
    height: RETICLE_HEIGHT,
  },
  maskSide: {
    flex: 1,
    backgroundColor: 'rgba(29, 27, 22, 0.7)',
  },
  reticle: {
    width: RETICLE_WIDTH,
    height: RETICLE_HEIGHT,
    position: 'relative',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: tokens.colors.primaryContainer,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  crosshairH: {
    position: 'absolute',
    top: RETICLE_HEIGHT / 2 - 0.5,
    left: RETICLE_WIDTH / 2 - 12,
    width: 24,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  crosshairV: {
    position: 'absolute',
    top: RETICLE_HEIGHT / 2 - 12,
    left: RETICLE_WIDTH / 2 - 0.5,
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  laserLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: 1,
    shadowColor: tokens.colors.primaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  laserGlow: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 136, 0, 0.35)',
    borderRadius: 4,
  },
  maskBottom: {
    flex: 1.2,
    backgroundColor: 'rgba(29, 27, 22, 0.7)',
    alignItems: 'center',
    paddingTop: tokens.spacing.md,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(29, 27, 22, 0.85)',
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs + 2,
    borderRadius: tokens.borderRadius.pill,
    gap: 6,
  },
  hintText: {
    color: tokens.colors.surfaceBase,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(29, 27, 22, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.lg,
  },
  loadingCard: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.borderRadius.card,
    padding: tokens.spacing.lg,
    alignItems: 'center',
    width: '85%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    ...tokens.shadows.modal,
  },
  loadingTitle: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.section.fontSize,
    fontWeight: '700',
    marginTop: tokens.spacing.md,
    textAlign: 'center',
  },
  loadingSubtitle: {
    color: tokens.colors.secondary,
    fontSize: tokens.typography.caption.fontSize,
    marginTop: 4,
    textAlign: 'center',
  },
  bottomControlBar: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm + 2,
    paddingBottom: Platform.OS === 'ios' ? tokens.spacing.lg : tokens.spacing.md,
    borderTopLeftRadius: tokens.borderRadius.card,
    borderTopRightRadius: tokens.borderRadius.card,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    ...tokens.shadows.actionSheet,
  },
  reviewItemsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.card,
    paddingVertical: tokens.spacing.xs + 2,
    paddingHorizontal: tokens.spacing.sm + 2,
    gap: tokens.spacing.sm,
    minHeight: tokens.touchTarget.actionButtonHeight,
  },
  reviewItemsButtonActive: {
    backgroundColor: tokens.colors.actionPrimaryBg,
    borderColor: tokens.colors.primaryFixedDim,
  },
  reviewBadgeIcon: {
    position: 'relative',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
  },
  counterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: 10,
    paddingHorizontal: 4,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterBadgeText: {
    color: tokens.colors.onPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  reviewTextGroup: {
    flex: 1,
  },
  reviewButtonTitle: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '700',
  },
  reviewButtonSubtitle: {
    color: tokens.colors.secondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  primaryActionButton: {
    flex: 1.15,
    minHeight: tokens.touchTarget.actionButtonHeight,
    paddingHorizontal: tokens.spacing.md,
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: tokens.borderRadius.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...tokens.shadows.card,
  },
  primaryActionButtonSecondary: {
    backgroundColor: tokens.colors.primary,
  },
  primaryActionText: {
    color: tokens.colors.onPrimary,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '700',
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: 380,
    paddingTop: tokens.spacing.xs,
    paddingBottom: Platform.OS === 'ios' ? tokens.spacing.xl : tokens.spacing.md,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.borderSubtle,
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: tokens.spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.borderSubtle,
  },
  sheetTitle: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.title.fontSize,
    fontWeight: '800',
  },
  sheetCountPill: {
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.primaryFixedDim,
  },
  sheetCountText: {
    color: tokens.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  sheetSubtotalText: {
    color: tokens.colors.secondary,
    fontSize: tokens.typography.caption.fontSize,
    fontWeight: '600',
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: tokens.colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetCloseBtnText: {
    color: tokens.colors.onBackground,
    fontSize: 14,
    fontWeight: '700',
  },
  sheetScrollView: {
    flex: 1,
  },
  sheetScrollContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  emptyScannedContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.xxl,
    paddingHorizontal: tokens.spacing.xl,
  },
  emptyScannedTitle: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.section.fontSize,
    fontWeight: '700',
    marginTop: tokens.spacing.md,
  },
  emptyScannedSubtitle: {
    color: tokens.colors.secondary,
    fontSize: tokens.typography.body.fontSize,
    textAlign: 'center',
    marginTop: tokens.spacing.xs,
    lineHeight: 20,
  },
  itemRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceBright,
    borderRadius: tokens.borderRadius.md,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    padding: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs + 2,
    gap: tokens.spacing.sm,
  },
  itemThumbnailWrapper: {
    width: 44,
    height: 44,
    borderRadius: tokens.borderRadius.sm,
    backgroundColor: tokens.colors.surfaceAlt,
    overflow: 'hidden',
  },
  itemThumbnail: {
    width: 44,
    height: 44,
  },
  itemThumbnailFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '700',
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  metaBadge: {
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  metaBadgeText: {
    color: tokens.colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  barcodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    gap: 3,
  },
  barcodeBadgeText: {
    color: tokens.colors.secondary,
    fontSize: 10,
    fontWeight: '600',
  },
  itemPriceText: {
    color: tokens.colors.primary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  itemActionsColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quantityStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceAlt,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: tokens.colors.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperQtyText: {
    color: tokens.colors.onBackground,
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 8,
    minWidth: 24,
    textAlign: 'center',
  },
  readonlyQtyBadge: {
    backgroundColor: tokens.colors.actionPrimaryBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.borderRadius.pill,
  },
  readonlyQtyText: {
    color: tokens.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  trashBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
  },
  sheetKeepScanningBtn: {
    flex: 1,
    minHeight: tokens.touchTarget.actionButtonHeight,
    borderRadius: tokens.borderRadius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.borderDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: tokens.colors.surfaceContainerLowest,
  },
  sheetKeepScanningText: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '700',
  },
  sheetPrimaryBtn: {
    flex: 1.2,
    minHeight: tokens.touchTarget.actionButtonHeight,
    borderRadius: tokens.borderRadius.pill,
    backgroundColor: tokens.colors.primaryContainer,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...tokens.shadows.card,
  },
  sheetPrimaryBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '700',
  },
})

