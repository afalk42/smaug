---
title: "Mole - Deep clean and optimize your Mac"
description: "🐹 Deep clean and optimize your Mac. Consolidated features from CleanMyMac, AppCleaner, DaisyDisk, and iStat into a single binary."
author: "tw93"
url: "https://github.com/tw93/Mole"
stars: 24696
language: "Shell"
topics:
  - analyzer
  - appcleaner
  - clean
  - cleaner
  - cleaner-cli
  - cleaner-script
  - command-line
  - daisydisk
  - istat
  - mac
  - macos
  - optimize
  - sensei
  - shell
  - uninstall
archived: false
---

# Mole - Deep Clean and Optimize Your Mac

A unified toolkit for macOS system optimization and cleaning. Consolidates features from CleanMyMac, AppCleaner, DaisyDisk, and iStat into a single binary.

## Key Features

- **Unified toolkit**: Consolidated features into a single binary
- **Deep cleaning**: Scans and removes caches, logs, and browser leftovers to reclaim gigabytes of space
- **Smart uninstaller**: Thoroughly removes apps along with launch agents, preferences, and hidden remnants
- **Disk insights**: Visualizes usage, manages large files, rebuilds caches, and refreshes system services
- **Live monitoring**: Real-time stats for CPU, GPU, memory, disk, and network

## Installation

```bash
brew install mole
```

Or by script:
```bash
curl -fsSL https://raw.githubusercontent.com/tw93/mole/main/install.sh | bash
```

## Commands

- `mo` - Interactive menu
- `mo clean` - Deep cleanup
- `mo uninstall` - Remove apps + leftovers
- `mo analyze` - Visual disk explorer
- `mo status` - Live system health dashboard
- `mo optimize` - Refresh caches & services
- `mo purge` - Clean project build artifacts
