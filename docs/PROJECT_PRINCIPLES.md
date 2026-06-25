# Norsk Trainer Project Principles

**Version:** 1.0
**Status:** Approved
**Owner:** Norsk Trainer Team
**Last Updated:** 2026-06-25

---

# Purpose

This document defines the fundamental principles that guide the development of Norsk Trainer.

These principles establish how product decisions, UX, architecture, implementation and documentation are created throughout the lifetime of the project.

This is the highest-level document of the project.

---

# Mission

Build the most enjoyable, intuitive and motivating Norwegian learning application.

The goal is not to build the largest number of features.

The goal is to build the best learning experience.

---

# Vision

Norsk Trainer should help users successfully learn Norwegian every day.

The application should always feel:

* simple
* modern
* motivating
* calm
* personal
* beautiful

Learning should never feel overwhelming.

---

# Core Principles

## Principle 1 — Product Before Technology

Technology exists to solve product problems.

Every feature begins by answering:

**Why are we building this?**

before

**How should we build this?**

---

## Principle 2 — Documentation First

Documentation is created before implementation.

Every significant feature follows this workflow:

```text
Idea
    ↓
Discussion
    ↓
Documentation
    ↓
Architecture
    ↓
Implementation
    ↓
Testing
    ↓
Git Commit
    ↓
Documentation Update
```

Documentation is the primary source of truth.

---

## Principle 3 — User Experience Is a Core Feature

User experience is not decoration.

It is one of the primary features of Norsk Trainer.

Every interaction should reduce friction.

Every screen should feel obvious.

---

## Principle 4 — Consistency

Users should never need to relearn the interface.

The same interaction should always behave the same way throughout the application.

---

## Principle 5 — Architecture Before Code

Good architecture reduces future complexity.

Reusable solutions are preferred over quick solutions.

Small components are preferred over large monolithic screens.

---

## Principle 6 — Build Reusable Components

Every UI element should be reusable whenever possible.

Examples include:

* GlassCard
* GlassButton
* GlassInput
* AppPage
* BottomSheet
* ProgressHeroCard
* TodayStatsCard

---

## Principle 7 — One Primary Goal Per Screen

Each screen should answer one question.

Examples:

**Home**

What should I learn today?

**Training**

Learn vocabulary.

**Reading**

Learn through real texts.

**Voice**

Improve pronunciation.

**Settings**

Personalize the application.

---

## Principle 8 — Automatic Saving

Whenever possible, changes are saved automatically.

Avoid unnecessary confirmation dialogs and Save buttons.

---

## Principle 9 — Personalization

Users should be able to personalize the application.

Examples:

* interface language
* wallpaper
* visual theme
* glass style
* learning modes
* personal profile

Customization should remain simple.

---

## Principle 10 — Long-Term Thinking

Every decision should support future growth.

Before implementation ask:

* Can this be reused?
* Can this be extended?
* Will this still make sense in two years?

---

## Principle 11 — Motivation Instead of Pressure

Norsk Trainer motivates users through visible progress.

The application should never rely on guilt, punishment or pressure.

Learning should always feel rewarding.

---

## Principle 12 — Continuous Improvement

Every release should improve the application.

Not by adding more features,

but by making the experience simpler, cleaner and better.

---

# Definition of Done

A feature is complete only when:

* implementation is finished
* testing is completed
* documentation is updated
* architecture remains consistent
* changes are committed to Git

---

# Design Philosophy

The interface follows several design values.

* Clarity over decoration.
* Consistency over novelty.
* Calm visual language.
* Apple-inspired usability.
* Thumb-friendly interaction.
* Minimal cognitive load.
* Personalization without complexity.

---

# Team Responsibilities

## Product Owner

Responsible for:

* product vision
* learning methodology
* feature priorities
* user needs
* product validation

---

## Solution Architect

Responsible for:

* software architecture
* design system
* UX consistency
* documentation quality
* maintainability
* scalability

---

# Living Document

This document evolves together with Norsk Trainer.

New principles may be added as the project grows.

Existing principles should only change after discussion and agreement.

---

# Related Documents

* docs/README.md
* docs/design/README.md
* docs/design/00_VISION.md
* docs/design/01_DESIGN_SYSTEM.md
* docs/design/02_UX_GUIDELINES.md

---

**End of Document**
