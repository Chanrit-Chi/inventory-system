import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera'
import { tokens } from '../theme/tokens'

export interface CameraScannerModalProps {
  visible: boolean
  onClose: () => void
  onScanCode: (code: string) => Promise<void>
  isLoading: boolean
}

const RETICLE_WIDTH = 280
const RETICLE_HEIGHT = 190

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  visible,
  onClose,
  onScanCode,
  isLoading,
}) => {
  const [permission, requestPermission] = useCameraPermissions()
  const [manualCode, setManualCode] = useState('')
  const [isSubmittingManual, setIsSubmittingManual] = useState(false)
  const [isTorchOn, setIsTorchOn] = useState(false)

  // Animated laser line translation
  const laserAnim = useRef(new Animated.Value(0)).current

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

  // Reset torch and input on modal close
  useEffect(() => {
    if (!visible) {
      setIsTorchOn(false)
      setManualCode('')
    }
  }, [visible])

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (isLoading || !result.data) return
    onScanCode(result.data)
  }

  const handleManualSubmit = async () => {
    if (!manualCode.trim() || isLoading || isSubmittingManual) return
    setIsSubmittingManual(true)
    try {
      await onScanCode(manualCode.trim())
      setManualCode('')
    } finally {
      setIsSubmittingManual(false)
    }
  }

  const toggleTorch = () => {
    setIsTorchOn(prev => !prev)
  }

  const laserTranslateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, RETICLE_HEIGHT - 10],
  })

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.container}>
        {/* Warm Editorial Top Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerTitleGroup}>
            <View style={styles.scannerBadge}>
              <Ionicons name="barcode-outline" size={18} color={tokens.colors.primaryContainer} />
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>Scan Barcode / SKU</Text>
              <View style={styles.liveStatusRow}>
                <View style={styles.livePulseDot} />
                <Text style={styles.liveStatusText}>Ready to Scan</Text>
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
                Camera permission is required to scan product barcodes and QR codes directly at the register.
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
                {/* Top Mask */}
                <View style={styles.maskTop} />

                {/* Center Row */}
                <View style={styles.maskCenterRow}>
                  <View style={styles.maskSide} />

                  {/* Reticle Focus Window with 32px rounded corners and #FF8800 accents */}
                  <View style={styles.reticle}>
                    {/* Targeting Corner Brackets in #FF8800 */}
                    <View style={[styles.corner, styles.topLeft]} />
                    <View style={[styles.corner, styles.topRight]} />
                    <View style={[styles.corner, styles.bottomLeft]} />
                    <View style={[styles.corner, styles.bottomRight]} />

                    {/* Crosshair Target */}
                    <View style={styles.crosshairH} />
                    <View style={styles.crosshairV} />

                    {/* Animated Scanning Laser Line in Vibrant Orange */}
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
                      Align barcode or QR code inside the frame
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* Loading / Looking up Overlay */}
          {Boolean(isLoading) && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color={tokens.colors.primaryContainer} />
                <Text style={styles.loadingTitle}>Looking up item...</Text>
                <Text style={styles.loadingSubtitle}>Resolving SKU / master barcode in catalog</Text>
              </View>
            </View>
          )}
        </View>

        {/* Manual Code Entry Drawer (Bottom Sheet) */}
        <View style={styles.manualDrawer}>
          <View style={styles.drawerHandle} />

          <View style={styles.manualHeaderRow}>
            <Text style={styles.manualEntryLabel}>Manual Barcode / SKU Lookup</Text>
            <Text style={styles.manualEntrySub}>Type code or SKU if scanner cannot read</Text>
          </View>

          <View style={styles.manualInputRow}>
            <View style={styles.manualInputWrapper}>
              <TextInput
                testID="input-manual-barcode"
                style={styles.manualInput}
                placeholder="Enter barcode or SKU"
                placeholderTextColor={tokens.colors.textMuted}
                value={manualCode}
                onChangeText={setManualCode}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                numberOfLines={1}
                multiline={false}
                onSubmitEditing={handleManualSubmit}
              />
              {manualCode.length > 0 && (
                <TouchableOpacity
                  style={styles.clearInputBtn}
                  onPress={() => setManualCode('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.clearInputText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              testID="btn-submit-manual-barcode"
              style={[
                styles.manualSubmitButton,
                !manualCode.trim() && styles.manualSubmitButtonDisabled,
              ]}
              onPress={handleManualSubmit}
              disabled={!manualCode.trim() || isLoading || isSubmittingManual}
              accessibilityRole="button"
              activeOpacity={0.8}
            >
              {isSubmittingManual ? (
                <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
              ) : (
                <Text style={styles.manualSubmitText}>+ Add</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
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
    gap: 4,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
  manualDrawer: {
    backgroundColor: tokens.colors.surfaceContainerLowest,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? tokens.spacing.lg : tokens.spacing.md,
    borderTopLeftRadius: tokens.borderRadius.card,
    borderTopRightRadius: tokens.borderRadius.card,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.borderSubtle,
    ...tokens.shadows.actionSheet,
  },
  drawerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.borderSubtle,
    alignSelf: 'center',
    marginBottom: tokens.spacing.sm,
  },
  manualHeaderRow: {
    marginBottom: tokens.spacing.xs + 2,
  },
  manualEntryLabel: {
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '700',
  },
  manualEntrySub: {
    color: tokens.colors.secondary,
    fontSize: 11,
    marginTop: 1,
  },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  manualInputWrapper: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  manualInput: {
    minHeight: tokens.touchTarget.minHeight,
    backgroundColor: tokens.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: tokens.colors.borderSubtle,
    borderRadius: tokens.borderRadius.pill,
    paddingHorizontal: tokens.spacing.md,
    paddingRight: 36,
    color: tokens.colors.onBackground,
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '600',
  },
  clearInputBtn: {
    position: 'absolute',
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: tokens.colors.secondaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearInputText: {
    color: tokens.colors.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  manualSubmitButton: {
    minHeight: tokens.touchTarget.minHeight,
    minWidth: 84,
    paddingHorizontal: tokens.spacing.md,
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: tokens.borderRadius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    ...tokens.shadows.card,
  },
  manualSubmitButtonDisabled: {
    backgroundColor: tokens.colors.textDisabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  manualSubmitText: {
    color: tokens.colors.onPrimary,
    fontSize: tokens.typography.bodySemibold.fontSize,
    fontWeight: '700',
  },
})

