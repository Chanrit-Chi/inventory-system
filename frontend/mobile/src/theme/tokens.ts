export const tokens = {
  colors: {
    // Brand & Action Accents
    primary: '#924C00',               // Deep warm amber / wood tone for primary text/icons
    primaryContainer: '#FF8800',      // Vibrant safety orange — primary CTA, active tabs, steppers
    primaryFixed: '#FFDCC4',          // Light peach background for chips, steppers, badges
    primaryFixedDim: '#FFB781',       // Muted peach border / active indicator
    onPrimary: '#FFFFFF',             // White text on orange buttons
    onPrimaryContainer: '#613000',    // Dark brown text on orange container

    // Legacy / Convenience Action Aliases
    actionPrimary: '#FF8800',         // Vibrant KC Inventory orange
    actionPrimaryHover: '#E07700',
    actionPrimaryDark: '#924C00',     // Deep amber
    actionPrimaryBg: '#FFF3E0',       // Soft orange tint
    actionDestructive: '#BA1A1A',
    actionDestructiveBg: '#FFEDEA',

    // Surfaces & Backgrounds
    background: '#F8F5F0',            // Warm cream base screen background
    surface: '#F9F9F9',               // Light neutral surface
    surfaceBase: '#F8F5F0',           // Warm canvas
    surfaceAlt: '#F2ECE1',            // Secondary container / grouping
    surfaceCard: '#FFFFFF',           // Clean elevated white card
    surfaceMuted: '#EFE9DE',          // Inset container / input background
    surfaceInverse: '#1D1B16',        // Deep espresso dark
    surfaceOverlay: 'rgba(29, 27, 22, 0.65)',
    surfaceBright: '#F9F9F9',         // Bright surface for inputs
    surfaceDim: '#DADADA',            // Dimmed surface for subtle dividers
    surfaceContainerLowest: '#FFFFFF',// Pure white card surfaces and modals
    surfaceContainerLow: '#F3F3F4',   // Image thumbnail and subtle container background
    surfaceContainer: '#EEEEEE',      // Segmented control backgrounds, progress track
    surfaceContainerHigh: '#E8E8E8',  // Hover and divider states
    surfaceContainerHighest: '#E2E2E2',// Highest contrast surface container
    inverseSurface: '#2F3131',        // Dark surface for scanner overlay backdrop

    // Secondary Neutrals & Borders
    secondary: '#615E57',             // Secondary label text, meta timestamps
    secondaryContainer: '#E7E2D9',    // Avatar background, chip border
    secondaryFixed: '#E7E2D9',        // Card border color, subtle dividers
    secondaryFixedDim: '#CBC6BD',     // Muted secondary border
    onSecondary: '#FFFFFF',
    onSecondaryContainer: '#67645D',
    outline: '#8A7262',
    outlineVariant: '#E8E2D9',        // Standard card and input border
    border: '#E8E2D9',                // Standard border
    borderSubtle: '#E8E2D9',          // Standard border / subtle divider
    borderFocus: '#FF8800',
    borderDark: '#D4CDC2',

    // Typography Color Scale
    onBackground: '#1A1C1C',          // High-contrast primary text
    onSurface: '#1A1C1C',             // Primary card title and price text
    onSurfaceVariant: '#574335',      // Warm secondary body text
    textPrimary: '#1D1B16',           // Deep warm charcoal/espresso
    textSecondary: '#615E57',         // Editorial muted body
    textMuted: '#8E8A82',
    textTertiary: '#5F5E5E',          // Micro captions and inactive states
    textDisabled: '#C7C2B8',
    textInverse: '#FFFFFF',

    // Status & Feedback Colors
    statusSuccess: '#34A853',         // Completed sales, positive trend badges (+15%)
    statusError: '#BA1A1A',           // Stock warnings, negative difference, errors
    errorContainer: '#FFDAD6',        // Low stock card background
    onErrorContainer: '#93000A',      // Text on error container
    statusWarning: '#B8710A',         // Low stock warnings
    statusPending: '#FF8800',         // Pending order indicator
    statusPendingBg: 'rgba(255, 136, 0, 0.1)',
    statusInfo: '#FF8800',

    // Badge Backgrounds
    badgeWarningBg: '#FEF3C7',
    badgeSuccessBg: '#E6F4EA',
    badgeErrorBg: '#FFDAD6',
    badgeNeutralBg: '#EFEAE2',
    badgePrimaryBg: '#FFF3E0',

    // Payment Brand Colors (Cambodia Banking & Cash)
    accentAba: '#005F83',
    accentAbaBg: '#E0F2FE',
    accentAcleda: '#0D3880',
    accentAcledaBg: '#E6EDF8',
    accentWing: '#6EBE44',
    accentWingBg: '#EDF8E6',
    accentBank: '#1E3A8A',
    accentBankBg: '#FFF7ED',
    accentCash: '#16A34A',
    accentCashBg: '#DCFCE7',

    // Loyalty Tier Colors & Backgrounds
    tierBronze: '#92400E',
    tierBronzeBg: '#FEF3C7',
    tierBronzeBorder: '#FDE68A',
    tierSilver: '#4B5563',
    tierSilverBg: '#F3F4F6',
    tierSilverBorder: '#D1D5DB',
    tierGold: '#B45309',
    tierGoldBg: '#FEF9C3',
    tierGoldBorder: '#FDE047',
    tierPlatinum: '#5B21B6',
    tierPlatinumBg: '#EDE9FE',
    tierPlatinumBorder: '#DDD6FE',
  },
  spacing: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  touchTarget: {
    minHeight: 48,
    minWidth: 48,
    actionButtonHeight: 52,
    stepperButtonSize: 48,
  },
  typography: {
    // Space Grotesk / High-glanceability scale
    headlineLarge: {
      fontSize: 32,
      lineHeight: 38,
      fontWeight: '700' as const,
    },
    headlineLargeMobile: {
      fontSize: 24,
      lineHeight: 29,
      fontWeight: '700' as const,
    },
    headlineMedium: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '600' as const,
    },
    bodyLarge: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '500' as const,
    },
    bodyMedium: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '400' as const,
    },
    bodySemibold: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600' as const,
    },
    labelCaps: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600' as const,
      letterSpacing: 0.6,
    },
    priceDisplay: {
      fontSize: 18,
      lineHeight: 22,
      fontWeight: '700' as const,
    },
    statLarge: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '800' as const,
    },
    statHero: {
      fontSize: 48,
      lineHeight: 52,
      fontWeight: '700' as const,
    },

    // Legacy typography aliases so existing components don't break
    title: {
      fontSize: 20,
      lineHeight: 28,
      fontWeight: '700' as const,
    },
    titleLarge: {
      fontSize: 24,
      lineHeight: 32,
      fontWeight: '800' as const,
    },
    section: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '600' as const,
    },
    body: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '400' as const,
    },
    caption: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500' as const,
    },
    captionSmall: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '600' as const,
    },
    numericLarge: {
      fontSize: 26,
      lineHeight: 32,
      fontWeight: '800' as const,
    },
    numericMedium: {
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '700' as const,
    },
    numericSmall: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600' as const,
    },
  },
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    // Semantic naming
    card: 24,
    bento: 32,
    thumbnail: 16,
    input: 12,
    navBar: 32,
    pill: 9999,
    full: 9999,
  },
  shadows: {
    card: {
      shadowColor: '#1D1B16',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
    cardElevated: {
      shadowColor: '#1D1B16',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 4,
    },
    cardInnerDepth: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 4,
      elevation: 1,
    },
    floatingCart: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 6,
    },
    bottomNavBar: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 8,
    },
    actionSheet: {
      shadowColor: '#1D1B16',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 8,
    },
    modal: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 10,
    },
  },
}

export type DesignTokens = typeof tokens

