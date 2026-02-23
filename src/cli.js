#!/usr/bin/env node

/**
 * Smaug CLI
 *
 * Commands:
 *   setup    - Interactive setup wizard (recommended for first-time users)
 *   run      - Run the full job (fetch + process with Claude Code)
 *   fetch    - Fetch bookmarks and prepare them for processing
 *   process  - Process pending bookmarks with Claude Code
 *   status   - Show current configuration and status
 *   init     - Create a config file (non-interactive)
 */

import { fetchAndPrepareBookmarks } from './processor.js';
import { initConfig, loadConfig } from './config.js';
import { countArchivedBookmarks } from './archive.js';
import { migrate as runMigration } from './migrate.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath, pathToFileURL } from 'url';

const args = process.argv.slice(2);
const command = args[0];

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function setup() {
  console.log(`
🐉 Smaug Setup Wizard
━━━━━━━━━━━━━━━━━━━━━

This will set up Smaug to automatically archive your Twitter bookmarks.
`);

  // Step 1: Check for xurl CLI
  console.log('Step 1: Checking for xurl CLI...');
  try {
    const versionOutput = execSync('xurl version', { stdio: 'pipe', encoding: 'utf8' }).trim();
    console.log(`  ✓ xurl CLI ${versionOutput} found\n`);
  } catch {
    console.log(`  ✗ xurl CLI not found

  Install it:
    npm install -g @xdevplatform/xurl

  Then run this setup again.
`);
    process.exit(1);
  }

  // Step 2: Verify authentication
  console.log(`Step 2: Verifying X API authentication...

  xurl uses OAuth 2.0 (no cookies needed).
  If not yet authenticated, run: xurl auth default
`);

  try {
    const whoami = execSync('xurl whoami', { stdio: 'pipe', encoding: 'utf8' });
    const whoamiData = JSON.parse(whoami);
    const username = whoamiData.data?.username;
    console.log(`  ✓ Authenticated as @${username}\n`);
  } catch (error) {
    console.log(`  ✗ Not authenticated. Run 'xurl auth default' to set up OAuth 2.0.
  Error: ${error.message}
`);
    process.exit(1);
  }

  // Step 3: Test fetching bookmarks
  console.log('Step 3: Testing bookmark access...');
  try {
    const userId = JSON.parse(execSync('xurl whoami', { stdio: 'pipe', encoding: 'utf8' })).data.id;
    execSync(`xurl "/2/users/${userId}/bookmarks?max_results=1"`, { stdio: 'pipe', timeout: 30000 });
    console.log('  ✓ Bookmark access works!\n');
  } catch (error) {
    console.log(`  ✗ Could not fetch bookmarks. Check your xurl authentication.
  Error: ${error.message}
`);
    process.exit(1);
  }

  // Step 4: Create config
  console.log('Step 4: Creating configuration...');
  const config = {
    archiveDir: './bookmarks',
    pendingFile: './.state/pending-bookmarks.json',
    stateFile: './.state/bookmarks-state.json',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
    autoInvokeClaude: true,
    claudeModel: 'sonnet'
  };

  fs.writeFileSync('./smaug.config.json', JSON.stringify(config, null, 2) + '\n');
  console.log('  ✓ Created smaug.config.json\n');

  // Step 5: Ask about automation
  console.log('Step 5: Automation Setup\n');
  const wantsCron = await prompt('  Set up automatic fetching every 30 minutes? (y/n): ');

  if (wantsCron.toLowerCase() === 'y') {
    const cwd = process.cwd();
    const cronLine = `*/30 * * * * cd ${cwd} && npx smaug run >> ${cwd}/smaug.log 2>&1`;

    console.log(`
  Add this line to your crontab:

  ${cronLine}

  To edit your crontab, run:
    crontab -e

  Or use PM2 for a simpler setup:
    npm install -g pm2
    pm2 start "npx smaug run" --cron "*/30 * * * *" --name smaug
    pm2 save
`);
  }

  // Step 6: First fetch
  console.log('\nStep 6: Fetching your bookmarks...\n');

  try {
    const result = await fetchAndPrepareBookmarks({ count: 20 });

    if (result.count > 0) {
      console.log(`  ✓ Fetched ${result.count} bookmarks!\n`);
    } else {
      console.log('  ✓ No new bookmarks to fetch (your bookmark list may be empty)\n');
    }
  } catch (error) {
    console.log(`  Warning: Could not fetch bookmarks: ${error.message}\n`);
  }

  // Done!
  console.log(`
━━━━━━━━━━━━━━━━━━━━━
🐉 Setup Complete!
━━━━━━━━━━━━━━━━━━━━━

Your bookmarks will be saved to: ./bookmarks/

Commands:
  npx smaug run    Run full job (fetch + process with Claude)
  npx smaug fetch  Fetch new bookmarks
  npx smaug status Check status

Happy hoarding! 🐉
`);
}

