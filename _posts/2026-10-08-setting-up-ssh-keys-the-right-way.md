---
layout: post
title: Setting Up SSH Keys the Right Way
date: 2026-10-08
description: Why SSH keys beat passwords, and the few commands I use to generate, protect, and use them with GitHub.
tags: [IT, Security, Git]
---

Passwords can be guessed or leaked. SSH keys use a pair of files, so the private half never leaves your machine.

To set one up:

```bash
ssh-keygen -t ed25519 -C "you@example.com"
```

Accept the default location and **set a passphrase**. The passphrase protects the key if someone copies the file.

Then:

1. Start the agent and add the key with `ssh-add`.
2. Copy the contents of the `.pub` file into your GitHub account under SSH keys.
3. Test the connection with `ssh -T git@github.com`.

Never share the private key file, and never commit it to a repository. If you think a key has leaked, delete it from GitHub and generate a new one.
