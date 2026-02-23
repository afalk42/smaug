/**
 * Archive directory utilities for per-day bookmark files.
 *
 * Directory structure:
 *   bookmarks/
 *     2025/
 *       02/
 *         2025-02-15_bm.md
 *     2026/
 *       02/
 *         2026-02-20_bm.md
 */

import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(customParseFormat);

/**
 * Parse a formatted date string like "Friday, February 20, 2026" into a dayjs object.
 */
export function parseDateHeader(dateStr) {
  // Strip weekday prefix: "Friday, February 20, 2026" -> "February 20, 2026"
  const withoutWeekday = dateStr.replace(/^\w+,\s*/, '');
  return dayjs(withoutWeekday, 'MMMM D, YYYY');
}

/**
 * Compute the day file path from a formatted date string.
 * "Friday, February 20, 2026" -> {archiveDir}/2026/02/2026-02-20_bm.md
 */
export function getDayFilePath(archiveDir, dateStr) {
  const d = parseDateHeader(dateStr);
  if (!d.isValid()) {
    throw new Error(`Cannot parse date: "${dateStr}"`);
  }
  const year = d.format('YYYY');
  const month = d.format('MM');
  const dayFile = `${d.format('YYYY-MM-DD')}_bm.md`;
  return path.join(archiveDir, year, month, dayFile);
}

/**
 * Ensure the parent directory for a day file exists.
 */
export function ensureDayFileDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Recursively scan archive directory for tweet IDs across all day files.
 * Returns a Set of tweet ID strings.
 */
export function getExistingBookmarkIds(archiveDir) {
  const ids = new Set();
  if (!fs.existsSync(archiveDir)) return ids;

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('_bm.md')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const matches = content.matchAll(/x\.com\/\w+\/status\/(\d+)/g);
        for (const m of matches) {
          ids.add(m[1]);
        }
      }
    }
  };

  walk(archiveDir);
  return ids;
}

/**
 * Count total `## @` bookmark entries across all day files.
 */
export function countArchivedBookmarks(archiveDir) {
  let count = 0;
  if (!fs.existsSync(archiveDir)) return count;

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('_bm.md')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const matches = content.match(/^## @/gm);
        if (matches) count += matches.length;
      }
    }
  };

  walk(archiveDir);
  return count;
}