async function main() {
  switch (command) {
    case 'setup':
      await setup();
      break;

    case 'init':
      initConfig(args[1]);
      break;

    case 'run': {
      // Run the full job (same as node src/job.js)
      const jobPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'job.js');
      const trackTokens = args.includes('--track-tokens') || args.includes('-t');

      // Parse --limit flag
      const limitIdx = args.findIndex(a => a === '--limit' || a === '-l');
      let limit = null;
      if (limitIdx !== -1 && args[limitIdx + 1]) {
        limit = parseInt(args[limitIdx + 1], 10);
        if (isNaN(limit) || limit <= 0) {
          console.error('Invalid --limit value. Must be a positive number.');
          process.exit(1);
        }
      }

      try {
        const jobModule = await import(pathToFileURL(jobPath).href);
        const result = await jobModule.default.run({ trackTokens, limit });
        process.exit(result.success ? 0 : 1);
      } catch (err) {
        console.error('Failed to run job:', err.message);
        process.exit(1);
      }
      break;
    }

    case 'fetch': {
      const count = parseInt(args.find(a => a.match(/^\d+$/)) || '20', 10);
      const specificIds = args.filter(a => a.match(/^\d{10,}$/));
      const force = args.includes('--force') || args.includes('-f');
      const includeMedia = args.includes('--media') || args.includes('-m');
      const fetchAll = args.includes('--all') || args.includes('-a') || args.includes('-all');

      // Parse --source flag
      const sourceIdx = args.findIndex(a => a === '--source' || a === '-s');
      let source = null;
      if (sourceIdx !== -1 && args[sourceIdx + 1]) {
        source = args[sourceIdx + 1];
        if (!['bookmarks', 'likes', 'both'].includes(source)) {
          console.error(`Invalid source: ${source}. Must be 'bookmarks', 'likes', or 'both'.`);
          process.exit(1);
        }
      }

      // Parse --max-pages flag
      const maxPagesIdx = args.findIndex(a => a === '--max-pages');
      let maxPages = null;
      if (maxPagesIdx !== -1 && args[maxPagesIdx + 1]) {
        maxPages = parseInt(args[maxPagesIdx + 1], 10);
      }

      const result = await fetchAndPrepareBookmarks({
        count,
        specificIds: specificIds.length > 0 ? specificIds : null,
        force,
        source,
        includeMedia,
        all: fetchAll,
        maxPages
      });

      if (result.count > 0) {
        console.log(`\n✓ Prepared ${result.count} tweets.`);
        console.log(`  Output: ${result.pendingFile}`);
        console.log('\nNext: Run `npx smaug run` to process with Claude');
      } else {
        console.log('\nNo new tweets to process.');
      }
      break;
    }

    case 'process': {
      const config = loadConfig();

      if (!fs.existsSync(config.pendingFile)) {
        console.log('No pending bookmarks. Run `smaug fetch` first.');
        process.exit(0);
      }

      const pending = JSON.parse(fs.readFileSync(config.pendingFile, 'utf8'));

      if (pending.bookmarks.length === 0) {
        console.log('No pending bookmarks to process.');
        process.exit(0);
      }

      console.log(`Found ${pending.bookmarks.length} pending bookmarks.\n`);
      console.log('To process them:');
      console.log('  npx smaug run\n');

      console.log('Pending:');
      for (const b of pending.bookmarks.slice(0, 5)) {
        console.log(`  • @${b.author}: ${b.text.slice(0, 50)}...`);
      }
      if (pending.bookmarks.length > 5) {
        console.log(`  ... and ${pending.bookmarks.length - 5} more`);
      }
      break;
    }

    case 'migrate': {
      const result = runMigration();
      process.exit(result.success ? 0 : 1);
      break;
    }

    case 'status': {
      const config = loadConfig();

      console.log('Smaug Status\n');

      // Show archive location
      if (config.archiveDir && fs.existsSync(config.archiveDir)) {
        console.log(`Archive:     ${config.archiveDir}/ (per-day files)`);
      } else if (fs.existsSync(config.archiveFile)) {
        console.log(`Archive:     ${config.archiveFile} (legacy single file)`);
        console.log(`             Run 'npx smaug migrate' to switch to per-day files`);
      } else {
        console.log(`Archive:     ${config.archiveDir || config.archiveFile} (not yet created)`);
      }

      console.log(`Source:      ${config.source || 'bookmarks'}`);
      console.log(`Media:       ${config.includeMedia ? '✓ enabled (experimental)' : 'disabled (use --media to enable)'}`);

      // Check xurl auth (hardcoded binary name, no user input)
      try {
        const whoami = execSync('xurl whoami', { stdio: 'pipe', encoding: 'utf8' });
        const whoamiData = JSON.parse(whoami);
        console.log(`Auth:        ✓ @${whoamiData.data?.username} (xurl OAuth 2.0)`);
      } catch {
        console.log('Auth:        ✗ not authenticated (run "xurl auth default")');
      }

      console.log(`Auto-Claude: ${config.autoInvokeClaude ? 'enabled' : 'disabled'}`);

      if (fs.existsSync(config.pendingFile)) {
        const pending = JSON.parse(fs.readFileSync(config.pendingFile, 'utf8'));
        console.log(`Pending:     ${pending.bookmarks.length} bookmarks`);
      } else {
        console.log('Pending:     0 bookmarks');
      }

      if (fs.existsSync(config.stateFile)) {
        const state = JSON.parse(fs.readFileSync(config.stateFile, 'utf8'));
        console.log(`Last fetch:  ${state.last_check || 'never'}`);
      }

      // Count archived bookmarks from directory or legacy file
      if (config.archiveDir && fs.existsSync(config.archiveDir)) {
        const entryCount = countArchivedBookmarks(config.archiveDir);
        console.log(`Archived:    ${entryCount} bookmarks`);
      } else if (fs.existsSync(config.archiveFile)) {
        const content = fs.readFileSync(config.archiveFile, 'utf8');
        const entryCount = (content.match(/^## @/gm) || []).length;
        console.log(`Archived:    ${entryCount} bookmarks`);
      }
      break;
    }

    case 'help':
    case '--help':
    case '-h':
    default:
      console.log(`
🐉 Smaug - Twitter Bookmarks & Likes Archiver

Commands:
  setup          Interactive setup wizard (start here!)
  run            Run the full job (fetch + process with Claude)
  run -t         Run with token usage tracking (--track-tokens)
  run --limit N  Process only N bookmarks (for large backlogs)
  fetch [n]      Fetch n tweets (default: 20)
  fetch --all    Fetch ALL bookmarks (paginated)
  fetch --max-pages N  Limit pagination to N pages (default: 10)
  fetch --force  Re-fetch even if already archived
  fetch --source <source>  Fetch from: bookmarks, likes, or both
  fetch --media  EXPERIMENTAL: Include media attachments
  migrate        Migrate bookmarks.md to per-day directory structure
  process        Show pending tweets
  status         Show current status

Examples:
  smaug setup                    # First-time setup
  smaug run                      # Run full automation
  smaug run --limit 50           # Process 50 bookmarks at a time
  smaug fetch                    # Fetch latest (uses config source)
  smaug fetch 50                 # Fetch 50 tweets
  smaug fetch --all              # Fetch ALL bookmarks (paginated)
  smaug fetch --all --max-pages 5  # Fetch up to 5 pages
  smaug fetch --source likes     # Fetch from likes only
  smaug fetch --source both      # Fetch from bookmarks AND likes
  smaug fetch --media            # Include photos/videos/GIFs (experimental)
  smaug fetch --force            # Re-process archived tweets

Config (smaug.config.json):
  "source": "bookmarks"    Default source (bookmarks, likes, or both)
  "includeMedia": false    EXPERIMENTAL: Include media (default: off)

More info: https://github.com/alexknowshtml/smaug
`);
      break;
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
