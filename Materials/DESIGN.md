---
name: Nexife Salon Platform
colors:
  surface: '#fbf9f8'
  surface-dim: '#dbdad9'
  surface-bright: '#fbf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f3'
  surface-container: '#efeded'
  surface-container-high: '#e9e8e7'
  surface-container-highest: '#e4e2e2'
  on-surface: '#1b1c1c'
  on-surface-variant: '#4d463a'
  inverse-surface: '#303031'
  inverse-on-surface: '#f2f0f0'
  outline: '#7f7668'
  outline-variant: '#d0c5b5'
  surface-tint: '#735b24'
  primary: '#735b24'
  on-primary: '#ffffff'
  primary-container: '#c8a96a'
  on-primary-container: '#533d07'
  inverse-primary: '#e3c281'
  secondary: '#5f5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e4e2e1'
  on-secondary-container: '#656464'
  tertiary: '#5d5f5d'
  on-tertiary: '#ffffff'
  tertiary-container: '#acadab'
  on-tertiary-container: '#3f4140'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdf9f'
  primary-fixed-dim: '#e3c281'
  on-primary-fixed: '#261a00'
  on-primary-fixed-variant: '#5a430e'
  secondary-fixed: '#e4e2e1'
  secondary-fixed-dim: '#c8c6c6'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#474747'
  tertiary-fixed: '#e2e3e1'
  tertiary-fixed-dim: '#c6c7c5'
  on-tertiary-fixed: '#1a1c1b'
  on-tertiary-fixed-variant: '#454746'
  background: '#fbf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e2'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

The design system is rooted in a **Modern Minimalist** aesthetic with **Glassmorphic** accents to signify its AI-first capabilities. The brand persona is professional, sophisticated, and technologically advanced, aiming to evoke a sense of calm efficiency for salon owners. 

The visual language focuses on extreme clarity, high-end editorial spacing, and a "quiet luxury" feel. By combining the systematic rigor of developer-centric tools like Linear with the soft, tactile elegance of premium lifestyle brands, the UI positions itself as a high-performance tool that feels premium rather than purely utilitarian.

## Colors

The palette utilizes **Champagne Gold** as the primary signal color, reserved for high-intent actions and AI-driven insights. **Charcoal** provides the structural grounding for typography and primary navigation, ensuring a high-contrast, professional readability.

The background uses a **Soft Off-White** to reduce eye strain during long administrative sessions. Semantic colors (Success, Warning, Error) are desaturated and deep-toned to maintain the premium, understated atmosphere without appearing jarring against the gold and charcoal base.

## Typography

This design system employs a dual-typeface strategy. **Manrope** is used for headlines and display metrics to provide a structured, modern, and slightly technical appearance. **Plus Jakarta Sans** is used for all body text and interface labels, offering a softer, more approachable feel that balances the precision of the headlines.

Large metrics (e.g., revenue, booking percentages) should use `display-lg` with a tight letter-spacing to emphasize the AI-driven data. All labels use an uppercase treatment with increased tracking to create a sophisticated, "magazine-style" hierarchy.

## Layout & Spacing

The layout follows a **Fixed-Fluid hybrid grid**. Sidebars and navigation are fixed-width, while the main content area utilizes a 12-column fluid grid. To maintain the premium feel, "generous whitespace" is the guiding principle—avoiding information density in favor of focused, breathable modules.

**Breakpoints:**
- **Mobile (up to 768px):** 4-column grid, 16px margins. Headlines scale down to mobile variants.
- **Tablet (769px - 1200px):** 8-column grid, 24px margins.
- **Desktop (1201px+):** 12-column grid, 40px margins. Content max-width capped at 1440px for optimal readability.

Internal component spacing (padding) should lean towards the `md` and `lg` tokens to ensure elements never feel crowded.

## Elevation & Depth

This design system uses **Tonal Layers** combined with **Ambient Shadows** to create a sense of organized depth. 

- **Surface Level 0:** The main background (#F8F8F6).
- **Surface Level 1:** Primary cards and containers. These use a pure white background with a very soft, diffused shadow (Blur: 20px, Y: 4px, Opacity: 4% Charcoal).
- **Surface Level 2:** Modals and dropdowns. These use a subtle backdrop blur (Glassmorphism) when overlaying content to maintain the AI-first, high-tech aesthetic. 

Borders are kept to a minimum, used only where tonal separation is insufficient. When used, borders are 1px solid with a very low-contrast tint of the secondary color (approx 10% opacity).

## Shapes

The shape language is defined by **large, friendly radii**. Primary containers and cards use `rounded-xl` (1.5rem) to soften the professional charcoal and gold palette. 

- **Interactive Elements:** Buttons and input fields use `rounded-lg` (1rem).
- **Small Elements:** Chips and tags use the `rounded-xl` setting to achieve a pill-like appearance, signifying fluidity and ease of use.
- **AI Elements:** Special AI-suggested insights or "Smart Blocks" may use a slightly larger radius than standard cards to visually distinguish them as "organic" software intelligence.

## Components

### Buttons
- **Primary:** Champagne Gold background with Charcoal text. Bold weight. No border.
- **Secondary:** Transparent background with Charcoal 1px border. 
- **Tertiary/Ghost:** No background or border. Primary Gold text for subtle actions.

### Cards
- Always use Surface Level 1 elevation.
- Generous internal padding (24px to 32px).
- Headings within cards should be `headline-md` for clear sectioning.

### Input Fields
- Soft Off-White background. 
- Border only appears on focus (1.5px Champagne Gold).
- Labels use `label-md` and sit 8px above the field.

### Chips & Badges
- Used for "Service Categories" or "Staff Roles."
- Low-saturation background tints of the primary/secondary colors.
- Always pill-shaped.

### Large Metrics (KPIs)
- Use `display-lg` for the value.
- Include a small sub-text label for context using `label-sm`.
- Often paired with a subtle trend icon (Success/Error colors).

### AI Insights Sidebar
- Uses a subtle glassmorphic blur.
- Champagne Gold accent line on the left edge to denote "active intelligence."