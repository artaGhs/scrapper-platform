---
name: Scrapper platform
description: Night above the horizon, matches surfacing into daylight below
colors:
  night: "#030a24"
  night-deep: "#061445"
  horizon-blue: "#0a2380"
  glow-cobalt: "#1f4bff"
  signal: "#2457f5"
  signal-press: "#1a46db"
  ice: "#dce8ff"
  frost: "#eef3ff"
  page: "#f5f8ff"
  paper: "#ffffff"
  ink: "#0b1640"
  muted: "#4a5a85"
  line: "#dbe4f7"
  on-night: "#ffffff"
  on-night-muted: "#b8c6f2"
  strip: "#6e86c6"
  fictional: "#8aa2dd"
  error: "#c42b3c"
typography:
  display:
    fontFamily: "Host Grotesk, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 6.2vw, 5.6rem)"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Host Grotesk, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 3vw, 2.5rem)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Host Grotesk, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Host Grotesk, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  ui:
    fontFamily: "Host Grotesk, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "Host Grotesk, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.3
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  chip: "999px"
  control: "12px"
  card: "20px"
  composer: "24px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "32px"
  xl: "64px"
  section: "120px"
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.paper}"
    rounded: "{rounded.chip}"
    padding: "0 22px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.signal-press}"
  button-light:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "0 16px"
    height: "36px"
  chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "0 12px"
    height: "30px"
  result-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "28px"
---

# Design System: Scrapper platform

## Overview

**Creative North Star: "The Horizon"**

The page is a sky at the moment before dawn. Above the horizon is night: the conversations you have not found yet, a dark dome edged with a cobalt glow, faint stars and grain. Below it is daylight: pale ice and white, where real matches surface and are read. Running a search is the crossing: the composer leaves the night and docks over the daylight workspace.

Persuasion lives above the horizon and work lives below it. The landing hero is dramatic and centered; the results workspace is calm, legible and white. Both share one cobalt voice, one grotesk with a real italic, and one line motif (the horizon rail) that appears in "How it works" and in search progress.

**Key Characteristics:**
- A dark elliptical dome with a glowing cobalt rim, fading to ice and white below.
- A frosted composer with chip toolbar is the primary object on the first viewport.
- Real community names (r/loseit, r/shopify…) appear as drifting cursor tags and as a faded strip; never invented users or logos.
- White result cards with soft blue-tinted shadows; the original quote sits on frost.

## Colors

One saturated blue family carries the whole world; everything else is ink, ice and white.

