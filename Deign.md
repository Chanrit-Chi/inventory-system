# Inventory System Design System Specification

## Overview
This document defines the design system for the inventory system to ensure visual consistency between Mobile (React Native) and Web (Vue 3) implementations. The design follows a premium retail POS theme with warm cream/amber aesthetics.

## Color Palette

### Base Colors
- **Surface/Base**: `#FAF7F2` (cream/off-white)
- **Surface Variant**: `#F8F5F0` (slightly darker cream)
- **Primary**: `#924C00` (deep amber/brown)
- **Primary Container**: `#FF8800` (vibrant orange)
- **Secondary**: Derived from Primary Container variations
- **Tertiary**: Complementary to Primary for accents

### Neutral Colors
- **Surface (Highest)**: `#FFFFFF` (pure white for cards/elevated elements)
- **Background**: `#FAF7F2` (main app background)
- **Surface Dim**: `#F0EDE8` (for disabled states)
- **Outline**: `#E0DED9` (subtle borders)
- **Inverse Surface**: `#2D2D2D` (deep charcoal for dark text on light surfaces)
- **Inverse On Surface**: `#FFFFFF` (white text on dark surfaces)

### Text Colors
- **On Surface (Primary)**: `#2D2D2D` (deep charcoal - main text)
- **On Surface (Secondary)**: `#424242` (medium gray - secondary text)
- **On Surface (Tertiary)**: `#666666` (light gray - hint text, placeholders)
- **On Surface (Disabled)**: `#B0B0B0` (very light gray - disabled text)
- **On Primary Container**: `#FFFFFF` (white text on vibrant orange)
- **On Secondary Container**: `#2D2D2D` (deep charcoal text on secondary backgrounds)

### State Colors
- **Success**: `#10B981` (emerald green)
- **Warning**: `#F59E0B` (amber)
- **Error**: `#EF4444` (red)
- **Info**: `#3B82F6` (blue)

## Typography

### Font Family
- **Primary**: Space Grotesk (Google Font)
- **Fallback**: System UI, sans-serif

### Type Scale
- **Headline Large**: 32px, font-weight 700, line-height 38px
- **Headline Medium**: 20px, font-weight 600, line-height 24px
- **Headline Small**: 16px, font-weight 600, line-height 20px
- **Title Large**: 20px, font-weight 500, line-height 24px
- **Title Medium**: 16px, font-weight 500, line-height 20px
- **Title Small**: 14px, font-weight 500, line-height 18px
- **Body Large**: 16px, font-weight 500, line-height 20px
- **Body Medium**: 14px, font-weight 400, line-height 18px
- **Body Small**: 12px, font-weight 400, line-height 16px
- **Label Large**: 14px, font-weight 500, text-transform: uppercase, letter-spacing 0.15px
- **Label Medium**: 12px, font-weight 500, text-transform: uppercase, letter-spacing 0.5px
- **Label Small**: 11px, font-weight 500, text-transform: uppercase, letter-spacing 0.5px
- **Price Display**: 18px, font-weight 700, line-height 22px

### Text Styles
- **Hero Text**: Headline Large + Primary color
- **Section Title**: Headline Medium + On Surface color
- **Card Title**: Title Large + On Surface color
- **Body Text**: Body Large + On Surface (Secondary)
- **Hint Text**: Body Small + On Surface (Tertiary)
- **Labels**: Label Medium + On Surface (Secondary)
- **Price**: Price Display + Primary color
- **Buttons**: Label Large + On Primary Container (for Primary buttons) or On Surface (for Secondary/Ghost)

## Geometry & Spacing

### Border Radius
- **None**: 0px
- **XS**: 4px
- **SM**: 8px
- **MD**: 12px
- **LG**: 16px
- **XL**: 20px
- **Full**: 9999px (pills, circles)

