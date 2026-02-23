---
title: nanochat
author: karpathy
url: https://github.com/karpathy/nanochat
language: Python
stars: 39663
topics: []
---

# nanochat

The best ChatGPT that $100 can buy.

This repo is a full-stack implementation of an LLM like ChatGPT in a single, clean, minimal, hackable, dependency-lite codebase. nanochat is designed to run on a single 8XH100 node via scripts like speedrun.sh, that run the entire pipeline start to end. This includes tokenization, pretraining, finetuning, evaluation, inference, and web serving over a simple UI so that you can talk to your own LLM just like ChatGPT. nanochat will become the capstone project of the course LLM101n being developed by Eureka Labs.

## Quick Start

The fastest way to feel the magic is to run the speedrun script speedrun.sh, which trains and inferences the $100 tier of nanochat. On an 8XH100 node at $24/hr, this gives a total run time of about 4 hours. Boot up a new 8XH100 GPU box from your favorite provider (e.g. I use and like Lambda), and kick off the training script:

```bash
bash speedrun.sh
```

## Key Features

- Full-stack LLM implementation in a single codebase
- Runs on single 8XH100 node
- Complete pipeline: tokenization, pretraining, finetuning, evaluation, inference
- Web UI similar to ChatGPT
- Minimal dependencies
- Hackable and customizable

## Model Versions

- **nanochat d34**: 2.2 billion parameters, 88 billion tokens training, ~$2,500 training cost
- Outperforms GPT-2 (2019) but falls short of modern LLMs
- Available for testing at nanochat.karpathy.ai

## Architecture

The model uses an end-to-end neural network approach for full customization and training transparency. All components are configurable and designed to be understood and modified by users.
