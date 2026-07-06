# 14 — Next Design Sprint

## Goal

Finish the Liquid Glass Engine before implementing additional screens.

---

# Phase 1 — Glass Engine Refinement

## Glass Tokens

Continue improving:

glass.ts

Move every reusable visual value into tokens.

Examples:

* blur
* opacity
* borders
* highlights
* gradients
* shadows
* corner radius

No duplicated values should remain inside components.

---

## Glass Material

Create one consistent visual material.

Improve:

* transparency
* blur
* glass depth
* reflections
* inner glow
* outer shadow

Remove remaining "white card" feeling.

Material should feel closer to visionOS.

---

## GlassCard v4

Tasks:

* reduce white opacity
* improve blur
* improve highlight
* improve depth
* improve edge lighting
* improve wallpaper visibility
* verify readability

---

## GlassButton v2

Tasks:

* improve gradients
* improve press animation
* improve shadows
* improve accessibility
* improve dark theme

---

## GlassIconButton v2

Tasks:

* improve active capsule
* improve inactive state
* improve blur
* improve animation

---

## FloatingTabBar v2

Tasks:

* make material lighter
* reduce white opacity
* create glass capsule for active icon
* improve spacing
* improve floating effect
* improve animation

---

## GlassAvatar

Create reusable avatar component.

Should use exactly the same material as GlassCard.

Used on:

* Home
* Settings
* Profile

---

## GlassBottomSheet

Create reusable bottom sheet.

Used for:

* language selection
* theme selection
* wallpaper selection
* appearance selection

---

## GlassModal

Reusable modal component.

---

# Phase 2 — Wallpaper Engine

Implement:

* bundled wallpapers
* custom wallpapers
* blur strength
* wallpaper opacity
* wallpaper preview

---

# Phase 3 — Settings 2.0

Only after Glass Engine is complete.

Settings should become a compact dashboard.

No long scrolling.

---

## Settings Sections

### Profile

* Avatar
* Name

---

### Language

Tap

↓

Bottom Sheet

↓

Choose language

↓

Auto Save

↓

Close

---

### Appearance

Bottom Sheet

Options:

* Light
* Dark
* Auto

---

### Theme

Bottom Sheet

Current four themes remain.

Future themes supported.

---

### Wallpaper

Bottom Sheet

Built-in wallpapers

*

Choose photo

*

Remove wallpaper

---

### Accent Color

Future support.

---

### Learning Modes

Restore multiple selection.

User should be able to enable several modes simultaneously.

Example:

✓ Flashcards

✓ Multiple Choice

✓ Typing

✓ Listening

The application will combine enabled modes during learning.

---

### Notifications

Compact section.

---

### AI

Future section.

---

# UX Rules

Every setting should require at most:

Tap

↓

Choose

↓

Auto Save

↓

Done

No Save button.

No long settings page.

Everything should fit naturally on screen.

---

# After Settings

Next redesign order:

Reading

↓

Voice

↓

Training

↓

Analytics

↓

Achievements

---

# Development Rule

Documentation first.

Implementation second.

Update documentation after implementation.

Never allow documentation and implementation to diverge.