### Spacing System
- **XXXS**: 2px
- **XXS**: 4px
- **XS**: 6px
- **SM**: 8px
- **MD**: 12px
- **LG**: 16px
- **XL**: 20px
- **XXL**: 24px
- **XXXL**: 32px
- **XXXXL**: 40px

### Layout Spacing
- **Container Margin**: 24px (horizontal padding on mobile screens)
- **Gutter XXS**: 4px
- **Gutter XS**: 6px
- **Gutter SM**: 8px
- **Gutter MD**: 12px
- **Gutter LG**: 16px
- **Gutter XL**: 20px
- **Stack XXS**: 2px
- **Stack XS**: 4px
- **Stack SM**: 6px
- **Stack MD**: 8px
- **Stack LG**: 12px
- **Stack XL**: 16px

### Element Padding
- **Button Min**: 12px (vertical)
- **Button Default**: 16px (vertical)
- **Button Max**: 20px (vertical)
- **Input Padding**: 16px (vertical), 12px (horizontal)
- **Card Padding**: 16px (all sides)
- **List Item Padding**: 16px (vertical), 12px (horizontal)
- **Modal Padding**: 24px (all sides)

## Elevation & Shadows

### Shadow Types
- **Recessed**: Inner shadow for pressed states
- **Floating**: Drop shadow for elevated elements
- **Tonal**: Subtle shadow for layering
- **None**: No shadow

### Shadow Values (Mobile)
- **Elevation 1**: 
  - Shadow Color: rgba(0, 0, 0, 0.05)
  - Shadow Offset: {width: 0, height: 1}
  - Shadow Radius: 2
  - Shadow Opacity: 0.05
- **Elevation 2**:
  - Shadow Color: rgba(0, 0, 0, 0.08)
  - Shadow Offset: {width: 0, height: 2}
  - Shadow Radius: 3
  - Shadow Opacity: 0.08
- **Elevation 3**:
  - Shadow Color: rgba(0, 0, 0, 0.10)
  - Shadow Offset: {width: 0, height: 3}
  - Shadow Radius: 4
  - Shadow Opacity: 0.10

### CSS Shadow Equivalents (Web)
- **Elevation 1**: `0px 1px 2px rgba(0, 0, 0, 0.05)`
- **Elevation 2**: `0px 2px 3px rgba(0, 0, 0, 0.08)`
- **Elevation 3**: `0px 3px 4px rgba(0, 0, 0, 0.10)`
- **Inner Shadow (pressed)**: `inset 0px 1px 2px rgba(0, 0, 0, 0.05)`

## Component Specifications

### Cards
- **Background**: Surface (Highest) - `#FFFFFF`
- **Border**: 1px solid Outline - `#E0DED9`
- **Border Radius**: LG - 16px
- **Padding**: XL - 20px
- **Shadow**: Elevation 1
- **Hover State**: Elevation 2
- **Pressed State**: Elevation 0 + Inner Shadow

### Buttons

#### Primary Button
- **Background**: Primary Container - `#FF8800`
- **Text Color**: On Primary Container - `#FFFFFF`
- **Border**: None
- **Border Radius**: MD - 12px
- **Padding**: Button Default - 16px vertical, 24px horizontal
- **Font**: Label Large - 14px, font-weight 500, uppercase
- **Hover**: Background - `#FF9933` (10% lighter)
- **Pressed**: Background - `#E67A00` (10% darker) + Inner Shadow
- **Disabled**: Background - Outline (`#E0DED9`), Text Color - On Surface (Disabled) - `#B0B0B0`

#### Secondary Button
- **Background**: Transparent
- **Text Color**: Primary - `#924C00`
- **Border**: 1px solid Primary Container - `#FF8800`
- **Border Radius**: MD - 12px
- **Padding**: Button Default - 16px vertical, 24px horizontal
- **Font**: Label Large - 14px, font-weight 500, uppercase
- **Hover**: Background - rgba(255, 136, 0, 0.08)
- **Pressed**: Background - rgba(255, 136, 0, 0.12)
- **Disabled**: Border Color - Outline (`#E0DED9`), Text Color - On Surface (Disabled) - `#B0B0B0`

