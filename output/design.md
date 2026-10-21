# Campus Customs Design

How the Campus Customs site looks and feels, and why. The code lives in `frontend/src` (styles in `index.css`, components in `components/`, pages in `pages/`, the 3D store in `store/`).

## Goals

1. **Feel like Yale, not a template.** Yale Blue, white, serif headlines, Gothic campus imagery, and Handsome Dan as the face of the shop.
2. **Make shopping fast for people who don't want to chat**: real filters, clear prices, and stock by size on every product page.
3. **Make Handsome Dan easy to find and easy to trust.** He's always one tap away, suggests what to ask, and shows real product cards next to his answers.
4. **Give a reason to visit**: a walkable virtual version of the shop on Broadway.

## Visual system

### Color

Defined once as CSS variables on `:root` in `index.css`:

| Token | Value | Used for |
|---|---|---|
| `--yale` | `#00356b` (Yale Blue) | Primary buttons, active nav pill, headings, prices |
| `--yale-dark` | `#002247` | Gradients, footer, deep accents |
| `--yale-light` | `#286dc0` | Links, eyebrow labels, hover states |
| `--yale-sky` | `#63aaff` | Accents on dark backgrounds ("Customs" in the hero, italic highlights) |
| `--bg` / `--surface` / `--surface-2` | `#f5f7fb` / `#ffffff` / `#eef3fa` | Page background, cards, quiet panels |
| `--text` / `--muted` | `#0f1d33` / `#56637a` | Body text, secondary text |
| `--ok` / `--warn` / `--danger` | green / amber / red | "In stock", "Only 3 left", "Sold out" and errors |
| Paper | `#f7f1e6` / `#fbf7ef` | The watercolor header and welcome splash |

This replaces the course's default black-and-pink palette (Agents.md) with the school's colors, at the shopper's request.

### Type

- **Playfair Display** (700/800, with italics) for headlines, the "Campus Customs" wordmark, and the virtual store's signs: collegiate and a bit formal.
- **Inter** (400–700) for everything else: readable at small sizes and on phones.
- Both come from Google Fonts with `display=swap`, so text shows immediately in a fallback font.

### Imagery

- **Handsome Dan** art was generated with Google Gemini for this project: Dan in a Y varsity jacket in front of an ivy-covered Gothic tower (logo, hero cameo, splash), and Dan in a headset (chat button and chat header).
- **Watercolor campus.** `WatercolorCampus.tsx` paints Harkness Tower, Gothic halls, the Sterling nave, and elms as inline SVG. Turbulence filters make the edges bleed like pigment on wet paper, and a noise layer adds paper grain. The full scene sits behind the welcome splash, and a strip through the rooftops is the background of the site header, under a light paper wash so the links stay readable.
- **Product photos** come from the catalogue's image paths. They're shown on white so the many black-background photos still look consistent.

### Shape and depth

Rounded cards (14 px radius), pill-shaped buttons and chips, thin borders, and soft blue-tinted shadows. A varsity-sleeve stripe (white and Yale Blue) runs along the bottom of the hero.

## Pages and key components

| Page / component | Design decisions |
|---|---|
| **Welcome splash** (`WelcomeSplash.tsx`) | Appears every time someone opens the site on the home page (not on shared product links). Two large choices on the watercolor campus: **Virtual Storefront** (navy card, "New" badge, focused by default) or **Classic View** (white card). Esc picks Classic. The content fades in; the painting covers the page right away. |
| **Header** (`NavBar.tsx`) | Watercolor rooftops behind Yale Blue text; the current page is a navy pill; a cart button with a red count badge; a hamburger menu under 860 px. |
| **Home** | Yale Blue hero ("Wear your *Yale* story.") with the Handsome Dan cameo, category tiles, featured products, and a college-pride band. Copy was written in the shop's own voice, not copied from yalebulldogblue.com. |
| **Products** | Category chips with counts, then a sidebar of real filters: garment color swatches, size in stock, price range with presets, "In stock only", and sort. Filters live in the URL so a view can be shared. A shopper's usual size is highlighted. When Dan sends results, a "Handsome Dan found: Hoodies" title and a "From your chat" bar appear above the grid. |
| **Product card** (`ProductCard.tsx`) | Image, category eyebrow, name, one-sentence description, price; the same card is used in the grid, in Dan's results, and (compact) in the chat. |
| **Product page** | Large image on the left, details on the right: price, description, colors, and a size grid that's both the stock display (green, amber "Only 5 left", struck-through "Sold out") and the size picker. Quantity stepper and **Add to cart · $68.00**. |
| **Cart and Checkout** | Line items with steppers capped at stock, and a sticky order summary. The checkout form has delivery and payment sections. The tax estimate updates as soon as a state is picked. A clearly labeled "Demo checkout" box offers test-card buttons. The confirmation page has a green check and a receipt. |
| **Chat widget** (`ChatWidget.tsx`) | A round headset-Dan button with a dismissible **"Paws for a chat?"** bubble, plus a storefront button for the virtual store. The panel has Dan's portrait, starter bubbles ("Hoodies under $70", "What's in my size?", "Gift for a parent"), and replies that stream in with live status ("Checking stock by size…"). Product cards appear under replies. Guest vs. saved chat is shown in the header. |

## Virtual store (`/store`)

A first-person walk through a cozy rebuild of the real shop at 59 Broadway, drawn entirely in code (three.js primitives and canvas-painted textures, no photos or 3D models):

- **Outside:** the three-story brick building with its black "Campus Customs" fascia, glass display windows, a blade sign, and an A-frame. The neighbors on the block are a limestone-and-glass shop, a Gothic Yale hall, the D.W. Flint building with its cleaners, and a café. Lampposts and street trees line the sidewalk. Looking around is limited so the view stays on the storefront.
- **Inside:** dark-blue walls covered in nine Yale campus murals (Harkness, Sterling, Beinecke, Phelps Gate, the Bowl, Woolsey, Payne Whitney, the Green, Cross Campus), deep walnut floors and beams, warm pendant lamps, and a striped rug. Fixtures: a folded-tee wall with college designs, a cap pegboard, hoodie and crewneck racks, a jacket rack, the Boola Boola nook, display tables of real catalogue items, and leather couches.
- **Handsome Dan** stands life-size behind the counter in his varsity jacket and headset. He breathes and turns his head to follow you, and walking up to him opens the chat.
- **Interaction:** a center dot shows what you're facing, and a pill prompt ("E Talk to Handsome Dan") appears. Displays open the matching product pages, and "Back to the virtual store" returns you to the exact spot. On phones: a thumbstick, drag to look, tap buttons, and a wider field of view in portrait.

## Responsive and accessible

- Every page works at phone width (375 px) with no sideways scrolling; grids collapse to one column, and the nav becomes a menu.
- Visible focus rings, real `<button>`s and links, `aria-label`s on icon buttons, `aria-live` for chat replies and cart totals, `aria-pressed` on the size picker, and form fields with labels and autocomplete hints.
- `prefers-reduced-motion` turns off the splash and card animations.
- Text over the watercolor sits on a paper wash or solid cards so contrast stays high.

## Voice in the interface

Short, warm, and a little playful, like Dan himself: "Paws for a chat?", "Thanks! Boola Boola!", "Find something Bulldog blue, then come back here to check out." There's at most one pun per screen, and none in errors, which say plainly what happened and what to do next.
