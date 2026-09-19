# Formwork Swiss UI system

## Direction

Minimal Swiss editorial dashboard for a training group. Use a strict grid, left alignment, compact labels, black typography, warm white space, and one strong signal color. Every screen should feel like a clear printed training sheet made interactive.

## Tokens

- Canvas: `#f7f7f3`
- Surface: `#ffffff`
- Ink: `#171817`
- Muted ink: `#687069`
- Rule: `#d6d9d4`
- Signal red: `#df3f32`
- Success green: `#16734a`
- Information blue: `#2456c5`
- Radius: 3–6px for surfaces, 999px only for status tags
- Shadows: none
- Motion: short opacity/color transitions only, disabled under `prefers-reduced-motion`

## Typography

Use Helvetica Neue, Helvetica, Arial, or the system sans stack. Display headings are bold and tightly tracked. Body copy is compact and calm. Use uppercase micro-labels sparingly for metadata and section names.

## Components

- Navigation is text-first. Icons are optional and must be SVG or CSS, never emoji.
- Cards use white surfaces and one-pixel rules. Avoid floating glass, gradients, and decorative shadows.
- Tables and workout rows use consistent vertical rules and generous line height rather than nested cards.
- Buttons use black or signal red with visible focus rings.
- Status must include readable text, not color alone.
- Long labels wrap naturally. Do not clip essential content.

## Responsive checks

Verify 375px, 768px, 1024px, and 1440px widths. The phone view keeps the Today flow and day selector close to the thumb. The trainer import view can use the full desktop grid but remains readable on tablet.