#### Ghost Button
- **Background**: Transparent
- **Text Color**: On Surface (Secondary) - `#424242`
- **Border**: None
- **Border Radius**: MD - 12px
- **Padding**: Button Default - 16px vertical, 24px horizontal
- **Font**: Label Large - 14px, font-weight 500, uppercase
- **Hover**: Background - rgba(0, 0, 0, 0.04)
- **Pressed**: Background - rgba(0, 0, 0, 0.08)
- **Disabled**: Text Color - On Surface (Disabled) - `#B0B0B0`

### Input Fields
- **Background**: Surface (Highest) - `#FFFFFF`
- **Text Color**: On Surface (Primary) - `#2D2D2D`
- **Placeholder Color**: On Surface (Tertiary) - `#666666`
- **Border**: 1px solid Outline - `#E0DED9`
- **Border Radius**: MD - 12px
- **Padding**: 16px vertical, 12px horizontal
- **Font**: Body Large - 16px, font-weight 500
- **Focus State**: 
  - Border: 2px solid Primary Container - `#FF8800`
  - Box Shadow: 0px 0px 0px 2px rgba(255, 136, 0, 0.2)
- **Error State**:
  - Border: 1px solid Error - `#EF4444`
  - Background: rgba(239, 68, 68, 0.04)
- **Disabled State**:
  - Background: Surface Dim - `#F0EDE8`
  - Border Color: Outline - `#E0DED9`
  - Text Color: On Surface (Disabled) - `#B0B0B0`
  - Placeholder Color: On Surface (Disabled) - `#B0B0B0`

### Modals
- **Background**: Surface (Highest) - `#FFFFFF`
- **Border Radius**: XL - 20px
- **Padding**: XXL - 24px
- **Shadow**: Elevation 3
- **Backdrop**: 
  - Background: rgba(0, 0, 0, 0.32)
  - Blur: 8px (iOS/Android-style backdrop blur)
- **Close Button**:
  - Size: 24px × 24px
  - Icon Color: On Surface (Tertiary) - `#666666`
  - Hover Background: rgba(0, 0, 0, 0.04)
  - Pressed Background: rgba(0, 0, 0, 0.08)

### Badges/Pills
- **Background**: 
  - Primary: Primary Container - `#FF8800`
  - Secondary: Surface Variant - `#F8F5F0`
  - Success: Success - `#10B981`
  - Warning: Warning - `#F59E0B`
  - Error: Error - `#EF4444`
  - Info: Info - `#3B82F6`
- **Text Color**:
  - Primary: On Primary Container - `#FFFFFF`
  - Secondary: On Surface (Primary) - `#2D2D2D`
  - Success/Warning/Info/Error: On Surface (Primary) - `#FFFFFF`
- **Border Radius**: Full - 9999px
- **Padding**: XS - 6px vertical, SM - 8px horizontal
- **Font**: Label Medium - 12px, font-weight 500, uppercase

### Lists & Dividers
- **List Item Background**: Surface (Highest) - `#FFFFFF`
- **List Item Padding**: LG - 16px vertical, MD - 12px horizontal
- **Divider Height**: 1px
- **Divider Color**: Outline - `#E0DED9`
- **Inset Divider Margin**: XXS - 4px (from leading edge)

## Navigation & Layout

### Bottom Navigation (Mobile)
- **Background**: Surface (Highest) - `#FFFFFF`
- **Height**: 56px
- **Border Top**: 1px solid Outline - `#E0DED9`
- **Icon Size**: 24px
- **Icon Color**:
  - Active: Primary Container - `#FF8800`
  - Inactive: On Surface (Tertiary) - `#666666`
- **Label Font**: Label Medium - 12px, font-weight 500, uppercase
- **Label Color**:
  - Active: Primary Container - `#FF8800`
  - Inactive: On Surface (Tertiary) - `#666666`

