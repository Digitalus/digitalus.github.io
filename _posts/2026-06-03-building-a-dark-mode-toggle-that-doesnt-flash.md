---
layout: post
title: Building a Dark Mode Toggle That Doesn't Flash
date: 2026-06-03
description: How to read the saved theme before the page paints, so visitors never see the wrong colors.
tags: [JavaScript, CSS, Accessibility]
---

A common dark mode bug is the white flash on page load. The page paints in light mode, then JavaScript switches it to dark.

The fix is to run a tiny script in the `<head>`, before the body renders:

```html
<script>
  var saved = localStorage.getItem('theme');
  var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', saved || (dark ? 'dark' : 'light'));
</script>
```

The toggle button only needs to flip the attribute and save the choice. Respecting the system preference by default is a good accessibility practice.
