# Norsk Trainer Project Principles

**Version:** 1.0
**Status:** Approved
**Last Updated:** 2026-06-25

---

# Purpose

This document defines the fundamental principles that guide the development of Norsk Trainer.

These principles are the foundation for every product decision, UX decision, architectural choice, and implementation.

Whenever a new feature is proposed, these principles take precedence over implementation details.

---

# Vision Statement

Norsk Trainer is designed to become the most intuitive, motivating and personalized Norwegian learning application.

The goal is not simply to teach vocabulary.

The goal is to help people successfully learn Norwegian every single day.

Every feature should reduce friction, increase motivation, and make learning enjoyable.

---

# Core Principles

## Principle 1 — Product First

Every implementation begins with understanding the product problem.

We always answer:

**Why are we building this?**

before asking

**How do we build this?**

---

## Principle 2 — Documentation First

Every significant feature starts with documentation.

Workflow:

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

Documentation Update

Documentation is the project's source of truth.

---

## Principle 3 — User Experience is a Feature

A great user experience is not decoration.

It is one of the core features of Norsk Trainer.

Every interaction should feel:

* natural
* simple
* fast
* predictable

---

## Principle 4 — Consistency Over Complexity

The application should always behave consistently.

Similar actions should work the same way everywhere.

Users should never need to learn the same interaction twice.

---

## Principle 5 — One Primary Goal

Every screen should have one primary purpose.

Examples:

Home

→ What should I learn today?

Training

→ Learn vocabulary.

Reading

→ Learn through context.

Voice

→ Improve pronunciation.

Settings

→ Personalize the application.

---

## Principle 6 — Documentation is the Source of Truth

If implementation and documentation differ,

documentation must be reviewed.

The team never relies on memory.

---

## Principle 7 — Architecture Before Code

Architecture is designed before implementation.

Reusable components are preferred over duplicated code.

Long-term maintainability is more important than short-term speed.

---

## Principle 8 — Small Reusable Components

Large screens are built from small reusable components.

Examples:

GlassCard

GlassButton

GlassInput

BottomSheet

AppPage

ProgressHeroCard

This keeps the application scalable.

---

## Principle 9 — Automatic Saving

Whenever possible,

user changes are saved automatically.

The application should not require unnecessary confirmation buttons.

---

## Principle 10 — Personalization

Every user should be able to make Norsk Trainer feel personal.

Examples include:

* preferred language
* wallpaper
* visual theme
* glass style
* training modes
* learning preferences

---

## Principle 11 — Learning Should Feel Rewarding

The application motivates users through visible progress.

It should never rely on guilt or punishment.

The experience should encourage users to return every day.

---

## Principle 12 — Build for Years

Every decision should consider future growth.

Ask before implementation:

* Can this be reused?
* Can this be extended?
* Will this still make sense in two years?

---

# Development Workflow

Every significant task follows the same workflow.

Idea

↓

Product Discussion

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

---

# Definition of Done

A task is complete only when:

* implementation is finished
* tested
* committed
* documentation updated
* architecture remains consistent

---

# Design Philosophy

Norsk Trainer follows several design principles:

* clarity over decoration
* consistency over novelty
* calm visual language
* modern Apple-inspired interface
* thumb-friendly interaction
* minimal cognitive load
* beautiful but functional

---

# Team Agreement

The project is developed collaboratively.

The Product Owner defines the learning experience and product direction.

The Technical Architect is responsible for:

* software architecture
* design system
* UX consistency
* documentation quality
* maintainability
* scalability

All significant product decisions should be discussed before implementation.

---

# Living Document

This document evolves together with the project.

New principles may be added as Norsk Trainer grows.

Existing principles should change only after careful discussion.

---

**End of Document**
