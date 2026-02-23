---
title: "Ralph"
type: tool
date_added: 2026-01-07
source: "https://github.com/snarktank/ralph"
tags: [ai-agents, autonomous-coding, workflow-automation, product-development]
via: "Twitter bookmark from @ryancarson"
---

Ralph is an autonomous AI agent loop that runs AI coding tools (Amp or Claude Code) repeatedly until all product requirements are complete. Each iteration is a fresh instance with clean context. Memory persists via git history, progress.txt, and prd.json.

Based on Geoffrey Huntley's Ralph pattern, this framework enables autonomous feature implementation where the AI system iteratively works through user stories until the entire PRD is fulfilled.

## Key Features

- Autonomous iteration loop for completing product requirements
- Support for multiple AI coding tools (Amp and Claude Code)
- Fresh context per iteration with persistent memory via git history and progress tracking
- Structured task management using PRD JSON format
- Quality checks (typecheck, tests) with automatic commit on success
- Built-in flowchart visualization showing workflow steps
- Marketplace integration for easy installation and sharing

## Links

- [GitHub](https://github.com/snarktank/ralph)
- [Original Tweet](https://x.com/ryancarson/status/2008950489904472501)
