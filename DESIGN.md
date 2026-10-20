---
name: FC Clubs Tracker
description: A club's own stats site for EA SPORTS FC Clubs, painted in that club's kit colours.
colors:
  accent: "#e8e8e3"
  on-accent: "#0b0c0c"
  accent-light: "#2a2c2c"
  club: "#2a2c2c"
  on-club: "#ffffff"
  win: "#e8e8e3"
  on-win: "#0b0c0c"
  ground: "#121313"
  bar: "#0b0c0c"
  stripe: "#171919"
  surface: "#1b1d1d"
  surface-2: "#252828"
  line: "#2a2d2d"
  line-2: "#3b3f3f"
  text: "#f4f4f1"
  text-2: "#cbcfcd"
  muted: "#9ea3a1"
  shame: "#eba4ac"
  shame-line: "#3d2428"
  loss: "#5c1a22"
  loss-text: "#f7dde0"
  paper: "#f4f4f1"
  ink: "#121313"
  ink-2: "#545858"
typography:
  display-hero:
    fontFamily: "Anybody, system-ui, sans-serif"
    fontSize: "clamp(56px, 6.6vw, 96px)"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "0"
    fontVariation: "'wdth' 125"
  display:
    fontFamily: "Anybody, system-ui, sans-serif"
    fontSize: "clamp(34px, 7vw, 88px)"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "0"
    fontVariation: "'wdth' 125"
  headline:
    fontFamily: "Anybody, system-ui, sans-serif"
    fontSize: "clamp(26px, 3.2vw, 36px)"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "0"
    fontVariation: "'wdth' 125"
  number-display:
    fontFamily: "Anybody, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 900
    lineHeight: 1
    fontFeature: "'tnum'"
    fontVariation: "'wdth' 125"
  nickname:
    fontFamily: "Anybody, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 900
    lineHeight: 0.95
    fontVariation: "'wdth' 125"
  number:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.1
    fontFeature: "'tnum'"
  title:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
  caption:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  accent-word:
    fontFamily: "Gloock, Georgia, serif"
    fontWeight: 400
rounded:
  flag: "2px"
  bar: "5px"
  row: "10px"
  card: "14px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  card: "20px"
  gutter: "24px"
  section: "56px"
  band-top: "64px"
  band-bottom: "72px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 22px"
    height: "46px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "8px 22px"
    height: "46px"
  button-danger:
    backgroundColor: "{colors.loss}"
    textColor: "{colors.loss-text}"
    rounded: "{rounded.pill}"
    padding: "8px 22px"
    height: "46px"
  toggle-pill:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    rounded: "{rounded.pill}"
    padding: "6px 16px"
    height: "38px"
  toggle-pill-selected:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    rounded: "{rounded.pill}"
    padding: "6px 16px"
    height: "38px"
  input:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "8px 18px"
    height: "46px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "20px"
  card-strong:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "20px"
  table-header:
    backgroundColor: "{colors.club}"
    textColor: "{colors.on-club}"
    rounded: "{rounded.row}"
    padding: "12px"
  table-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.row}"
    padding: "12px"
  badge-win:
    backgroundColor: "{colors.win}"
    textColor: "{colors.on-win}"
    rounded: "{rounded.pill}"
    size: "36px"
  badge-draw:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    size: "36px"
  badge-loss:
    backgroundColor: "{colors.loss}"
    textColor: "{colors.loss-text}"
    rounded: "{rounded.pill}"
    size: "36px"
  chip:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  chip-ghost:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  nav-tab:
    backgroundColor: "{colors.bar}"
    textColor: "{colors.text-2}"
    padding: "0 14px"
    height: "68px"
  nav-tab-active:
    backgroundColor: "{colors.bar}"
    textColor: "{colors.text}"
    padding: "0 14px"
    height: "68px"
---

# Design System: FC Clubs Tracker

## Overview

**Creative North Star: "The Club Wears the Site"**

The site borrows the matchday language of EA's Clubs pages (heavy, wide uppercase headings, a clean grotesk, pill controls, full-width dark and light bands) and dresses it in the club's own kit. Two clubs running the same code should look like two different clubs, not two skins of one product. The colour tokens that carry identity are computed at runtime from what EA sends for that club, so the stylesheet holds only neutral fallbacks.

