---
title: "llm.c"
type: tool
date_added: 2024-07-11
source: "https://github.com/karpathy/llm.c"
tags: [llm, training, cuda, gpt-2, optimization]
via: "Twitter bookmark from @karpathy"
---

LLM training in simple, raw C/CUDA without heavy dependencies. A focused implementation for reproducing GPT-2 and GPT-3 models with performance comparable to or better than PyTorch.

## Key Features

- Pure C/CUDA implementation with minimal dependencies (no PyTorch or cPython required)
- About 7% faster than PyTorch Nightly on bleeding edge code
- Simple reference CPU fp32 implementation in ~1,000 lines of clean code
- Support for distributed training on multiple nodes
- Mixed precision (bfloat16) support for efficiency
- Complete GPT-2 and GPT-3 reproduction workflows

## Links

- [GitHub](https://github.com/karpathy/llm.c)
- [Original Tweet](https://x.com/karpathy/status/1811467135279104217)
