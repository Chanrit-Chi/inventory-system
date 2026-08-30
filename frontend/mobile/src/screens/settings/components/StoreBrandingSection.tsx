import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { tokens } from '../../../theme/tokens'
import { styles } from '../SettingsScreen.styles'
import type { StoreBranding } from '../../../types'
import type { PrinterConfig } from '../../../utils/thermalPrinter'

export interface StoreBrandingSectionProps {
  branding: StoreBranding
  selectedLogoUri: string | null
  removeLogoFlag: boolean
  brandStoreName: string
  setBrandStoreName: (s: string) => void
  brandTagline: string
  setBrandTagline: (s: string) => void
  brandReceiptHeader: string
  setBrandReceiptHeader: (s: string) => void
  brandInvoiceHeader: string
  setBrandInvoiceHeader: (s: string) => void
  brandQuotationHeader: string
  setBrandQuotationHeader: (s: string) => void
  brandAddress: string
  setBrandAddress: (s: string) => void
  brandPhone: string
  setBrandPhone: (s: string) => void
  brandShowTax: boolean
  setBrandShowTax: (b: boolean) => void
  brandReceiptFooter: string
  setBrandReceiptFooter: (s: string) => void
  printerConfig: PrinterConfig
  setPrinterConfig: React.Dispatch<React.SetStateAction<PrinterConfig>>
  savingPrinter: boolean
  isBrandingSyncing: boolean
  onPickLogo: () => void
  onRemoveLogo: () => void
  onSaveStoreHeader: () => void
}

