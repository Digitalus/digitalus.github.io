---
layout: post
title: Git Workflows I Actually Use
date: 2026-05-14
description: A simple branching routine for solo projects that still keeps history clean.
tags: [Git, Workflow]
---

Fancy Git workflows are great for big teams. For my own projects, I use a short routine:

- Work on a short-lived branch, such as `feature/contact-form`.
- Commit in small, focused steps with clear messages.
- Rebase onto `main` before merging so the history stays linear.
- Delete the branch after it merges.

I also run `git status` often. It sounds obvious, but it catches stray files before they reach a commit.