### Top App Bar (Web/Mobile)
- **Background**: Surface (Highest) - `#FFFFFF`
- **Height**: 56px
- **Border Bottom**: 1px solid Outline - `#E0DED9`
- **Content Padding**: LG - 16px horizontal
- **Title Font**: Headline Medium - 20px, font-weight 600
- **Title Color**: On Surface (Primary) - `#2D2D2D`
- **Action Icon Size**: 24px
- **Action Icon Color**: On Surface (Secondary) - `#424242`

### Sidebar (Web)
- **Width**: 256px (collapsible to 64px)
- **Background**: Surface (Highest) - `#FFFFFF`
- **Border Right**: 1px solid Outline - `#E0DED9`
- **Padding**: LG - 16px vertical
- **Item Height**: 48px
- **Item Padding**: MD - 12px horizontal
- **Item Border Radius**: MD - 12px
- **Item Font**: Body Large - 16px, font-weight 500
- **Item Color**:
  - Active: Primary Container - `#FF8800` (background), On Primary Container - `#FFFFFF` (text)
  - Inactive: On Surface (Secondary) - `#424242` (text)
  - Hover: Surface Variant - `#F8F5F0` (background)
- **Icon Size**: 20px
- **Icon Color**:
  - Active: On Primary Container - `#FFFFFF`
  - Inactive: On Surface (Secondary) - `#424242`

## Icons & Imagery

### Icon Style
- **Style**: Outline/Consistent weight
- **Size System**:
  - XS: 16px
  - SM: 20px
  - MD: 24px
  - LG: 28px
  - XL: 32px
- **Color**: Follows text color hierarchy (Primary, Secondary, Tertiary)

### Logo Usage
- **Primary Logo**: `frontend/mobile/assets/logo.png` (KC SHOP-No BG.png)
- **Alternative**: `frontend/mobile/assets/KC SHOP-No BG.png`
- **Favicon**: `frontend/mobile/assets/favicon.png`
- **Usage**:
  - Header/Branding: Full color logo
  - Favicon/App Icon: Monochrome or simplified version
  - Empty States: Logo with appropriate scaling

## Animation & Motion

### Duration Standards
- **Fast**: 150ms (button presses, toggles)
- **Moderate**: 250ms (page transitions, modal appearance)
- **Slow**: 350ms (complex animations, drawer transitions)

### Easing Curves
- **Standard**: cubic-bezier(0.4, 0, 0.2, 1)
- **Acceleration**: cubic-bezier(0.4, 0, 1, 1)
- **Deceleration**: cubic-bezier(0, 0, 0.2, 1)
- **Sharp**: cubic-bezier(0.4, 0, 0.6, 1)

### Specific Transitions
- **Button Press**: Scale 0.95 → 1.0 (150ms)
- **Modal Fade**: Opacity 0 → 1, Scale 0.95 → 1.0 (250ms)
- **Page Slide**: TranslateX 100% → 0% (250ms)
- **Drawer Slide**: TranslateX -100% → 0% (250ms)
- **Search Expand**: Width 0 → 100% (250ms)

## Platform-Specific Adaptations

### Web Adaptations
- **Hover States**: All interactive elements should have hover states
- **Focus Rings**: 2px solid Primary Container with 2px offset for keyboard accessibility
- **Scrollbar Styling**: Thin scrollbars with Primary Container color on hover
- **Hover Cards**: Elevation increase on hover for cards
- **Hover Badges**: Slight scale increase (1.05) on hover

### Mobile Adaptations
- **Press Feedback**: Scale or ripple effect on press
- **Safe Area**: Respect device notches and home indicators
- **Keyboard Avoidance**: Scroll content when keyboard appears
- **Touchable Areas**: Minimum 48x48pt for touch targets

## Implementation Guidelines

