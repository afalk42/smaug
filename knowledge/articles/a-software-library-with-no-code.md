---
title: "A Software Library with No Code"
type: article
date_added: 2026-01-26
source: "https://www.dbreunig.com/2026/01/08/a-software-library-with-no-code.html"
author: "Drew Breunig"
tags: [AI, coding-agents, spec-driven-development, open-source]
via: "Twitter bookmark from @karpathy"
---

Drew Breunig explores a thought experiment in spec-driven development by releasing `whenwords`, a software library that contains no code—only specifications and tests. The library implements time formatting functions and can be implemented in any programming language using AI coding agents by providing the specification and test cases.

The article questions fundamental assumptions about software libraries in an era of advanced coding agents: when AI can reliably implement tightly-specified code, do we still need traditional language-specific library implementations? Breunig argues that for simple utility functions, what matters is a well-defined specification that agents can implement on-demand in the specific conventions of any language and project.

## Key Takeaways

- Spec-driven development enables language-agnostic library implementations through AI agents
- With advanced coding models, a library defined by specification and tests can be generated on-demand for any language
- Performance-critical systems, complex testing scenarios, and established ecosystem libraries still benefit from traditional code implementations
- The `whenwords` library supports implementation in Ruby, Python, Rust, Elixir, Swift, PHP, Bash and other languages all from a single specification

## Links

- [Article](https://www.dbreunig.com/2026/01/08/a-software-library-with-no-code.html)
- [whenwords GitHub](https://github.com/dbreunig/whenwords)
- [Original Tweet](https://x.com/karpathy/status/2015887154132746653)
