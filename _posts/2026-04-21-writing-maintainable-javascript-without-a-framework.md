---
layout: post
title: Writing Maintainable JavaScript Without a Framework
date: 2026-04-21
description: Small habits that keep plain JavaScript readable as a project grows.
tags: [JavaScript, Best Practices]
---

Not every page needs React. For small sites, vanilla JavaScript is fast and has no build step. The trick is keeping it organized.

A few habits help:

1. Wrap page scripts in an IIFE so nothing leaks into the global scope.
2. Use `addEventListener` with event delegation instead of inline handlers.
3. Check that an element exists before you attach a listener to it.
4. Keep DOM selectors in one place near the top of the file.

These rules are simple, but they make a script easy to read six months later.
