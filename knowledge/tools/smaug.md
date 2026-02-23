---
title: Smaug
author: alexknowshtml
url: https://github.com/alexknowshtml/smaug
stars: 391
language: JavaScript
type: tool
archived: false
---

# Smaug 🐉

Archive your Twitter/X bookmarks (and/or optionally, likes) to markdown. Automatically.

*Like a dragon hoarding treasure, Smaug collects the valuable things you bookmark and like.*

## Contents

- [Quick Start](#quick-start-5-minutes)
- [Getting Twitter Credentials](#getting-twitter-credentials)
- [What It Does](#what-it-does)
- [Running](#running)
- [Categories](#categories)
- [Automation](#automation)
- [Output](#output)
- [Configuration](#configuration)
- [Claude Code Integration](#claude-code-integration)
- [Troubleshooting](#troubleshooting)
- [Credits](#credits)

```
  🔥  🔥  🔥  🔥  🔥  🔥  🔥  🔥  🔥  🔥  🔥  🔥
       _____ __  __   _   _   _  ____
      / ____|  \/  | / \ | | | |/ ___|
      \___ \| |\/| |/ _ \| | | | |  _
       ___) | |  | / ___ \ |_| | |_| |
      |____/|_|  |_/_/  \_\___/ \____/

   🐉 The dragon stirs... treasures to hoard!
```

## Quick Start (5 minutes)

```bash
# 1. Install bird CLI (Twitter API wrapper)
# See https://github.com/steipete/bird for installation

# 2. Clone and install Smaug
git clone https://github.com/alexknowshtml/smaug
cd smaug
npm install

# 3. Run the setup wizard
npx smaug setup

# 4. Run the full job (fetch + process with Claude)
npx smaug run
```

The setup wizard will:
- Create required directories
- Guide you through getting Twitter credentials
- Create your config file

## Manually Getting Twitter Credentials

Smaug uses the bird CLI which needs your Twitter session cookies.

If you don't want to use the wizard to make it easy, you can manually put your session info into the config.

1. Open Twitter/X in your browser
2. Open Developer Tools → Application → Cookies
3. Find and copy these values:
   - `auth_token`
   - `ct0`
4. Add them to `smaug.config.json`:

```json
{
  "twitter": {
    "authToken": "your_auth_token_here",
    "ct0": "your_ct0_here"
  }
}
```

## What Smaug Actually Does

1. **Fetches bookmarks** from Twitter/X using the bird CLI (can also fetch likes, or both)
2. **Expands t.co links** to reveal actual URLs
3. **Extracts content** from linked pages (GitHub repos, articles, quote tweets)
4. **Invokes Claude Code** to analyze and categorize each tweet
5. **Saves to markdown** organized by date with rich context
6. **Files to knowledge library** - GitHub repos to `knowledge/tools/`, articles to `knowledge/articles/`

## Running Manually

```bash
# Full job (fetch + process with Claude)
npx smaug run

# Fetch from bookmarks (default)
npx smaug fetch 20

# Fetch from likes instead
npx smaug fetch --source likes

# Fetch from both bookmarks AND likes
npx smaug fetch --source both

# Process already-fetched tweets
npx smaug process

# Force re-process (ignore duplicates)
npx smaug process --force

# Check what's pending
cat .state/pending-bookmarks.json | jq '.count'
```

## Categories

Categories define how different bookmark types are handled. Smaug comes with sensible defaults, but you can customize them in `smaug.config.json`.

### Default Categories

| Category | Matches | Action | Destination |
|----------|---------|--------|-------------|
| **article** | blogs, news sites, papers, medium.com, substack, etc | file | `./knowledge/articles/` |
| **github** | github.com | file | `./knowledge/tools/` |
| **tweet** | (fallback) | capture | bookmarks.md only |

🔜 *Note: Transcription coming soon for podcasts, videos, etc but feel free to edit your own and submit back suggestions!*

### Actions

- **file**: Create a separate markdown file with rich metadata
- **capture**: Add to bookmarks.md only (no separate file)
- **transcribe**: Flag for future transcription *(auto-transcription coming soon! PRs welcome)*

### Custom Categories

Add your own categories in `smaug.config.json`:

```json
{
  "categories": {
    "research": {
      "match": ["arxiv.org", "papers.", "scholar.google"],
      "action": "file",
      "folder": "./knowledge/research",
      "template": "article",
      "description": "Academic papers"
    },
    "newsletter": {
      "match": ["buttondown.email", "beehiiv.com"],
      "action": "file",
      "folder": "./knowledge/newsletters",
      "template": "article",
      "description": "Newsletter issues"
    }
  }
}
```

Your custom categories merge with the defaults. To override a default, use the same key (e.g., `github`, `article`).

## Automation

Run Smaug automatically every 30 minutes:

### Option A: PM2 (recommended)

```bash
npm install -g pm2
pm2 start "npx smaug run" --cron "*/30 * * * *" --name smaug
pm2 save
pm2 startup    # Start on boot
```

### Option B: Cron

```bash
crontab -e
# Add:
*/30 * * * * cd /path/to/smaug && npx smaug run >> smaug.log 2>&1
```

### Option C: systemd

```bash
# Create /etc/systemd/system/smaug.service
# See docs/systemd-setup.md for details
```