### Primary
- **Glow Cobalt** (#1f4bff): the horizon rim, the active progress node, beta badge text. Light, never fill for long text.
- **Signal Blue** (#2457f5): the one action color — Run research, Open original, focus rings, result numerals. White text on it passes 5.6:1.

### Neutral
- **Night** (#030a24) / **Night Deep** (#061445) / **Horizon Blue** (#0a2380): the dome, the docked bar, the footer band.
- **Ice** (#dce8ff) / **Frost** (#eef3ff): the daylight below the rim, quote grounds, chip fills.
- **Page** (#f5f8ff): the workspace and landing-section background below the horizon.
- **Paper** (#ffffff): result cards, the example card, details panels.
- **Fictional** (#8aa2dd): dashed outlines on fictional examples and the sample disclosure.
- **Ink** (#0b1640): text on light. **Muted** (#4a5a85): secondary text on light (≥5.5:1 on ice).
- **On-night Muted** (#b8c6f2): secondary text on the dome.
- **Strip** (#6e86c6): the faded community strip on desktop only (≥3:1 at its ≥20px/600 size); on phones the strip uses Muted.
- **Error** (#c42b3c): errors only.

### Named Rules
**The One Blue Rule.** There is no second hue. Fictional examples are distinguished by dashed outlines and labels, not by a new color.

**The Night Is Above Rule.** Dark surfaces are reserved for the hero dome, the docked composer bar and the footer band. Reading happens on light.

## Typography

**Display / Body Font:** Host Grotesk (variable, with true italic), loaded through `next/font/google`; system-ui fallback.

**Character:** A precise, slightly warm grotesk. The second headline line switches to the true italic — the one expressive gesture in the type system.

### Hierarchy
- **Display** (500, clamp(2.6rem, 6.2vw, 5.6rem), 1.02, −0.035em): the hero headline only; second line italic.
- **Headline** (500, clamp(1.75rem, 3vw, 2.5rem), 1.1): section and results headings.
- **Title** (500, 20px, 1.3): result titles, step titles.
- **Body** (400, 16px, 1.6): supporting text; original quotes at 15.5px; measure ≤ 68ch.
- **UI** (500, 14–15px): buttons, nav links, mode switch, secondary copy beside controls.
- **Label** (500, 12–13.5px): chips, metadata, tags, notes. Sentence case; no tracked uppercase except the single "Beta" badge.
- **Code** (400, 12.5px, system monospace): only for the Boolean search phrases shown under "Search phrases" — real query syntax, never decoration.

## Layout

Centered composition. The hero is at least one viewport tall (capped at 980px) with content on a single centered column: beta pill, two-line headline, subcopy, then a 720px composer straddling the rim. Landing sections use a 1120px container with 40px side margins (20px on mobile). The results workspace narrows to an 840px reading column. Sections are separated by 120px (72px mobile). After Run, the hero collapses into a docked night bar: sticky (its header row scrolls away) when the viewport is at least 900px wide and 720px tall; otherwise it scrolls away with the page.

## Elevation & Depth

Depth is atmospheric above the horizon (glow, blur, grain) and physical below it (soft, offset, blue-tinted shadows).

### Shadow Vocabulary
- **Composer** (`0 30px 60px -24px rgba(6, 24, 110, 0.45), 0 2px 6px rgba(6, 24, 110, 0.12)`): the frosted composer on the rim.
- **Card** (`0 1px 2px rgba(11, 22, 64, 0.06), 0 18px 40px -24px rgba(20, 50, 170, 0.32)`): result cards and the example card.

### Named Rules
**The Real Blur Rule.** Backdrop blur is used only where something actually sits over the glow (composer, docked bar, locked preview); never as decoration on flat white.

## Shapes

Fully rounded pills for chips and buttons (999px), 12px for inputs, 20px for cards, 24px for the composer. The horizon rail is a 1px line with 12px round nodes.

## Components

### Buttons
- **Primary:** Signal Blue pill, 44px tall, white 15px/500 label with arrow; hover deepens to #1a46db; focus ring 3px Signal Blue at 3px offset (white ring on night).
- **Light:** white pill on night (header "Try a sample").
- **Ghost:** transparent with ink text and a 1px line border (Save, Not relevant, Start over).

### Chips
- **Style:** 30px white-on-frost pills with 1px rgba(11,22,64,.08) border, 13px/500 ink.
- **Segmented mode switch:** two radio chips inside a frost track; the checked one is white with the card shadow.

### Composer (signature)
Frosted panel (rgba(236,242,255,.86), 22px backdrop blur with 1.5 saturate, 1px white border, 24px radius, Composer shadow); docked it rises to rgba(238,243,255,.97) so text keeps contrast over night. Visible small label, borderless textarea, example chips with counter, hairline, then toolbar: Reddit source chip, mode switch, and Run research on the right.

### Result Card
White, 20px radius, Card shadow, 1px line border. Signal numeral, metadata row, title, quote on Frost, fit label pill + reason, hairline, actions (Open original primary; Save / Not relevant ghost). Fictional cards use a dashed Fictional (#8aa2dd) border. Not-relevant cards collapse to metadata, title and actions on Frost, with muted title and metadata; actions keep full contrast.

### Horizon Rail
1px line with three round nodes: done = filled Signal with check, active = Signal ring with a soft pulse (the only looping motion in the workspace), pending = hollow line.

## Do's and Don'ts

### Do:
- **Do** keep the composer and Run action inside the first viewport on 375×812.
- **Do** label every fictional example and keep the sample disclosure next to the action.
- **Do** suppress drift, twinkle, pulse and the dock transition under `prefers-reduced-motion`.

### Don't:
- **Don't** add invented users, testimonials, logos or metrics; cursor tags are real community names.
- **Don't** add a second accent hue or gradient text.
- **Don't** use colored side borders thicker than 1px on cards, quotes or alerts.
- **Don't** put long reading text on the night surfaces.
