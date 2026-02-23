---
title: "Hierarchical Reasoning Model (HRM)"
type: tool
date_added: 2025-08-01
source: "https://github.com/sapientinc/HRM"
tags: ["ai", "reasoning", "deep-learning", "brain-inspired-ai"]
via: "Twitter bookmark from @heyshrutimishra"
---

Hierarchical Reasoning Model is a breakthrough recurrent architecture that achieves exceptional reasoning capabilities with only 27 million parameters. Unlike traditional large language models that rely on chain-of-thought prompting and extensive pre-training data, HRM uses a novel two-module design inspired by hierarchical processing in the human brain.

## Key Innovation

The model uses two interdependent recurrent modules:
- **High-level module:** Handles slow, abstract planning and task decomposition
- **Low-level module:** Manages rapid, detailed computations and execution

This dual-process architecture allows HRM to achieve near-perfect performance on complex reasoning tasks including Sudoku puzzles and maze solving with only 1000 training examples.

## Performance Highlights

- Achieves reasoning performance comparable to Claude 3.5 and Gemini with 27M parameters
- No pre-training or chain-of-thought data required
- Executes sequential reasoning in a single forward pass
- Outperforms much larger models on the ARC (Abstraction and Reasoning Corpus) benchmark
- Near-perfect performance on complex Sudoku and pathfinding tasks

## Architecture Details

- Recurrent neural network with computational depth
- Stable training despite computational complexity
- Efficient inference without token-based generation overhead
- Brain-inspired multi-timescale processing

## Getting Started

The repo includes quick-start guides for Sudoku solving and full experiments with dataset preparation for ARC, Sudoku, and Maze benchmarks. Trained checkpoints are available on Hugging Face for easy evaluation.

## Links

- [GitHub Repository](https://github.com/sapientinc/HRM)
- [arXiv Paper](https://arxiv.org/abs/2506.21734)
- [Original Tweet](https://x.com/heyshrutimishra/status/1951298602476966394)
- [Discord Community](https://discord.gg/sapient)