export const StoreBrandingSection: React.FC<StoreBrandingSectionProps> = ({
  branding,
  selectedLogoUri,
  removeLogoFlag,
  brandStoreName,
  setBrandStoreName,
  brandTagline,
  setBrandTagline,
  brandReceiptHeader,
  setBrandReceiptHeader,
  brandInvoiceHeader,
  setBrandInvoiceHeader,
  brandQuotationHeader,
  setBrandQuotationHeader,
  brandAddress,
  setBrandAddress,
  brandPhone,
  setBrandPhone,
  brandShowTax,
  setBrandShowTax,
  brandReceiptFooter,
  setBrandReceiptFooter,
  printerConfig,
  setPrinterConfig,
  savingPrinter,
  isBrandingSyncing,
  onPickLogo,
  onRemoveLogo,
  onSaveStoreHeader,
}) => {
  return (
    <>
      <View style={styles.sectionHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Branding & Receipt Template</Text>
          <Text style={styles.sectionSubtitle}>Cloud-synced logo, store identity & print template</Text>
        </View>
      </View>

      <View style={styles.printerCard}>
        {/* Logo Customization Card */}
        <Text style={styles.printerInputLabel}>STORE BRAND LOGO</Text>
        <View style={styles.brandingLogoRow}>
          <View style={styles.brandingLogoPreviewBox}>
            {selectedLogoUri ? (
              <Image source={{ uri: selectedLogoUri }} style={styles.brandingLogoImg} contentFit="contain" />
            ) : branding.logo_url && !removeLogoFlag ? (
              <Image source={{ uri: branding.logo_url }} style={styles.brandingLogoImg} contentFit="contain" />
            ) : (
              <Image source={require('../../../../assets/KC SHOP-No BG.png')} style={styles.brandingLogoImg} contentFit="contain" />
            )}
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={styles.logoPickerBtn}
                onPress={onPickLogo}
                activeOpacity={0.85}
              >
                <Ionicons name="image-outline" size={14} color={tokens.colors.onPrimary} />
                <Text style={styles.logoPickerBtnText}>Choose Logo</Text>
              </TouchableOpacity>

              {Boolean((selectedLogoUri || (branding.logo_url && !removeLogoFlag))) && (
                <TouchableOpacity
                  style={styles.logoRemoveBtn}
                  onPress={onRemoveLogo}
                  activeOpacity={0.85}
                >
                  <Ionicons name="trash-outline" size={14} color={tokens.colors.statusError} />
                  <Text style={styles.logoRemoveBtnText}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.brandingHelpText}>Supports PNG, JPG, WebP. High resolution 1:1 square recommended.</Text>
          </View>
        </View>

        {/* Header & Sub-Header */}
        <View style={[styles.printerFieldsGrid, { marginTop: tokens.spacing.md }]}>
          <View style={{ flex: 1.2 }}>
            <Text style={styles.printerInputLabel} numberOfLines={1}>STORE NAME (HEADER)</Text>
            <TextInput
              style={styles.printerTextInput}
              placeholder="e.g. KC Inventory"
              placeholderTextColor={tokens.colors.secondary}
              value={brandStoreName}
              onChangeText={setBrandStoreName}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.printerInputLabel} numberOfLines={1}>SUB-HEADER / SLOGAN</Text>
            <TextInput
              style={styles.printerTextInput}
              placeholder="e.g. Omnichannel Suite"
              placeholderTextColor={tokens.colors.secondary}
              value={brandTagline}
              onChangeText={setBrandTagline}
            />
          </View>
        </View>

        {/* Distinct Document Sub-Titles */}
        <View style={[styles.printerFieldsGrid, { marginTop: tokens.spacing.sm }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.printerInputLabel} numberOfLines={1}>RECEIPT TITLE</Text>
            <TextInput
              style={styles.printerTextInput}
              placeholder="e.g. Official Digital Tax Receipt"
              placeholderTextColor={tokens.colors.secondary}
              value={brandReceiptHeader}
              onChangeText={(text) => {
                setBrandReceiptHeader(text)
                setPrinterConfig((prev) => ({ ...prev, receiptTitle: text }))
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.printerInputLabel} numberOfLines={1}>INVOICE TITLE</Text>
            <TextInput
              style={styles.printerTextInput}
              placeholder="e.g. Official Tax Invoice"
              placeholderTextColor={tokens.colors.secondary}
              value={brandInvoiceHeader}
              onChangeText={(text) => {
                setBrandInvoiceHeader(text)
                setPrinterConfig((prev) => ({ ...prev, invoiceTitle: text }))
              }}
            />
          </View>
        </View>

        <View style={[styles.printerFieldsGrid, { marginTop: tokens.spacing.sm }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.printerInputLabel} numberOfLines={1}>QUOTATION TITLE</Text>
            <TextInput
              style={styles.printerTextInput}
              placeholder="e.g. Official Price Estimate"
              placeholderTextColor={tokens.colors.secondary}
              value={brandQuotationHeader}
              onChangeText={(text) => {
                setBrandQuotationHeader(text)
                setPrinterConfig((prev) => ({ ...prev, quotationTitle: text }))
              }}
            />
          </View>
        </View>

        {/* Address & Phone */}
        <View style={[styles.printerFieldsGrid, { marginTop: tokens.spacing.sm }]}>
          <View style={{ flex: 1.4 }}>
            <Text style={styles.printerInputLabel} numberOfLines={1}>STORE ADDRESS</Text>
            <TextInput
              style={styles.printerTextInput}
              placeholder="e.g. Phnom Penh, Cambodia"
              placeholderTextColor={tokens.colors.secondary}
              value={brandAddress}
              onChangeText={setBrandAddress}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.printerInputLabel} numberOfLines={1}>TEL PHONE</Text>
            <TextInput
              style={styles.printerTextInput}
              placeholder="e.g. +855 12 345 678"
              placeholderTextColor={tokens.colors.secondary}
              value={brandPhone}
              onChangeText={setBrandPhone}
            />
          </View>
        </View>

        {/* Optional Cashier Name Toggle */}
        <View style={[styles.autoCutRow, { marginTop: tokens.spacing.sm }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.autoCutLabel}>Print Cashier Name</Text>
            <Text style={styles.autoCutSub}>Include "Cashier: [Staff Name]" on receipts</Text>
          </View>
          <Switch
            value={printerConfig.showCashierName !== false}
            onValueChange={(val) => setPrinterConfig((prev) => ({ ...prev, showCashierName: val }))}
            trackColor={{ false: tokens.colors.surfaceMuted, true: tokens.colors.primaryContainer }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Optional Customer Info Toggle */}
        <View style={styles.autoCutRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.autoCutLabel}>Print Customer Details</Text>
            <Text style={styles.autoCutSub}>Include customer name & phone number</Text>
          </View>
          <Switch
            value={printerConfig.showCustomerInfo !== false}
            onValueChange={(val) => setPrinterConfig((prev) => ({ ...prev, showCustomerInfo: val }))}
            trackColor={{ false: tokens.colors.surfaceMuted, true: tokens.colors.primaryContainer }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Optional Tax Breakdown Toggle */}
        <View style={styles.autoCutRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.autoCutLabel}>Include Tax (Tax Included)</Text>
            <Text style={styles.autoCutSub}>Show "Tax (Included)" line on receipts & transaction details</Text>
          </View>
          <Switch
            value={brandShowTax}
            onValueChange={(val) => {
              setBrandShowTax(val)
              setPrinterConfig((prev) => ({ ...prev, showTax: val }))
            }}
            trackColor={{ false: tokens.colors.surfaceMuted, true: tokens.colors.primaryContainer }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Receipt Footer Message */}
        <View style={{ marginTop: tokens.spacing.sm }}>
          <Text style={styles.printerInputLabel}>RECEIPT FOOTER / RETURN POLICY</Text>
          <TextInput
            style={[styles.printerTextInput, { height: 60, textAlignVertical: 'top', paddingTop: 10 }]}
            placeholder="e.g. Thank you for shopping with us! Items sold are not returnable."
            placeholderTextColor={tokens.colors.secondary}
            value={brandReceiptFooter}
            onChangeText={setBrandReceiptFooter}
            multiline
            numberOfLines={2}
          />
        </View>

        <TouchableOpacity
          style={[styles.savePrinterBtn, { marginTop: tokens.spacing.md }]}
          onPress={onSaveStoreHeader}
          disabled={savingPrinter || isBrandingSyncing}
          activeOpacity={0.85}
        >
          {savingPrinter || isBrandingSyncing ? (
            <ActivityIndicator size="small" color={tokens.colors.onPrimary} />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={16} color={tokens.colors.onPrimary} />
              <Text style={styles.savePrinterBtnText}>Save & Sync to All Devices</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </>
  )
}
