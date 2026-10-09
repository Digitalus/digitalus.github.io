---
layout: post
title: Understanding CSS Custom Properties for Theming
date: 2026-03-09
description: Using CSS variables to build a light and dark theme without duplicating styles.
tags: [CSS, Design Systems]
---

CSS custom properties, also called variables, make theming much easier. You define a value once and reuse it everywhere:

```css
:root {
  --canvas: 249 250 251;
  --ink: 17 24 39;
}

[data-theme="dark"] {
  --canvas: 11 15 23;
  --ink: 229 231 235;
}
```

Store colors as bare RGB triplets, then wrap them in `rgb(var(--ink))` where you use them. That lets tools like Tailwind add opacity with a slash. Switching themes becomes a single attribute change on the `<html>` element.
