# Minefield: Signal - UI Guidelines

## 1. Grid & Spacing (The 4px / 8px System)
The UI strictly follows a 4-pixel baseline grid to ensure visual rhythm, hierarchy, and consistency across devices. This is natively supported by our Tailwind CSS configuration.

- **Base Unit:** `1 unit = 0.25rem = 4px`
- **Micro Spacing:** `1`, `2` (4px, 8px) - Used for tight groupings (e.g., icon and text).
- **Macro Spacing:** `4`, `6`, `8` (16px, 24px, 32px) - Used for section gaps and layout margins.

*Example:* Utilizing `mt-4` applies a 16px top margin. Utilizing `p-6` applies 24px of padding.

## 2. Typography
We use two custom web fonts to build the tactical, military-grade aesthetic.

- **Black Ops One (`font-ops`)**:
  - **Usage:** Primary headers, HUD values, and critical callouts.
  - **Vibe:** Stencil, military, impactful.
  - **Tailwind class:** `font-ops`

- **Quantico (`font-quantico`)**:
  - **Usage:** Body copy, metadata, small labels, and secondary UI elements.
  - **Vibe:** Digital, squared, modern operator readouts.
  - **Tailwind class:** `font-quantico`
  - **Weights:** Regular (400) and Bold (700).

## 3. Brand Colors (Tactical Palette)
Our custom color palette is baked into the Tailwind configuration. Use these semantic classes instead of raw hex codes to ensure consistency.

### Gold (High Visibility / Active Elements)
- `text-tactical-gold` (`#d9c36f`): Default HUD text and primary accents.
- `text-tactical-gold-light` (`#f4d66d`): Highlights, warnings, and strong tags.
- `text-tactical-gold-dim` (`#d6c27a`): Subtitles and muted/secondary accents.

### Olive (Base Tactical Elements / Backgrounds)
- `bg-tactical-olive` (`#8f896b`): Primary tactical chips and badges.
- `bg-tactical-olive-dark` (`#7e785c`): Pressed states, borders, or secondary badges.

### Dark (Canvas / Shell)
- `bg-tactical-dark` (`#11110d`): Absolute background color behind the web canvas.
- `bg-tactical-panel` (`#15160f`): Inset panels and dark HUD chips.