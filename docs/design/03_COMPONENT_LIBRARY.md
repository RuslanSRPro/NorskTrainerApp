# 03 — Component Library

**Version:** 1.0
**Status:** Approved
**Owner:** Norsk Trainer Team
**Last Updated:** 2026-06-25

---

# Purpose

This document defines the reusable UI components that form the foundation of Norsk Trainer.

Every screen should be assembled from these components instead of creating custom UI.

The goal is consistency, maintainability and faster development.

---

# Component Philosophy

Build once.

Reuse everywhere.

Whenever a new UI element appears, first ask:

> Can this become a reusable component?

If the answer is yes, it belongs in the Component Library.

---

# Foundation Components

## AppPage

Purpose

The root layout used by every screen.

Responsibilities

* Safe Area
* Wallpaper background
* Scroll behavior
* Common page padding

---

## WallpaperBackground

Displays the current wallpaper.

Responsibilities

* Built-in wallpapers
* Custom user wallpaper
* Blur support
* Theme adaptation

---

## FloatingTabBar

Primary application navigation.

Responsibilities

* Glass appearance
* Floating layout
* Thumb-friendly placement

---

# Glass Components

## GlassCard

Purpose

Container for grouped content.

Used for:

* statistics
* progress
* settings
* information
* actions

---

## GlassButton

Primary interactive button.

Supports:

* Primary
* Secondary
* Icon
* Destructive

---

## GlassInput

Text input component.

Supports:

* labels
* validation
* helper text

---

## BottomSheet

Preferred component for short selections.

Examples

* language
* theme
* glass style
* sorting

---

# Home Components

## HomeHeader

Displays greeting and profile.

---

## ProgressHeroCard

Displays overall learning progress.

---

## TodayStatsCard

Displays today's learning statistics.

---

## DailyPlanCard

Shows today's recommended action.

---

## AnalyticsSheet

Displays detailed analytics.

Opened from Home.

---

# Settings Components

## ProfileNameSection

---

## AppearanceSection

---

## WallpaperSection

---

## SettingsSection

---

# Design Rules

Every component should:

* have a single responsibility
* be reusable
* support all themes
* support localization
* support accessibility

---

# Anti-Patterns

Avoid:

* screen-specific components that duplicate existing ones
* hardcoded colors
* duplicated layouts
* duplicated animations

---

# Future Components

Planned additions:

* GlassSwitch
* GlassSlider
* GlassBadge
* GlassTile
* ProgressRing
* AchievementCard
* EmptyState
* SkeletonLoader
* SearchBar
* SegmentedControl

---

# Relationship to Other Documents

Based on:

* 01_DESIGN_SYSTEM.md
* 02_UX_GUIDELINES.md

Used by:

* Home Screen
* Settings
* Reading
* Voice
* Training
* Weak Words

---

**"Reusable components create reusable experiences."**

---

**End of Document**