It is dense where the data is dense (tables, ladders, rows of numbers) and loud only where it counts: the club's name, the big season totals and the section headings. Everything else is plain, factual and set in the body face. The world rejects two things: the generic dark stats-app card grid, and an EA look-alike. The club's colour replaces EA's green everywhere, and the site never wears EA's own patterns or marks.

The world is built desktop first, then adapted for phones: every page fits a 390px screen without scrolling sideways.

**Key Characteristics:**
- Club colours applied at runtime: one computed accent and one shirt colour repaint the whole site.
- Near-black ground, a darker sticky bar, raised surfaces one step lighter, and off-white light bands.
- Wide 900-weight uppercase display face for headings and big numbers only. Everything else is Hanken Grotesk.
- Pills for everything you can press or pick. Solid fill means action; an accent outline means selected.
- Tables as separate rounded rows under a header band in the club's shirt colour, with tabular numbers throughout.
- Full-width bands, each holding its own 1240px column.

## Colors

The palette is a fixed neutral frame plus a few identity slots that the club fills at runtime.

The frontmatter values are the `:root` fallbacks in `app/globals.css`, used only when a club sends no kit colours. On a live deploy, `lib/club-theme.ts` computes `accent`, `on-accent`, `accent-light`, `club`, `on-club`, `win` and `on-win` from EA's crest colour and home-kit colours and sets them on `<html>`. Example, Sarma gang today: accent #189745, club #002e0a, accent-light #147d39, on the standard ground #121313.

### Primary
- **Club Accent** (runtime; fallback in frontmatter): of the crest colour and the home-kit colours, the most colourful one that reaches 4.5:1 on the ground. Colourfulness is measured as the spread between the strongest and weakest RGB channel, and near-greys are excluded. If no candidate qualifies, the most colourful one is lightened in HSL until it reads. Used for links, the active tab underline, selected-toggle outlines, focus rings, the live dot, bar fills, ladder progress, the selected text highlight, the caret, and big award numbers.
- **On Accent** (runtime): black-ink or white, whichever reads better on the accent. Text on accent fills (buttons, chips, the flashing live badge).
- **Accent Light** (runtime): the accent darkened until it reaches 4.5:1 on paper. Inside a light band it replaces the accent automatically.

### Secondary
- **Club Shirt** (runtime): the home kit's body colour. Fills the club hero band, table header bands, and initials avatars. It is a fill colour, never a text colour on the ground.
- **On Club** (runtime): black-ink or white on the shirt colour. Inside the hero band, the secondary text, muted text, lines and surfaces are mixed from on-club into club (80%, 68%, 16% and 7%), so the band stays within the club's own colours.

