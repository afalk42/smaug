---
title: OpenAI Adopts Anthropic's Skills Mechanism
author: Simon Willison
source: https://simonwillison.net/2025/Dec/12/openai-skills/
date: 2025-12-12
tags:
  - AI
  - LLMs
  - Skills
  - OpenAI
  - Anthropic
---

# OpenAI Are Quietly Adopting Skills

OpenAI has quietly implemented skills support in both ChatGPT and their Codex CLI tool, adopting an approach similar to Anthropic's skills mechanism introduced in October 2025.

## Skills in ChatGPT

Skills are now accessible in ChatGPT's Code Interpreter through a new `/home/oai/skills` folder. Currently, OpenAI provides skills for:

- Spreadsheet handling
- DOCX document processing
- PDF reading, creation, and review

### PDF Skills Implementation

OpenAI's approach to PDF handling involves converting pages to rendered PNG images and passing them through vision-enabled models. This preserves layout and graphical information that would be lost with text extraction alone.

Key guidelines for PDF work:
- Use `pdftoppm -png` to convert PDFs to images
- Use `pdfplumber` as a complementary tool for text extraction
- Render PDFs after each meaningful change to inspect layout
- Maintain polished visual design with consistent typography, spacing, and color
- Ensure charts, tables, and diagrams are sharp and well-aligned
- Support unicode properly (avoiding non-breaking hyphens that render poorly)

## Comparison with Anthropic Skills

OpenAI's implementation is very similar to Anthropic's skills system. Both use:
- Markdown files defining skill behavior
- Optional scripts and resources
- Filesystem navigation and reading capabilities

The architecture allows any LLM tool with filesystem access to implement similar functionality.

## Real-World Example

Simon Willison tested this by prompting ChatGPT to create a PDF about Kākāpō breeding season and rimu mast status. The system:
1. Automatically referenced the PDF skill documentation
2. Conducted web research on current conditions
3. Created a polished, multi-page PDF with proper font support for Māori diacritics
4. Iteratively rendered and inspected its work to ensure quality

The PDF was properly formatted with consistent typography, clear sections, and accurate information.
