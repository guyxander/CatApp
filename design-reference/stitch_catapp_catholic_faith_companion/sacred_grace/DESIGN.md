---
name: Sacred Grace
colors:
  surface: '#fff9ef'
  surface-dim: '#dfd9d1'
  surface-bright: '#fff9ef'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f9f3ea'
  surface-container: '#f3ede4'
  surface-container-high: '#ede7df'
  surface-container-highest: '#e7e2d9'
  on-surface: '#1d1b16'
  on-surface-variant: '#514348'
  inverse-surface: '#32302a'
  inverse-on-surface: '#f6f0e7'
  outline: '#837378'
  outline-variant: '#d5c2c7'
  surface-tint: '#884b67'
  primary: '#30021c'
  on-primary: '#ffffff'
  primary-container: '#4a1731'
  on-primary-container: '#c27c9a'
  inverse-primary: '#fdb0d0'
  secondary: '#7e4c83'
  on-secondary: '#ffffff'
  secondary-container: '#fec0ff'
  on-secondary-container: '#7b4980'
  tertiary: '#1f1400'
  on-tertiary: '#ffffff'
  tertiary-container: '#382700'
  on-tertiary-container: '#b58a2c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffd8e6'
  primary-fixed-dim: '#fdb0d0'
  on-primary-fixed: '#380822'
  on-primary-fixed-variant: '#6d344f'
  secondary-fixed: '#ffd6fd'
  secondary-fixed-dim: '#efb2f1'
  on-secondary-fixed: '#33053b'
  on-secondary-fixed-variant: '#64346a'
  tertiary-fixed: '#ffdea4'
  tertiary-fixed-dim: '#f0bf5c'
  on-tertiary-fixed: '#261900'
  on-tertiary-fixed-variant: '#5d4200'
  background: '#fff9ef'
  on-background: '#1d1b16'
  surface-variant: '#e7e2d9'
typography:
  display-lg:
    fontFamily: Source Serif 4
    fontSize: 57px
    fontWeight: '400'
    lineHeight: 64px
    letterSpacing: -0.25px
  headline-lg:
    fontFamily: Source Serif 4
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Source Serif 4
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  title-lg:
    fontFamily: Work Sans
    fontSize: 22px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Source Serif 4
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Work Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.5px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  margin-mobile: 16px
  margin-tablet: 24px
  margin-desktop: 32px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
---

## Brand & Style

The design system is crafted for a Catholic prayer and community platform, specifically tailored for the Nigerian context. The brand personality is **contemplative, communal, and dignified**, balancing the ancient traditions of the Church with a modern, high-quality digital experience. 

The aesthetic follows a **Modern / Corporate** style influenced heavily by **Material 3 (M3)** principles, ensuring an "Android Native" feel that is familiar to the user base. It prioritizes "Sacred Space"—using generous white space and warm tones to minimize cognitive load, allowing the user to focus entirely on prayer and reflection. The visual language is premium yet accessible, evoking the feeling of a well-bound liturgical book.

## Colors

This design system utilizes a palette rooted in liturgical significance and warmth. 

- **Primary (Deep Burgundy):** Used for the App Bar, primary buttons, and critical navigation states. It represents the blood of Christ and the solemnity of the faith.
- **Secondary (Muted Purple):** Used for selection states, chips, and subtle gradients. It adds a layer of depth and penitential reflection.
- **Tertiary (Warm Gold):** Reserved for "Divine" highlights—liturgical season badges, icons for feasts, and active toggles. It provides a premium, celebratory accent.
- **Neutral/Background (Warm Cream):** This is the primary canvas. Unlike a harsh white, this cream reduces eye strain during long prayer sessions and mimics high-quality paper.
- **Surface (White):** Used for cards and modals to create clear elevation and separation from the cream background.
- **Text (Deep Charcoal):** High-contrast legibility for all UI elements and scriptures.

## Typography

The typography system uses a dual-font approach to distinguish between the "Sacred" and the "Functional."

- **Sacred Text (Source Serif 4):** This serif is used for all Scripture, prayers, and major headlines. It provides the authoritative, literary feel necessary for a spiritual app. Its high x-height ensures readability on mobile devices even at smaller sizes.
- **UI & Navigation (Work Sans):** This sans-serif is used for functional elements—menus, labels, settings, and button text. It is professional, neutral, and clear, ensuring the interface remains unobtrusive.

**Readability Note:** For long-form prayer text, use `body-lg` (Source Serif 4) with a generous `lineHeight` to prevent line-skipping and eye fatigue.

## Layout & Spacing

This design system adheres to a **Fluid Grid** model based on an 8px rhythm (with 4px increments for tighter components).

- **Grid:** A 4-column grid for mobile, 8-column for tablet, and 12-column for desktop.
- **Margins:** 16px lateral margins on mobile ensure content does not touch the edge of the screen, providing a "safe" feel.
- **Reflow:** Cards and lists expand to fill the container width. In tablet/desktop views, content-heavy screens (like the Rosary or Daily Mass readings) should be constrained to a maximum width of 720px to maintain comfortable line lengths for reading.
- **Vertical Rhythm:** Use consistent stack spacing (`stack-md` or 16px) between list items and cards to create a predictable flow.

## Elevation & Depth

In alignment with Material 3, depth is primarily conveyed through **Tonal Layers** rather than heavy shadows.

- **Level 0 (Background):** The Warm Cream (#F7F1E8) surface.
- **Level 1 (Cards/Surface):** Pure White (#FFFFFF) surfaces with a very soft, low-opacity shadow (4% opacity, Deep Charcoal) or a subtle 1px border in a slightly darker cream to define boundaries.
- **Level 2 (Modals/Menus):** These components use a slightly more pronounced shadow to indicate they are floating above the primary UI.
- **Interaction:** Upon press, cards should use a subtle "State Layer" (an overlay of the Primary color at 8-12% opacity) to provide tactile feedback without needing complex 3D effects.

## Shapes

The shape language is **Rounded**, reflecting a gentle and welcoming community.

- **Small Components (Chips, Tooltips):** 8px corner radius.
- **Medium Components (Cards, Input Fields, Buttons):** 12px-16px corner radius.
- **Large Components (Bottom Sheets, Dialogs):** 24px-28px corner radius on the top corners to create a "container" feel that cradles the content.
- **Standard Buttons:** Fully rounded "pill" shapes are avoided to maintain a more formal, traditional look; instead, use the `rounded-lg` (16px) standard.

## Components

- **Buttons:** Primary buttons use the Deep Burgundy background with White text. Secondary buttons use a Deep Burgundy outline with the Burgundy text.
- **Chips:** Used for liturgical seasons (e.g., "Lent," "Advent") or prayer categories. These should use the Muted Purple background at 10% opacity with Muted Purple text.
- **Cards:** Cards are the primary container for "Prayer of the Day" or community posts. They should be White with 16px padding and 16px corner radius.
- **Input Fields:** Use "Outlined" style with a 1px border. When focused, the border transitions to Deep Burgundy.
- **Lists:** Clean, divider-less lists with generous 16px vertical padding per item. Use a "Source Serif 4" title and "Work Sans" subtitle for list items.
- **Bottom Navigation:** Uses the Warm Cream background with Deep Burgundy for the active icon and label. Active icons should be contained within a tonal "pill" indicator (Secondary color at 20% opacity).
- **Progress Indicators:** For novenas or rosary tracking, use the Warm Gold for the progress bar to signify spiritual growth and value.