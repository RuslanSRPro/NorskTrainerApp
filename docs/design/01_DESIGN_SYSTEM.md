# 01 — Design System

**Version:** 1.0
**Status:** Approved
**Owner:** Norsk Trainer Team
**Last Updated:** 2026-06-25

---

# Purpose

The Norsk Trainer Design System defines the visual language, interaction patterns, reusable UI components and design rules used throughout the application.

Its purpose is to ensure consistency, scalability and a premium user experience across every screen.

The Design System is the single source of truth for all UI decisions.

---

# Relationship to Other Documents

This document expands the product vision described in:

* PROJECT_PRINCIPLES.md
* 00_VISION.md

This document serves as the foundation for:

* 02_UX_GUIDELINES.md
* 03_COMPONENT_LIBRARY.md
* 04_HOME_SCREEN.md
* 05_SETTINGS_2.0.md

---

# Design Principles

Every interface should follow these principles.

## Clarity

Users should immediately understand what the screen is for.

The interface should never compete with learning.

---

## Consistency

The same interaction should always behave the same way.

Visual consistency is more important than visual novelty.

---

## Simplicity

Every unnecessary element should be removed.

Every visible element must have a purpose.

---

## Calm

The interface should feel relaxed.

Learning should never feel stressful.

---

## Premium Quality

Attention to detail creates trust.

Animations, spacing, typography and colors should feel intentional.

---

# Visual Language

The Norsk Trainer interface is inspired by modern Apple design principles.

The application should feel:

* lightweight
* elegant
* focused
* calm
* modern
* personal

Technology should remain invisible.

Learning should remain the center of attention.

---

# Design Tokens

The following values should be reused throughout the application.

## Spacing

| Token | Value |
| ----- | ----: |
| XS    |  4 px |
| SM    |  8 px |
| MD    | 16 px |
| LG    | 24 px |
| XL    | 32 px |
| XXL   | 48 px |

Spacing should never be arbitrary.

---

## Border Radius

| Token  |  Value |
| ------ | -----: |
| Small  |   8 px |
| Medium |  16 px |
| Large  |  24 px |
| Pill   | 999 px |

---

## Elevation

Prefer soft shadows.

Avoid heavy Android-style shadows.

Glass and blur should create depth instead of dark shadows.

---

## Animation

| Token  | Duration |
| ------ | -------: |
| Fast   |   150 ms |
| Normal |   250 ms |
| Slow   |   400 ms |

Animations should feel responsive but never distracting.

---

# Layout System

All screens should be built around a consistent layout.

## Safe Area

Respect device safe areas on all platforms.

---

## Vertical Rhythm

Content should follow a consistent vertical rhythm.

Avoid random spacing.

---

## Scroll Behavior

Users should rarely need to scroll.

Whenever possible, the most important actions should fit within the initial viewport.

---

# Typography

Typography establishes visual hierarchy.

Recommended roles:

| Role     | Usage                 |
| -------- | --------------------- |
| Hero     | Main focus            |
| Title    | Screen titles         |
| Subtitle | Section headers       |
| Body     | Main content          |
| Caption  | Secondary information |

Typography should remain clean and highly readable.

---

# Color System

Norsk Trainer supports multiple themes.

Current themes:

* Light
* Dark
* Turquoise
* Purple

All themes share the same semantic color system.

Semantic colors are preferred over hard-coded colors.

---

# Glass System

Glass is one of the defining visual elements of Norsk Trainer.

Glass components should provide:

* depth
* hierarchy
* focus

Glass should never reduce readability.

Blur enhances content rather than replacing contrast.

---

# Wallpaper System

Wallpapers provide personalization without distracting from learning.

Supported categories include:

* Mountains
* Fjords
* Forest
* Aurora
* Winter
* Custom wallpapers

Glass components should always remain readable regardless of wallpaper.

---

# Component Architecture

The interface is built from reusable components.

Examples:

* AppPage
* GlassCard
* GlassButton
* GlassInput
* BottomSheet
* FloatingTabBar
* ProgressHeroCard
* TodayStatsCard

Every new component should be evaluated for reusability.

---

# Motion System

Animations communicate state changes.

They should:

* feel natural
* be subtle
* improve understanding

Animations should never delay interaction.

---

# Responsive Design

The application should adapt gracefully to different devices.

Supported layouts include:

* iPhone SE
* Standard iPhone
* iPhone Plus / Max
* iPad

The experience should remain consistent regardless of screen size.

---

# Accessibility

Accessibility is part of the design.

The application should support:

* sufficient contrast
* readable typography
* large touch targets
* dynamic text where appropriate

Accessibility should never be treated as an afterthought.

---

# Anti-Patterns

Avoid:

* random spacing
* inconsistent radii
* unnecessary decorations
* duplicate interaction patterns
* multiple primary actions on one screen
* excessive scrolling
* visual clutter

---

# Quality Checklist

Before implementing any new screen, verify:

* Uses AppPage.
* Uses design tokens.
* Uses semantic colors.
* Uses Glass components where appropriate.
* Has one primary purpose.
* Minimizes cognitive load.
* Supports future scalability.
* Aligns with Product Vision.

---

# Living System

The Design System evolves together with Norsk Trainer.

Every reusable visual element should be documented here before becoming part of the application.

---

**"Consistency creates confidence. Simplicity creates focus."**

---

**End of Document**
