---
name: Premium Retail POS
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f4'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#574335'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#8a7262'
  outline-variant: '#dec1ae'
  surface-tint: '#924c00'
  primary: '#924c00'
  on-primary: '#ffffff'
  primary-container: '#ff8800'
  on-primary-container: '#613000'
  inverse-primary: '#ffb781'
  secondary: '#615e57'
  on-secondary: '#ffffff'
  secondary-container: '#e7e2d9'
  on-secondary-container: '#67645d'
  tertiary: '#5f5e5e'
  on-tertiary: '#ffffff'
  tertiary-container: '#a9a7a7'
  on-tertiary-container: '#3d3d3d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdcc4'
  primary-fixed-dim: '#ffb781'
  on-primary-fixed: '#2f1400'
  on-primary-fixed-variant: '#6f3800'
  secondary-fixed: '#e7e2d9'
  secondary-fixed-dim: '#cbc6bd'
  on-secondary-fixed: '#1d1b16'
  on-secondary-fixed-variant: '#494640'
  tertiary-fixed: '#e4e2e1'
  tertiary-fixed-dim: '#c8c6c6'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#474747'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '500'
    lineHeight: '1.5'
  body-md:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
  price-display:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '700'
    lineHeight: '1'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-margin: 24px
  gutter-md: 16px
  stack-sm: 8px
  stack-md: 12px
  stack-lg: 24px
  element-padding: 16px
---

## Brand & Style

This design system is engineered for a premium, high-efficiency retail environment. It balances the tactical requirements of a Point of Sale (POS) system—speed, clarity, and reliability—with a sophisticated aesthetic that feels warm and inviting rather than cold and industrial.

The style is **Modern Tactile**. It utilizes generous whitespace and softly rounded containers to reduce cognitive load during high-traffic retail hours. The interface leverages "inner depth" rather than traditional drop shadows to create a sense of embedded elements, suggesting a physical, high-end kiosk or tablet experience. The personality is professional yet approachable, catering to both boutique retail staff and modern service providers.

## Colors

The palette is anchored by a **Warm Cream (#FAF7F2)** background, which reduces eye strain compared to pure white while maintaining a clean, premium feel. 

- **Primary Action:** Vibrant Orange (#FF8800) is reserved exclusively for high-priority interactive elements like "Pay," "Add," and "Save."
- **Typography & Icons:** Deep Charcoal (#2D2D2D) provides high-contrast legibility without the harshness of pure black.
- **Secondary Surfaces:** Neutral White (#FFFFFF) is used for card backgrounds to pop against the warm cream page background.
- **Functional Accents:** Status indicators (Paid, Pending, Error) use high-visibility semi-transparent fills with saturated text to ensure clear communication of transaction states.

## Typography

This design system exclusively utilizes **Space Grotesk** to maintain a clean, technical, yet modern geometric feel. Its open apertures ensure high legibility on small tablet screens and handheld POS devices.

- **Headlines:** Used for page titles and major modal headers.
- **Body Text:** Optimized for item descriptions and customer details.
- **Price Display:** A specific weight/size combination used for financial figures to ensure they are the most prominent information on a card.
- **Labels:** Used for metadata (e.g., timestamps, invoice numbers) often in semi-bold to distinguish from body content.

## Layout & Spacing

The layout follows a **Fluid Content Model** designed for touch-first interaction. 

- **Safe Margins:** A consistent 24px margin is maintained around the primary viewport to prevent accidental edge-taps on mobile devices.
- **Grid:** On mobile, a single or 2-column card layout is used. On tablet/desktop, a 12-column grid is employed with cards typically spanning 3 or 4 columns.
- **Touch Targets:** All interactive elements (buttons, quantity selectors) maintain a minimum height of 48px to ensure ease of use in fast-paced environments.
- **Density:** The spacing is generous ("Airy") to prevent the interface from feeling cluttered when the product catalog is large.

## Elevation & Depth

Hierarchy is established through **Recessed Surfaces** and **Tonal Layering** rather than traditional floating shadows.

- **The Canvas:** The base layer is the Warm Cream surface.
- **The Cards:** White surfaces sit on top of the cream. Instead of a drop shadow, they use a very fine, 1px soft border or a subtle 2px inner shadow to feel "embedded" into the interface.
- **Active States:** When a card or item is selected (e.g., adding a dish to a cart), the primary orange accent color is used as a border or a high-visibility badge, moving the element visually to the foreground.
- **Modals/Bottom Sheets:** These use a soft backdrop blur (15-20px) to dim the background, keeping the focus entirely on the transaction or input task.

## Shapes

The design language is defined by **High Radius Geometry**. 

- **Primary Containers:** Large cards and major UI containers use a 24px (`rounded-xl`) corner radius.
- **Interactive Elements:** Buttons and input fields use a 16px to 20px radius to match the container language.
- **Selection Indicators:** Small radio-style checkmarks on item cards are fully circular (pill-shaped) to provide a distinct geometric contrast to the rectangular cards.

## Components

### Buttons
- **Primary:** Solid Orange (#FF8800) with white text. Pill-shaped or heavily rounded (24px).
- **Secondary:** Warm Cream background with Orange border and text. Used for "Add Item" or "Change" actions.
- **Ghost:** Transparent background with Charcoal text/icons for low-priority navigation.

### Cards (Product/Transaction)
- Background: White (#FFFFFF).
- Corner Radius: 24px.
- Styling: Subtle 1px border (#E8E2D9) or light inner shadow. 
- Features: Images within cards should have a 16px radius. Quantity toggles (+/-) should be integrated directly into the card footer.

### Input Fields
- Background: Very light cream or white.
- Border: 1px solid #E8E2D9.
- Focus State: Border color shifts to Primary Orange with a subtle outer glow.
- Icons: Search and filter icons should be placed inside the input field for a compact look.

### Navigation Bar
- Style: Floating or anchored bottom bar with high-radius (32px) container.
- Active State: The active icon is enclosed in a pill-shaped orange or cream background to clearly indicate the current view.

### Status Badges
- Used for "Paid," "Unpaid," or "Pending."
- Style: Low-opacity background of the status color (e.g., 10% Green) with high-opacity bold text of the same hue.