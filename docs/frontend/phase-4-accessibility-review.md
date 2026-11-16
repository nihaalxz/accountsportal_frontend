# Phase 4 Accessibility (a11y) Review

This document audits the accessibility standards implemented in the Phase 4 frontend pages.

---

## 1. Document Structure & Landmarks
- **Semantic HTML5**: Pages utilize semantic container tags including `<main>`, `<section>`, `<article>`, `<header>`, `<form>`, and `<table>` to establish clear accessibility tree paths.
- **Headings Structure**: Every route utilizes a single `<h1>` tag at the page header level followed by nested `<h2>` and `<h3>` tags in order (e.g. table sections, card lists).

---

## 2. Forms & Inputs
- **Associated Labels**: All input components on forms (Salary payments, supplier registrations, loan requests, adjustments) have explicitly associated `<label>` tags with matching `for` and `id` properties.
- **Helper Texts**: System limitations or instructions are presented adjacent to the input tags for screen-reader readability.

---

## 3. Colors & High Contrast
- **WCAG compliance**: Color tokens in `index.css` conform to a contrast ratio greater than 4.5:1.
- **Text over backgrounds**: Text values on table headers and status badges utilize high contrast text colors specifically tailored for dark and light modes.

---

## 4. Keyboard Navigation & Interaction
- **Tab Order**: Forms and tables have natural tab indexes. Dialog buttons are focusable and closeable via `Escape` keys.
- **Aria Attributes**: Action badges and status badge elements utilize appropriate aria attributes for screen reader voiceover guidance.
