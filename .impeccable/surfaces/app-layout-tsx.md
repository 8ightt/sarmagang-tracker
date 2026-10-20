---
version: 1
slug: "app-layout-tsx"
primary_target: "app/layout.tsx"
related_targets: ["app/globals.css","components/Nav.tsx","components/LiveBadge.tsx"]
---

# Site shell and design foundation

Scope: the site-wide foundation for the redesign. Fonts, colour tokens, the runtime club accent, base controls (buttons, pills, tabs, inputs, tables, result badges), the header and navigation, the footer, and the browser surfaces. Existing pages pick it up through their current class names; each page gets its own restyle later. Mode: Operate (teammates mostly on phones; captains on desktop for setup).

Audience and job: Clubs players checking results, ratings and records during and after sessions, and opening shared links cold from a group chat.

Pinned by the user on 2026-10-20: the EA FC Clubs page style (ea.com/games/ea-sports-fc/clubs), with different fonts in the same style. The approved reference is `.impeccable/mocks/decision/pinned-clubs-style-desktop.html`. Hero background patterns are deferred to a later pass and must be our own, never EA's triangles.

Unresolved: whether stat pages alternate light sections (decided per page in the restyle); the settings storage and the onboarding search path (see PRODUCT.md).

## Direction contract

THESIS: The club wears the site. The EA Clubs matchday look (heavy expanded uppercase display, clean grotesk, pill controls, dark and light sections) is carried by the club's own kit colour, not EA's green. Refuses both the generic dark stats-app card grid and an EA look-alike.

OWN-WORLD: Near-black ground (#121313) with a darker bar (#0b0c0c), raised surfaces in one step lighter, off-white light sections (#f4f4f1). Accent = the most saturated of the crest colour EA sends (crestColor, usually the club's strongest colour) and the home-kit colours that clears 4.5:1 on the ground, else the most saturated one raised in HSL lightness until it does; --club = the home-kit body colour, used for table header bands and .card-club fills; --win = the accent, or off-white when the accent is red so a win never reads as a loss. Anybody (width 125, weight 900, uppercase, line-height .95) for display; Hanken Grotesk for everything else; Gloock only for a single emphasised word. Pill buttons; selected toggles outlined in the accent, solid fill only for actions; tabs with a 3px accent underline; tables as separate rounded rows under a header band in --club; tabular numerals.

STORY: A teammate opens a link and knows within a second whose site it is (crest, name and colours), what is live, and where the club, players, seasons, records and analysis sit.

FIRST VIEWPORT: Sticky dark bar: crest and club name in display type on the left, the five sections as underline tabs in the centre and right, the live state as a pill. The page's own content starts below at full width; nothing decorative between the bar and the data.

FORM: The user's pinned reference (EA FC Clubs page language), not a rolled candidate; seed:8e0c9f0429d316d0 (re-roll round declined in favour of the pinned direction). Signature move: the club's colours repaint the whole site from one runtime-computed accent.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
