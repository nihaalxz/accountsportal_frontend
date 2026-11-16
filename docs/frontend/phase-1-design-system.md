# Phase 1 Design System

This document registers the layout styles, visual parameters, and Amber visual token implementations.

## Color Language

The accounts portal visual language is defined by Amber / Yellow:

- **Primary Identity**: Amber 500 (`#eab308` / `hsl(45 93% 47%)`).
- **Primary Hover**: Amber 600 (`#ca8a04` / `hsl(45 93% 40%)`).
- **Primary Foreground**: Charcoal (`hsl(45 95% 5%)`), ensuring high readability contrast on yellow badges and buttons.

## Typography

- **Core Font Family**: `Inter` (sans-serif fallbacks). Loaded dynamically via system font stack and Google Font declarations, optimized for numeric densities needed by ledger entries.
- **Sizes**:
    - `text-xs` (0.75rem / 12px) - used for table details and headers.
    - `text-sm` (0.875rem / 14px) - standard body reading size.
    - `text-base` (1rem / 16px) - headers and input labels.

## Grid & Density

- Padding density is customized to allow more ledger rows to fit inside viewports:
    - Table padding: Dense cell sizing (`py-2 px-3` / standard h-8 elements).
    - Component gaps: Standard space spacing (`gap-2` to `gap-4`).
- Touch target areas: Interactive mobile targets are maintained at a minimum of `44px x 44px` for touch accessibility.
