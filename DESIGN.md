---
name: Scrapper platform
description: An open conversation desk with a visible search path
colors:
  ink: "#203b32"
  muted: "#52675c"
  canvas: "#f3f5ef"
  paper: "#ffffff"
  accent: "#315d49"
  accent-soft: "#e0ebd9"
  line: "#d2dace"
  error: "#9a3228"
typography:
  display:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "clamp(2.75rem, 5.3vw, 4.75rem)"
    fontWeight: 500
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
    fontSize: "16px"
    lineHeight: 1.6
rounded:
  control: "8px"
  panel: "16px"
  compact: "6px"
  pill: "100px"
  dot: "50%"
spacing:
  small: "8px"
  medium: "16px"
  large: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "14px 22px"
---

# Design System: Scrapper platform

## Overview

The conversation desk: an open, daylight workspace for a founder reviewing human requests. Restrained green ink on cool pale paper keeps original words more prominent than decoration. No illustrations are required: editable descriptions, original excerpts and an honest stage rail are the visual material.

## Colors

Green ink owns headings and actions; pale green holds sample and selected states. White is the writing area and the original excerpt ground. Muted green carries secondary information; red appears only for errors.

## Typography

Arial/Helvetica is a dependable operating face available without network font requests. Large sentence-case display text, compact semibold labels, readable 15px original excerpts; 11–13px metadata, 14–18px supporting text, 19–24px panel and result headings, and 25–36px results headings. No decorative monospace. Body measure stays below 72ch.

## Layout

A 1184px maximum container with 40px desktop and 20px mobile margins. The first viewport pairs the value proposition with the actual input; results continue below as a reading list. At 800px, the page stacks and controls wrap. The task stays primary, without a dashboard sidebar.

## Elevation & Depth

Tonal layers and a single border define panels. No panel shadows. Depth is conveyed by the original excerpt's white inset and stage states.

## Shapes

8px inputs and primary controls, 6px compact actions, 16px major panels, 100px status pills and round stage dots. The search path is a ruled rail with connected stage dots, not a fake completion gauge.

## Components

Buttons have visible green focus outlines and distinct disabled states. The textarea is the page's main working surface. Results are separated by rules with original words, a fit explanation, then actions. Saved and irrelevant states persist. The animated rail pulses only the actual current stage, with all motion suppressed for reduced motion.

## Do's and Don'ts

- Do preserve a short route from description to Run.
- Do put sample disclosure beside actions and on every synthetic result.
- Do retain text and controls when motion is unavailable.
- Don't add claim metrics, invented posts or illustration-as-proof.
- Don't make the progress rail imply percentages or multiple searched sources.