### Tertiary
- **Win Fill** (runtime): the accent, except when the accent is red (HSL hue under 25° or over 335°, saturation over 25%). Then it is the off-white `paper` value, so a win never looks like a loss.
- **Loss Maroon** (#5c1a22 with Loss Text #f7dde0): loss badges and the danger button.
- **Shame Rose** (#eba4ac on Shame Line #3d2428): the hall of shame, relegation warnings, CPU warnings, form errors and the relegation ladder tag.

### Neutral
- **Pitch Night** (ground #121313): the page ground, and the colour every accent is tested against. `lib/club-theme.ts` repeats this value as `GROUND`, and the two must stay in step.
- **Tunnel Black** (bar #0b0c0c): the sticky header and the footer. Also dark ink on light fills.
- **Raised Slate** (surface #1b1d1d, surface-2 #252828): cards, table rows, row hover, tracks and the stronger card.
- **Touchline** (line #2a2d2d, line-2 #3b3f3f): card borders, dividers, and resting toggle and input strokes.
- **Chalk** (text #f4f4f1, text-2 #cbcfcd, muted #9ea3a1): primary, secondary and tertiary text on dark.
- **Programme Paper** (paper #f4f4f1, ink #121313, ink-2 #545858): light bands. `.section-light` redefines text, lines, surfaces and the accent locally, so components inside it need no light variants.

### Named Rules
**The Club Colour Rule.** The accent is always the club's own colour, computed by `lib/club-theme.ts`. Never use EA's green (#07F468) or any other fixed brand colour in its place. Never hardcode one club's colours. Sarma gang's green is an example output, not a token.

**The Legible Accent Rule.** The accent always reaches 4.5:1 on the surface it sits on: on the ground through `accent`, on paper through `accent-light`. Any new surface colour needs its own version computed the same way.

**The Not Colour Alone Rule.** A result is never shown by colour alone. Badges carry the letter W, D or L and an aria-label. The fill only repeats the letter. Draw is an outline ring, not a third hue.

## Typography

**Display Font:** Anybody (variable, width axis set to 125%, weight 900, uppercase), with system-ui as the fallback.
**Body Font:** Hanken Grotesk, with system-ui as the fallback.
**Accent Font:** Gloock 400, with Georgia as the fallback. It is reserved for a single emphasised word and not preloaded. No surface uses it yet.

**Character:** a stadium-board display face with no letter-spacing or tracking tricks, next to a calm grotesk that does all the reading work. The contrast between the two is the hierarchy.

### Hierarchy
- **Display hero** (900, clamp(56px, 6.6vw, 96px), 0.95): the club name in the club hero band.
- **Display** (900, clamp(34px, 7vw, 88px), 0.95): page h1 headings.
- **Headline** (900, clamp(26px, 3.2vw, 36px), 0.95): section h2 headings, with balanced wrapping.
- **Number display** (900, 44px, 1, tabular): headline numbers such as season totals, award values and promotion counts (40 to 44px). Values in fixed-width cards shrink with their container through `--chars`. The hero totals use clamp(30px, 3vw, 44px).
- **Nickname** (900, 22px, accent colour): a player's nickname on their card, inside curly quotes.
- **Number** (Hanken 800, 22px, 1.1, tabular): card stats, scores and record values (22 to 28px).
- **Title** (Hanken 700, 19px, 1.2): gamertags on cards and award holders.
- **Body** (Hanken 400, 16px, 1.5): running text. Bios are 14px at 1.55 in text-2.
- **Label** (Hanken 500 to 700, 14px): KPI labels, filter labels, table headers (700) and award labels (600).
- **Caption** (Hanken 400 to 700, 12 to 13px): meta lines, dates, ladder names, OVR captions and stat terms in muted text.

### Named Rules
**The Wide Face Threshold Rule.** The display face is only for headings and big headline numbers, about 32px and up. Smaller numbers use Hanken Grotesk at 800 with tabular numerals. There are two exceptions: player nicknames (display lettering at 22px in the accent colour) and the club name in the header and the product name in the footer, which work as a wordmark (confirmed by the user, 20 Oct 2026).

**The Tabular Rule.** Every number that sits in a column, a row or next to another number uses tabular numerals.

## Layout

The page is a stack of full-width bands, as on EA's Clubs pages. Each band holds its own centred column, 1240px wide with 24px gutters. Bands are padded 64px at the top and 72px at the bottom. Sections inside a band are 56px apart. The club page runs the bands in this order: club-colour hero, dark, light, dark. Pages not yet restyled use a single padded column with the same 56px gap.

The rhythm is 8, 12, 16 and 24px: 12px between grid items, 16px between rows and stacks, 18 to 22px for card padding and inner gaps. Grids are auto-fit at 170, 240 or 270px minimums. The club page uses fixed three-column and two-column grids for player cards and awards. The club hero is a three-column grid (crest, name block, standing) with the season totals spread along a ruled bottom line.

The header is a sticky 68px bar. The crest and club name sit on the left; the section tabs fill the full height of the bar on the right; the live state is a pill. Nothing decorative sits between the bar and the data.

Desktop is the primary layout; 1000px and 760px are the breakpoints. Below 1000px three-up grids go two-up. Below 760px (phones):
- bands tighten (40px vertical padding) and two- and three-up grids go to one column, except stat tiles (`grid-170`), which stay two-up;
- totals strips become a two-column grid, and a long value (`.is-long`, such as a W-D-L record) takes the full row;
- the section nav and the Players metric toggles become one sideways-scrolling row;
- ranking rows put the bar under the name, the scoreboard shrinks (56px crests, 48px score, kits hidden), date fields keep their From/To labels and go full width;
- long unbroken words in headings may break (`overflow-wrap: anywhere`).

## Elevation & Depth

The system is flat. Depth comes from tonal steps (bar, then ground, then surface, then surface-2) and from switching between dark and light bands, not from shadows. A hover lifts a row one tonal step, or brightens a card border from line to line-2.

### Shadow Vocabulary
- **Crest lift** (`filter: drop-shadow(0 12px 24px rgb(0 0 0 / .35))`): the 180px hero crest only, so it stands off the shirt-colour band.
- **Live pulse** (`box-shadow: 0 0 0 8px` fading ring in the accent at 60%, 2s loop): the live dot. Turned off for reduced motion.
- **Inset strokes** (`box-shadow: inset 0 -3px 0` for tab underlines, `inset 0 0 0 2px var(--line-2)` for the draw badge): these draw lines. They are not used for elevation.

### Named Rules
**The Tonal Step Rule.** To raise something, move it up one surface step. Don't add a shadow. The crest is the only drop shadow.

## Shapes

Corners are soft and consistent: cards and match rows 14px, table row ends 10px, bars 5px, flags 2px. Everything you press, pick or read as a status is a full pill (999px): buttons, toggles, inputs, chips, ladder tags, the live badge, and the round result badges. Avatars are circles. Strokes are 1px for card borders and dividers, 1.5px for interactive outlines and series slots, and 3px for the active tab underline. A dashed accent outline marks the next game slot in a series.

Club-colour bands carry the club's own material, computed at runtime: fine vertical shirt pinstripes (1px in on-club at 5%, every 28px, fading in from the left) and the club's crest as a large greyscale watermark at 8% on the right, tilted -8° (300px on phones). Both are hidden under `prefers-contrast: more`. Never EA's triangle pattern or any EA mark.

## Components

### Buttons
Confident and filled, because a button does something.
- **Shape:** full pill (999px), 46px minimum height, 1.5px border.
- **Primary:** accent fill, on-accent text, 700 weight, 8px 22px padding.
- **Hover / Focus:** brightness 1.08 on hover. On focus, a 2px accent outline offset by 2px (the site-wide focus ring). Disabled is 55% opacity with a wait cursor.
- **Ghost:** transparent, text colour, text-2 border that turns text-coloured on hover.
- **Danger:** loss maroon fill, loss-text, darker maroon border.

### Toggles and filter pills
- **Style:** transparent pill (38px for filters; button height for `.tabs`), a 1.5px line-2 stroke, text-2 at 700 and 14px. Count bubbles sit in surface-2.
- **State:** selected is an accent outline with accent text, and its count bubble turns to an 18% accent tint. It is never filled. Hover raises the stroke to text-2. Empty options drop to 45% opacity.

### Chips and tags
- **Chip:** a small 12px/800 pill in the accent. The ghost variant is surface-2 with text-2. The shame variant is shame-line with shame text.
- **Ladder tag:** a 14px/800 pill. Promotions use a 14% accent tint; relegations use the shame pair.
- **Active filter:** a surface-2 pill with a muted remove mark.

### Cards / Containers
- **Corner Style:** 14px.
- **Background:** surface with a 1px line border. The strong card is surface-2 with no border. The shame card has a shame-line border. A warning or promotion state may swap the border to accent or shame.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Internal Padding:** 20px, or 22px on player cards. Cards are inline-size containers, so big numbers can scale to them.

### Inputs / Fields
- **Style:** 46px pill, 1.5px line-2 stroke, ground fill, 8px 18px padding, muted placeholder.
- **Focus:** the stroke turns to the accent. There is no outline ring. A compound search field takes the accent stroke through `:focus-within`.
- **Messages:** success in the accent, errors in shame rose.

### Navigation
- **Style:** the tabs fill the full height of the 68px tunnel-black bar. Labels are Hanken 600 in text-2, 14px horizontal padding.
- **States:** hover shows a 3px line-2 underline. The current page gets text colour and a 3px accent underline, drawn as an inset shadow and eased over .2s with cubic-bezier(.16, 1, .3, 1). The season tabs use the same 3px underline as a border.
- **Footer:** the same bar colour. The product name in display type, then the data source line, which must include "not affiliated with EA".

### Tables
- **Header:** a band in the club shirt colour with on-club text, 700 weight, 14px.
- **Rows:** separate rows 6px apart, surface fill, 12px cell padding (18px at the ends), 10px rounded ends, right-aligned tabular numbers with the first column left-aligned. Hover moves the row to surface-2.

### Result badges
A 36px circle with the result letter at 800 weight. Win uses the win fill and on-win. Draw is a transparent circle with a 2px line-2 ring. Loss uses maroon with loss-text. The letter is always present.

### Ladders (signature)
Division and reputation progress shown as a row of EA's badges joined by a 4px track. The track's line-2 base is overlaid with an accent fill up to the current step. Steps behind are 70% opacity; steps ahead are greyscale at 30%. The current step is full colour, scaled 1.2, and has its name in the accent. Division badges map from EA's files: `divisioncrestN` shows Division N−1, and `divisioncrest1` is Elite.

### Player card (signature)
A linked card. The top row holds a 56px avatar (a photo, or initials on the club shirt colour), the gamertag at 19px/700, a muted meta line (flag, pro name, position), and the OVR in display numerals at 34px. Below that, an optional nickname in the accent display lettering. Then a ruled four-column stat strip (Games, Goals, Assists, MOTM) in 22px/800 body numerals. Last, an optional bio at 14px in text-2.

### Page bands
Every page is a run of full-width bands, each with its own `.wrap`. It opens on a header band in the club shirt colour (`band-club`) holding the page title and the page's own summary (season totals, the selection's totals, a scoreboard). Content then alternates between the dark ground and light paper bands (`section-light`). The hall of shame gets a dark maroon band (`band-shame`) of its own. On the club band the accent can sit too close to the ground, so selected toggles and tabs there go white (on-club) instead of accent. On light bands the accent darkens (`--accent-light`), fields turn white, and shame and CPU warnings turn a dark red (#a3263b).

### Card titles
A card's own title (`.card-title`) is Hanken at 20px/800, not the display face. Page and section headings stay in display type.

### Sessions (Seasons page)
Matches are grouped into play sessions: games less than 3 hours apart belong to one night. Each session has a header with its day and record under a 2px ink rule, and its rows show kick-off times only.

### Our row among other clubs
In tables of other clubs (World top 100), the club's own row (`tr.is-us`) is filled with the club shirt colour.

### Loss mark
`--loss-mark` (#c4485a) marks a loss as a dot or a series-slot border, on either ground. The lineup picker's "Out" state uses it as an outline.

## Do's and Don'ts

### Do:
- **Do** take every identity colour from the runtime tokens (`--accent`, `--on-accent`, `--accent-light`, `--club`, `--on-club`, `--win`, `--on-win`). The `:root` values are fallbacks only.
- **Do** keep `GROUND` and `PAPER` in `lib/club-theme.ts` in step with `--bg` and `--paper` in `app/globals.css`.
- **Do** outline a selected toggle in the accent, and keep solid accent fill for buttons and other actions.
- **Do** put the result letter (W, D or L) and an aria-label on every result mark. Colour only repeats it.
- **Do** use the display face only for headings and numbers of about 32px and up. Use Hanken Grotesk 800 with tabular numerals below that. Nicknames at 22px in the accent are the one exception.
- **Do** map EA division badges as `divisioncrestN` for Division N−1, with `divisioncrest1` for Elite.
- **Do** state "not affiliated with EA" on every page, in the footer.
- **Do** design desktop first, then check every page at 390px: nothing may scroll sideways.

### Don't:
- **Don't** use EA's green (#07F468), EA's logos, or EA's triangle background pattern. Background patterns are the club's own (pinstripes, crest watermark).
- **Don't** fill a selected filter or toggle with the accent. A fill reads as an action.
- **Don't** show a win, draw or loss by colour alone, and don't give a red club a red win fill (the win token switches to paper).
- **Don't** set small labels, table numbers or card stats in the display face.
- **Don't** add drop shadows to cards or rows. Raise them one tonal step instead.
- **Don't** hardcode one club's colours, name or crest in a component.
