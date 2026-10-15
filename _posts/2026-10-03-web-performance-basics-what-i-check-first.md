---
layout: post
title: "Web Performance Basics: What I Check First"
date: 2026-10-03
description: A short checklist for finding the biggest speed wins on a small website before touching any code.
tags: [Web Dev, Performance]
---

When a page feels slow, I resist the urge to rewrite things. I start with a short checklist and fix the cheapest problems first.

1. **Image size.** Large PNGs are the most common culprit. Converting screenshots to WebP often cuts them by 80% or more.
2. **Render-blocking scripts.** Move scripts to the end of the body or add `defer` so the page can paint first.
3. **Third-party code.** Every CDN script adds a network request. Ask whether a small build step could replace it.
4. **Caching.** Static hosts like GitHub Pages already send sensible cache headers, so versioned filenames matter more than tweaking headers.

Measure before and after with your browser's Network tab. If a change doesn't move the numbers, revert it.
