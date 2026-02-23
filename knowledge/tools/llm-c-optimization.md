---
title: "llm.c"
type: tool
date_added: 2024-04-13
source: "https://github.com/karpathy/llm.c"
tags: [cuda, optimization, machine-learning, performance, pytorch]
via: "Twitter bookmark from @karpathy"
---

llm.c is a CUDA-optimized implementation of large language model training that achieved performance parity with PyTorch through careful optimization and bug fixing.

## Key Features

- Matches PyTorch performance (26.2ms/iteration with tf32 forward pass)
- Optimized cuBLAS integration
- Custom softmax kernel for extended sequence lengths
- CUDA-native implementation for maximum efficiency

## Links

- [GitHub](https://github.com/karpathy/llm.c)
- [Original Tweet](https://x.com/karpathy/status/1779272336186978707)
