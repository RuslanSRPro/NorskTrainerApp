# 11 — Liquid Glass Engine

**Version:** 1.0
**Status:** Approved
**Owner:** Norsk Trainer Team
**Last Updated:** 2026-06-25

---

# Purpose

This document defines the Liquid Glass Engine for Norsk Trainer.

The Liquid Glass Engine is a reusable visual material system used by cards, buttons, bottom sheets, modals, navigation and future UI surfaces.

Its purpose is to create a consistent premium glass-like interface across the application.

---

# Why This Exists

The current Home Screen already has a strong Vision-style layout.

However, the glass effect is still incomplete.

The interface currently has:

* stable layout
* rounded cards
* light transparency
* basic blur
* floating tab bar

But it does not yet have a complete Liquid Glass material system.

This document defines how to complete it.

---

# Design Goal

Liquid Glass should feel like a real translucent material.

It should provide:

* depth
* softness
* light
* focus
* premium visual quality

It should never reduce readability.

---

# Material Layers

Every Liquid Glass surface should be built from consistent layers.

Recommended structure:

```text
Outer shadow
    ↓
Blur material
    ↓
Glass tint
    ↓
Subtle gradient
    ↓
Top highlight
    ↓
Inner glow
    ↓
Content
```

The material should not use dark bands inside the component.

Shadows should live outside the surface, not as visible stripes inside it.

---

# Glass Material Rules

## 1. Blur

Blur is the foundation of glass.

It should be strong enough to separate the foreground from the wallpaper but not so strong that the background disappears completely.

Recommended initial values:

| Material | Blur |
| -------- | ---- |
| Soft     | 38   |
| Frosted  | 54   |
| Liquid   | 68   |
| Crystal  | 82   |

---

## 2. Transparency

Glass must remain translucent.

Avoid nearly opaque white cards.

Recommended opacity:

| Surface               | Opacity   |
| --------------------- | --------- |
| Light background card | 0.38–0.58 |
| Dark background card  | 0.12–0.28 |
| Button                | 0.28–0.60 |
| Bottom Sheet          | 0.45–0.70 |

---

## 3. Gradient

Each glass surface should use a subtle gradient.

Recommended direction:

Top-left

↓

Bottom-right

Purpose:

* simulate light
* avoid flat surfaces
* create depth

---

## 4. Top Highlight

Every major glass surface should have a subtle top highlight.

Purpose:

* create a polished edge
* make the surface feel reflective
* separate glass from background

The highlight should be thin and soft.

---

## 5. Inner Glow

Glass should have a very subtle inner glow.

Purpose:

* create depth
* soften content boundaries
* prevent the surface from feeling flat

The glow should never look like a visible stripe.

---

## 6. Outer Shadow

Depth should come from outside the material.

Use soft shadows.

Avoid heavy shadows.

Avoid dark internal bands.

---

# Glass Styles

Norsk Trainer supports multiple glass styles.

## Soft

Low blur.

Gentle transparency.

Best for calm backgrounds.

---

## Frosted

Medium blur.

Balanced readability.

Best default style for most screens.

---

## Liquid

Higher blur.

More visible highlights and depth.

Best for premium Home and Settings surfaces.

---

## Crystal

High blur.

Sharper edges.

Best for modals, bottom sheets and focused actions.

---

# Components Using Liquid Glass

The following components should use the same material system.

## GlassCard

Primary container.

Used by:

* Home cards
* Settings cards
* Analytics cards
* Reading panels

---

## GlassButton

Primary and secondary actions.

---

## GlassIconButton

Icon-only actions.

Used by:

* Tab Bar
* Analytics button
* settings shortcuts

---

## GlassBottomSheet

Used for short selections.

Examples:

* language
* theme
* glass style
* wallpaper

---

## GlassModal

Used for focused states.

Examples:

* achievements
* confirmations
* important information

---

## FloatingTabBar

Navigation surface.

Should use the same material system as GlassCard.

---

# Implementation Plan

## Phase 1 — GlassCard v3

Goal:

Create the core reusable Liquid Glass material.

Requirements:

* correct blur
* translucent glass tint
* subtle gradient
* top highlight
* inner glow
* soft outer shadow
* no dark internal stripes
* configurable opacity through design tokens

---

## Phase 2 — GlassButton

Goal:

Build buttons using the same material.

Requirements:

* primary button
* secondary button
* destructive button
* press scale feedback
* consistent glass surface

---

## Phase 3 — GlassIconButton

Goal:

Build icon buttons using the same material.

Requirements:

* focused state
* inactive state
* press scale feedback
* theme accent support

---

## Phase 4 — GlassBottomSheet

Goal:

Create reusable bottom sheet material.

Requirements:

* blurred background
* rounded top corners
* drag handle
* option rows
* selected state

---

## Phase 5 — FloatingTabBar v2

Goal:

Upgrade navigation to use Liquid Glass material.

Requirements:

* floating glass surface
* active icon highlight
* subtle animation
* consistent material with cards and buttons

---

# Design Tokens

The Liquid Glass Engine should use shared design tokens.

Planned tokens:

```ts
glass.blur.soft
glass.blur.frosted
glass.blur.liquid
glass.blur.crystal

glass.opacity.light
glass.opacity.dark

glass.border.light
glass.border.dark

glass.shadow.soft
glass.shadow.strong
```

Tokens should live in:

```text
design-system/vision.ts
```

or a future dedicated file:

```text
design-system/glass.ts
```

---

# Quality Checklist

Before approving any glass component, verify:

* No visible dark internal stripe.
* Text remains readable.
* Background remains softly visible.
* Surface feels elevated.
* Highlight is subtle.
* Shadow is outside the component.
* Works in light and dark themes.
* Works over wallpapers.
* Works on small screens.

---

# Anti-Patterns

Avoid:

* opaque white cards
* dark internal bands
* inconsistent blur values
* random transparency
* duplicated glass implementations
* glass without readable contrast
* component-specific material hacks

---

# Relationship to Other Documents

Based on:

* PROJECT_PRINCIPLES.md
* 00_VISION.md
* 01_DESIGN_SYSTEM.md
* 02_UX_GUIDELINES.md

Used by:

* 03_COMPONENT_LIBRARY.md
* 04_HOME_SCREEN.md
* 05_SETTINGS_2.0.md
* 06_WALLPAPER_SYSTEM.md

---

# Living Document

This document evolves together with the Liquid Glass Engine.

Every new glass style or surface should be documented here before implementation.

---

**"The material should feel alive, but never distract from learning."**

---

**End of Document**