### CSS Variables (Web)
```css
:root {
  /* Colors */
  --color-surface-highest: #FFFFFF;
  --color-surface-base: #FAF7F2;
  --color-surface-variant: #F8F5F0;
  --color-surface-dim: #F0EDE8;
  --color-primary: #924C00;
  --color-primary-container: #FF8800;
  --color-on-surface-primary: #2D2D2D;
  --color-on-surface-secondary: #424242;
  --color-on-surface-tertiary: #666666;
  --color-on-surface-disabled: #B0B0B0;
  --color-on-primary-container: #FFFFFF;
  --color-outline: #E0DED9;
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;
  
  /* Typography */
  --font-family: 'Space Grotesk', system-ui, sans-serif;
  --font-weight-light: 300;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  
  /* Spacing */
  --spacing-xxxs: 2px;
  --spacing-xxs: 4px;
  --spacing-xs: 6px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 20px;
  --spacing-xxl: 24px;
  --spacing-xxxl: 32px;
  --spacing-xxxxl: 40px;
  
  /* Border Radius */
  --radius-none: 0px;
  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-full: 9999px;
  
  /* Elevation */
  --elevation-1: 0px 1px 2px rgba(0, 0, 0, 0.05);
  --elevation-2: 0px 2px 3px rgba(0, 0, 0, 0.08);
  --elevation-3: 0px 3px 4px rgba(0, 0, 0, 0.10);
  --inner-shadow: inset 0px 1px 2px rgba(0, 0, 0, 0.05);
}
```

### Component Token Mapping (Reference from mobile/theme/tokens.ts)
All Web components should reference these values directly or through CSS variables to maintain exact parity with Mobile implementation.

### Asset Usage
- **Logo**: Use `frontend/mobile/assets/logo.png` as primary brand asset
- **Icons**: Use `@expo/vector-icons` equivalents in Web (Material Community Icons or similar)
- **Images**: Optimize for web use while maintaining quality

## Accessibility Considerations

### Color Contrast
- **Text on Surface**: Minimum 4.5:1 contrast ratio
- **Large Text**: Minimum 3:1 contrast ratio
- **UI Components**: Minimum 3:1 contrast ratio for interactive elements
- **Disabled States**: May have lower contrast but should be clearly distinguishable

### Touch Targets
- **Minimum Size**: 48x48dp (Mobile) / 44x44px (Web)
- **Recommended Size**: 56x56dp / 52x52px for frequently used actions

### Typography
- **Minimum Text Size**: 12px for body text, 11px for labels
- **Line Height**: Minimum 1.4 for readability
- **Letter Spacing**: Follow specified values to maintain design integrity

### Focus Management
- **Visible Focus**: All interactive elements must have visible focus indicator
- **Focus Order**: Logical tab order following visual flow
- **Skip Links**: Provide mechanism to skip to main content on Web

## Usage Examples

### Card Component Structure
```html
<div class="card">
  <div class="card-content">
    <h3 class="card-title">Card Title</h3>
    <p class="card-body">Card body content...</p>
  </div>
</div>
```

### Button Variants
```html
<button class="btn btn--primary">Primary Action</button>
<button class="btn btn--secondary">Secondary Action</button>
<button class="btn btn--ghost">Ghost Action</button>
```

### Input Field
```html
<div class="input-field">
  <label class="input-label">Label</label>
  <input type="text" class="input" placeholder="Placeholder text">
</div>
```

### Modal Structure
```html
<div class="modal-backdrop"></div>
<div class="modal">
  <div class="modal-header">
    <h3 class="modal-title">Modal Title</h3>
    <button class="btn-icon btn-icon--close">&times;</button>
  </div>
  <div class="modal-body">
    <!-- Modal content -->
  </div>
  <div class="modal-footer">
    <!-- Modal actions -->
  </div>
</div>
```

---
*This design system ensures perfect visual fidelity between Mobile (React Native) and Web (Vue 3) implementations of the inventory system.*