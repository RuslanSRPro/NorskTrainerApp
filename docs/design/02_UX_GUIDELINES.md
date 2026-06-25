# 02 — UX Guidelines

**Version:** 1.0
**Status:** Approved
**Owner:** Norsk Trainer Team
**Last Updated:** 2026-06-25

---

# Purpose

This document defines the user experience principles of Norsk Trainer.

While the Design System explains how the application looks, this document explains how it behaves.

Every interaction should follow these guidelines.

---

# UX Philosophy

Learning should feel effortless.

The interface should quietly guide users toward their next learning activity without requiring unnecessary decisions.

Users should spend their time learning Norwegian—not figuring out how the application works.

---

# The Golden Rule

Every screen should answer one question.

Examples:

| Screen   | Primary Question                      |
| -------- | ------------------------------------- |
| Home     | What should I learn today?            |
| Training | How do I continue learning?           |
| Reading  | What can I read today?                |
| Voice    | What should I practice speaking?      |
| Settings | How do I personalize the application? |

If a screen tries to answer multiple questions, it should be redesigned.

---

# Navigation Principles

Navigation should always feel predictable.

Users should always know:

* where they are
* where they can go next
* how to return

Avoid deep navigation whenever possible.

---

# Home Screen Principles

Home is the starting point of the application.

Its purpose is not to display every feature.

Its purpose is to guide today's learning.

The Home screen should answer:

> **"What is the best next step today?"**

---

# One Primary Action

Every screen should present one dominant action.

Secondary actions should remain available but visually less prominent.

---

# Thumb-Friendly Design

Primary interactions should remain reachable with one hand.

Frequently used controls should be placed in the lower half of the screen whenever practical.

---

# Minimize Cognitive Load

Reduce unnecessary thinking.

Avoid:

* too many choices
* long settings pages
* unnecessary dialogs
* duplicated navigation

The application should help users make decisions instead of asking them to make unnecessary ones.

---

# Progressive Disclosure

Only show information when it becomes useful.

Advanced options should remain hidden until needed.

This keeps the interface clean.

---

# Automatic Saving

Whenever possible:

* save automatically
* update immediately
* avoid confirmation dialogs

Users should never wonder whether their changes were saved.

---

# Bottom Sheets

Bottom Sheets are the preferred interaction pattern for small selections.

Use Bottom Sheets for:

* language
* theme
* glass style
* wallpaper selection
* sorting
* filtering

Avoid opening a full screen when only a few options exist.

---

# Dedicated Screens

Use a dedicated screen when users need to configure a larger feature.

Examples:

* Training Modes
* Voice Settings
* Reading Preferences
* Analytics

---

# Multiple Selection

Whenever multiple learning strategies can work together, allow users to select multiple options.

Examples:

Training Modes:

☑ Flashcards

☑ Multiple Choice

☑ Typing

☑ Cloze

The application should intelligently combine enabled modes.

---

# Personalization

Users should feel that Norsk Trainer belongs to them.

Support personalization through:

* profile name
* wallpaper
* visual theme
* interface language
* learning preferences

Personalization should remain simple.

---

# Feedback

The application should always acknowledge user actions.

Examples:

* subtle animation
* progress updates
* success indicators
* smooth transitions

Avoid disruptive alerts.

---

# Error Handling

Prevent errors whenever possible.

When errors occur:

* explain clearly
* provide the next step
* never blame the user

---

# Empty States

Every empty screen should help the user move forward.

Instead of saying:

"No data."

Explain:

* why
* what to do next
* how to continue

---

# Loading States

Loading should feel smooth.

Use skeletons or lightweight placeholders whenever possible.

Avoid blocking the interface.

---

# Motivation

Motivation should come from progress—not pressure.

Avoid:

* punishment
* guilt
* aggressive streak mechanics

Celebrate:

* completed sessions
* consistency
* milestones
* personal improvement

---

# Screen Complexity

Every screen should be evaluated by the following questions:

* Can anything be removed?
* Is every element useful?
* Is the primary action obvious?
* Can the screen fit within the first viewport?
* Does this reduce learning friction?

---

# UX Checklist

Before implementing a new screen, verify:

* One primary purpose.
* One primary action.
* Minimal scrolling.
* Thumb-friendly interaction.
* Automatic saving where appropriate.
* Consistent navigation.
* Clear hierarchy.
* Reduced cognitive load.
* Personalization supported where relevant.
* Aligned with Product Vision.

---

# UX Anti-Patterns

Avoid:

* multiple competing primary actions
* unnecessary confirmation dialogs
* duplicate navigation
* overloaded screens
* hidden critical actions
* inconsistent interaction patterns
* forcing users through long configuration flows

---

# Relationship to Other Documents

This document builds upon:

* PROJECT_PRINCIPLES.md
* 00_VISION.md
* 01_DESIGN_SYSTEM.md

It guides the implementation of:

* 03_COMPONENT_LIBRARY.md
* 04_HOME_SCREEN.md
* 05_SETTINGS_2.0.md

---

# Living Document

The UX Guidelines evolve together with Norsk Trainer.

Every significant interaction pattern should be documented before implementation.

The goal is a consistent, predictable and enjoyable learning experience across the entire application.

---

**"Good UX disappears. Learning remains."**

---

**End of Document**
