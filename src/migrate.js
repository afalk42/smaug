/**
 * Migration script: bookmarks.md -> per-day directory structure
 *
 * Parses the monolithic bookmarks.md by date sections and writes
 * each section to bookmarks/{YYYY}/{MM}/{YYYY-MM-DD}_bm.md
 */

import fs from 'fs';
import path from 'path';
import { loadConfig } from './config.js';
import { getDayFilePath, ensureDayFileDir } from './archive.js';

/**
 * Migrate a single-file bookmarks archive to per-day directory structure.
 */
export function migrate(options = {}) {
  const config = loadConfig(options.configPath);

  // Determine source file
  const sourceFile = config.archiveFile || './bookmarks.md';
  if (!fs.existsSync(sourceFile)) {
    console.error(`No archive file found at ${sourceFile}`);
    console.error('Nothing to migrate.');
    return { success: false, filesCreated: 0 };
  }

  const archiveDir = config.archiveDir || './bookmarks';

  console.log(`Migrating ${sourceFile} -> ${archiveDir}/\n`);

  const content = fs.readFileSync(sourceFile, 'utf8');

  // Split on date headers: # Weekday, Month Day, Year
  const dateHeaderRegex = /^# (\w+, \w+ \d+, \d{4})$/gm;
  const sections = [];
  let match;
  const headerPositions = [];

  while ((match = dateHeaderRegex.exec(content)) !== null) {
    headerPositions.push({
      dateStr: match[1],
      headerLine: match[0],
      index: match.index
    });
  }

  if (headerPositions.length === 0) {
    console.error('No date sections found in archive file.');
    return { success: false, filesCreated: 0 };
  }

  // Extract content between headers
  for (let i = 0; i < headerPositions.length; i++) {
    const start = headerPositions[i].index;
    const end = i + 1 < headerPositions.length
      ? headerPositions[i + 1].index
      : content.length;

    let sectionContent = content.slice(start, end);

    // Strip trailing --- separator between date sections
    sectionContent = sectionContent.replace(/\n---\s*$/, '');

    // Also strip any trailing whitespace
    sectionContent = sectionContent.trimEnd();

    sections.push({
      dateStr: headerPositions[i].dateStr,
      content: sectionContent
    });
  }

  console.log(`Found ${sections.length} date sections\n`);

  let filesCreated = 0;
  let entriesTotal = 0;

  for (const section of sections) {
    try {
      const filePath = getDayFilePath(archiveDir, section.dateStr);
      ensureDayFileDir(filePath);

      // Count entries in this section
      const entryCount = (section.content.match(/^## @/gm) || []).length;
      entriesTotal += entryCount;

      fs.writeFileSync(filePath, section.content + '\n');
      filesCreated++;

      const relPath = path.relative(process.cwd(), filePath);
      console.log(`  ${relPath}  (${entryCount} entries)`);
    } catch (err) {
      console.error(`  Error writing section "${section.dateStr}": ${err.message}`);
    }
  }

  // Rename original to .bak
  const bakFile = sourceFile.replace(/\.md$/, '.bak');
  fs.renameSync(sourceFile, bakFile);
  console.log(`\nRenamed ${sourceFile} -> ${bakFile}`);

  // Update smaug.config.json if it still references archiveFile
  const configPath = './smaug.config.json';
  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      const configJson = JSON.parse(configContent);
      if (configJson.archiveFile && !configJson.archiveDir) {
        delete configJson.archiveFile;
        configJson.archiveDir = archiveDir;
        // Rewrite preserving key order: put archiveDir near the top
        const ordered = {};
        for (const [key, value] of Object.entries(configJson)) {
          if (key === 'archiveDir') continue; // skip, we'll add it
          ordered[key] = value;
        }
        // Insert archiveDir as first key
        const final = { archiveDir: configJson.archiveDir, ...ordered };
        fs.writeFileSync(configPath, JSON.stringify(final, null, 2) + '\n');
        console.log(`Updated ${configPath}: archiveFile -> archiveDir`);
      }
    } catch (e) {
      console.warn(`Could not update config: ${e.message}`);
    }
  }

  console.log(`\nMigration complete!`);
  console.log(`  ${filesCreated} day files created`);
  console.log(`  ${entriesTotal} bookmark entries migrated`);

  return { success: true, filesCreated, entriesTotal };
}
