/**
 * Bookmark Processor - Fetches and prepares Twitter bookmarks for analysis
 *
 * This handles the mechanical work:
 * - Fetching bookmarks via xurl CLI (X API v2)
 * - Expanding t.co links (pre-expanded from API entities, with curl fallback)
 * - Extracting content from linked pages (articles, GitHub repos)
 * - Optional: Bypassing paywalls via archive.ph
 *
 * Outputs a JSON bundle for AI analysis (Claude Code, etc.)
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { loadConfig } from './config.js';

dayjs.extend(utc);
dayjs.extend(timezone);

// Sites that typically require paywall bypass
const PAYWALL_DOMAINS = [
  'nytimes.com',
  'wsj.com',
  'washingtonpost.com',
  'theatlantic.com',
  'newyorker.com',
  'bloomberg.com',
  'ft.com',
  'economist.com',
  'bostonglobe.com',
  'latimes.com',
  'wired.com'
];

// Standard tweet fields and expansions for xurl API v2 requests
const XURL_TWEET_FIELDS = 'created_at,entities,referenced_tweets,conversation_id,in_reply_to_user_id,attachments';
const XURL_EXPANSIONS = 'author_id,referenced_tweets.id,referenced_tweets.id.author_id,attachments.media_keys';
const XURL_USER_FIELDS = 'username,name';
const XURL_MEDIA_FIELDS = 'url,preview_image_url,type,width,height,duration_ms,variants';

function buildXurlQueryParams() {
  return `tweet.fields=${XURL_TWEET_FIELDS}&expansions=${XURL_EXPANSIONS}&user.fields=${XURL_USER_FIELDS}&media.fields=${XURL_MEDIA_FIELDS}`;
}

// Cache authenticated user ID per session
let _cachedUserId = null;

export function getAuthenticatedUserId(config) {
  if (_cachedUserId) return _cachedUserId;

  const xurlCmd = config.xurlPath || 'xurl';
  try {
    const output = execSync(`${xurlCmd} whoami`, {
      encoding: 'utf8',
      timeout: 15000
    });
    const data = JSON.parse(output);
    _cachedUserId = data.data?.id;
    if (!_cachedUserId) {
      throw new Error('Could not determine user ID from xurl whoami');
    }
    return _cachedUserId;
  } catch (error) {
    throw new Error(`Failed to get authenticated user ID: ${error.message}`);
  }
}

/**
 * Normalize X API v2 response format to flat tweet objects matching the
 * shape expected by fetchAndPrepareBookmarks:
 *   { id, text, createdAt, author: { username, name }, inReplyToStatusId, quotedTweet, media, _expandedUrls }
 */
export function normalizeXurlResponse(apiResponse) {
  const data = apiResponse.data;
  if (!data) return [];

  const tweets = Array.isArray(data) ? data : [data];
  const includes = apiResponse.includes || {};

  // Build lookup maps
  const usersById = {};
  for (const user of (includes.users || [])) {
    usersById[user.id] = user;
  }

  const tweetsById = {};
  for (const tweet of (includes.tweets || [])) {
    tweetsById[tweet.id] = tweet;
  }

  const mediaByKey = {};
  for (const m of (includes.media || [])) {
    mediaByKey[m.media_key] = m;
  }

  return tweets.map(tweet => {
    const author = usersById[tweet.author_id] || { username: 'unknown', name: 'unknown' };

    // Build expanded URLs map from entities
    const expandedUrls = {};
    if (tweet.entities?.urls) {
      for (const urlEntity of tweet.entities.urls) {
        // Prefer unwound_url (fully resolved), fall back to expanded_url
        const resolved = urlEntity.unwound_url || urlEntity.expanded_url;
        if (urlEntity.url && resolved) {
          expandedUrls[urlEntity.url] = resolved;
        }
      }
    }

    // Detect reply
    let inReplyToStatusId = null;
    if (tweet.referenced_tweets) {
      const repliedTo = tweet.referenced_tweets.find(r => r.type === 'replied_to');
      if (repliedTo) {
        inReplyToStatusId = repliedTo.id;
      }
    }

    // Detect quote tweet
    let quotedTweet = null;
    if (tweet.referenced_tweets) {
      const quoted = tweet.referenced_tweets.find(r => r.type === 'quoted');
      if (quoted && tweetsById[quoted.id]) {
        const qt = tweetsById[quoted.id];
        const qtAuthor = usersById[qt.author_id] || { username: 'unknown', name: 'unknown' };
        quotedTweet = {
          id: qt.id,
          text: qt.text,
          createdAt: qt.created_at,
          author: { username: qtAuthor.username, name: qtAuthor.name }
        };
      }
    }

    // Extract media from attachments
    const media = [];
    if (tweet.attachments?.media_keys) {
      for (const key of tweet.attachments.media_keys) {
        const m = mediaByKey[key];
        if (m) {
          const mediaItem = {
            type: m.type, // photo, video, animated_gif
            url: m.url || m.preview_image_url,
            previewUrl: m.preview_image_url,
            width: m.width,
            height: m.height
          };
          if (m.type === 'video' || m.type === 'animated_gif') {
            mediaItem.durationMs = m.duration_ms;
            // Find best video variant
            if (m.variants) {
              const mp4Variants = m.variants
                .filter(v => v.content_type === 'video/mp4')
                .sort((a, b) => (b.bit_rate || 0) - (a.bit_rate || 0));
              if (mp4Variants.length > 0) {
                mediaItem.videoUrl = mp4Variants[0].url;
              }
            }
          }
          media.push(mediaItem);
        }
      }
    }

    return {
      id: tweet.id,
      text: tweet.text,
      createdAt: tweet.created_at,
      author: { username: author.username, name: author.name },
      inReplyToStatusId,
      quotedTweet,
      media,
      _expandedUrls: expandedUrls
    };
  });
}

export function loadState(config) {
  try {
    const content = fs.readFileSync(config.stateFile, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return {
      last_processed_id: null,
      last_check: null,
      last_processing_run: null
    };
  }
}

export function saveState(config, state) {
  const dir = path.dirname(config.stateFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(config.stateFile, JSON.stringify(state, null, 2) + '\n');
}

/**
 * Fetch pages of results from an xurl endpoint, handling pagination via next_token
 */
function fetchAllPages(config, endpoint, maxPages = 10) {
  const xurlCmd = config.xurlPath || 'xurl';
  const allTweets = [];
  let nextToken = null;
  let page = 0;

  while (page < maxPages) {
    page++;
    let url = endpoint;
    if (nextToken) {
      url += (url.includes('?') ? '&' : '?') + `pagination_token=${nextToken}`;
    }

    console.log(`  Page ${page}${nextToken ? ' (continuing)' : ''}...`);

    try {
      const output = execSync(`${xurlCmd} "${url}"`, {
        encoding: 'utf8',
        timeout: 60000
      });
      const response = JSON.parse(output);

      if (!response.data || response.data.length === 0) {
        break;
      }

      const normalized = normalizeXurlResponse(response);
      allTweets.push(...normalized);

      // Check for next page
      nextToken = response.meta?.next_token;
      if (!nextToken) {
        break;
      }
    } catch (error) {
      console.error(`  Error fetching page ${page}: ${error.message}`);
      break;
    }
  }

  return allTweets;
}

export function fetchBookmarks(config, count = 10, options = {}) {
  try {
    const xurlCmd = config.xurlPath || 'xurl';
    const userId = getAuthenticatedUserId(config);
    const fields = buildXurlQueryParams();

    const useAll = options.all || count > 50;
    const maxResults = useAll ? 100 : Math.min(count, 100);
    const endpoint = `/2/users/${userId}/bookmarks?max_results=${maxResults}&${fields}`;

    if (useAll) {
      const maxPages = options.maxPages || 10;
      console.log(`  Running: xurl bookmarks (paginated, max ${maxPages} pages)`);
      return fetchAllPages(config, endpoint, maxPages);
    }

    console.log(`  Running: xurl bookmarks (${maxResults} results)`);
    const output = execSync(`${xurlCmd} "${endpoint}"`, {
      encoding: 'utf8',
      timeout: 60000
    });
    const response = JSON.parse(output);
    return normalizeXurlResponse(response);
  } catch (error) {
    throw new Error(`Failed to fetch bookmarks: ${error.message}`);
  }
}

export function fetchLikes(config, count = 10) {
  try {
    const xurlCmd = config.xurlPath || 'xurl';
    const userId = getAuthenticatedUserId(config);
    const fields = buildXurlQueryParams();

    // X API v2 liked_tweets: min 5, max 100
    const maxResults = Math.max(5, Math.min(count, 100));
    const endpoint = `/2/users/${userId}/liked_tweets?max_results=${maxResults}&${fields}`;

    console.log(`  Running: xurl liked_tweets (${maxResults} results)`);
    const output = execSync(`${xurlCmd} "${endpoint}"`, {
      encoding: 'utf8',
      timeout: 60000
    });
    const response = JSON.parse(output);
    return normalizeXurlResponse(response);
  } catch (error) {
    throw new Error(`Failed to fetch likes: ${error.message}`);
  }
}

export function fetchFromSource(config, count = 10, options = {}) {
  const source = config.source || 'bookmarks';

  if (source === 'bookmarks') {
    return fetchBookmarks(config, count, options);
  } else if (source === 'likes') {
    return fetchLikes(config, count);
  } else if (source === 'both') {
    const bookmarks = fetchBookmarks(config, count, options);
    const likes = fetchLikes(config, count);
    // Merge and dedupe by ID
    const seen = new Set();
    const merged = [];
    for (const item of [...bookmarks, ...likes]) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        merged.push(item);
      }
    }
    return merged;
  } else {
    throw new Error(`Invalid source: ${source}. Must be 'bookmarks', 'likes', or 'both'.`);
  }
}

/**
 * Fetch bookmarks from configured folders, tagging each with its folder name.
 * NOTE: X API v2 does not expose bookmark folders. This falls back to fetching
 * all bookmarks without folder-specific tagging.
 */
export function fetchFromFolders(config, count = 10, options = {}) {
  const folders = config.folders || {};
  const folderIds = Object.keys(folders);

  if (folderIds.length === 0) {
    return [];
  }

  console.log(`\n  Warning: X API v2 does not support bookmark folders.`);
  console.log(`  Fetching all bookmarks instead (${folderIds.length} folder config(s) retained for reference).`);
  console.log(`  Folder-specific tags will not be applied.\n`);

  return fetchBookmarks(config, count, options);
}

export function fetchTweet(config, tweetId) {
  try {
    const xurlCmd = config.xurlPath || 'xurl';
    const fields = buildXurlQueryParams();
    const endpoint = `/2/tweets/${tweetId}?${fields}`;

    const output = execSync(`${xurlCmd} "${endpoint}"`, {
      encoding: 'utf8',
      timeout: 15000
    });
    const response = JSON.parse(output);

    // Single tweet: data is an object, not array
    const normalized = normalizeXurlResponse(response);
    return normalized[0] || null;
  } catch (error) {
    console.log(`  Could not fetch parent tweet ${tweetId}: ${error.message}`);
    return null;
  }
}

export function expandTcoLink(url, timeout = 10000) {
  try {
    const result = execSync(
      `curl -Ls -o /dev/null -w '%{url_effective}' '${url}'`,
      { encoding: 'utf8', timeout }
    );
    return result.trim();
  } catch (error) {
    console.error(`Failed to expand ${url}: ${error.message}`);
    return url;
  }
}

export function isPaywalled(url) {
  return PAYWALL_DOMAINS.some(domain => url.includes(domain));
}

export function stripQuerystring(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function extractGitHubInfo(url) {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

export async function fetchGitHubContent(url) {
  const info = extractGitHubInfo(url);
  if (!info) {
    throw new Error('Could not parse GitHub URL');
  }

  const { owner, repo } = info;

  try {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
    const repoData = execSync(
      `curl -sL -H "Accept: application/vnd.github.v3+json" "${apiUrl}"`,
      { encoding: 'utf8', timeout: 15000 }
    );
    const repoJson = JSON.parse(repoData);

    // Fetch README content
    let readme = '';
    try {
      const readmeUrl = `https://api.github.com/repos/${owner}/${repo}/readme`;
      const readmeData = execSync(
        `curl -sL -H "Accept: application/vnd.github.v3+json" "${readmeUrl}"`,
        { encoding: 'utf8', timeout: 15000 }
      );
      const readmeJson = JSON.parse(readmeData);
      if (readmeJson.content) {
        readme = Buffer.from(readmeJson.content, 'base64').toString('utf8');
        if (readme.length > 5000) {
          readme = readme.slice(0, 5000) + '\n...[truncated]';
        }
      }
    } catch (e) {
      console.log(`  No README found for ${owner}/${repo}`);
    }

    return {
      name: repoJson.name,
      fullName: repoJson.full_name,
      description: repoJson.description || '',
      stars: repoJson.stargazers_count,
      language: repoJson.language,
      topics: repoJson.topics || [],
      readme,
      url: repoJson.html_url
    };
  } catch (error) {
    console.error(`  GitHub API error for ${owner}/${repo}: ${error.message}`);
    throw error;
  }
}

export async function fetchArticleContent(url) {
  try {
    const result = execSync(
      `curl -sL -m 30 -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" "${url}" | head -c 50000`,
      { encoding: 'utf8', timeout: 35000 }
    );

    // Check for paywall indicators
    if (result.includes('Subscribe') && result.includes('sign in') ||
        result.includes('This article is for subscribers') ||
        result.length < 1000) {
      return { text: result, source: 'direct', paywalled: true };
    }

    return { text: result, source: 'direct', paywalled: false };
  } catch (error) {
    throw error;
  }
}

export async function fetchContent(url, type, config) {
  // Use GitHub API for GitHub URLs
  if (type === 'github') {
    try {
      const ghContent = await fetchGitHubContent(url);
      return { ...ghContent, source: 'github-api' };
    } catch (error) {
      console.log(`  GitHub API failed: ${error.message}`);
    }
  }

  // For paywalled sites, note for manual handling or custom bypass
  if (isPaywalled(url)) {
    console.log(`  Paywalled domain detected: ${url}`);
    return {
      url,
      source: 'paywalled',
      note: 'Content requires paywall bypass - see README for options'
    };
  }

  // Try direct fetch for other URLs
  return await fetchArticleContent(url);
}

export function getExistingBookmarkIds(config) {
  try {
    const content = fs.readFileSync(config.archiveFile, 'utf8');
    const matches = content.matchAll(/x\.com\/\w+\/status\/(\d+)/g);
    return new Set([...matches].map(m => m[1]));
  } catch {
    return new Set();
  }
}

export async function fetchAndPrepareBookmarks(options = {}) {
  const config = loadConfig(options.configPath);
  const now = dayjs().tz(config.timezone || 'America/New_York');
  console.log(`[${now.format()}] Fetching and preparing bookmarks...`);

  const state = loadState(config);
  const source = options.source || config.source || 'bookmarks';
  const includeMedia = options.includeMedia ?? config.includeMedia ?? false;
  const configWithOptions = { ...config, source, includeMedia };
  const count = options.count || 20;

  // Build fetch options for pagination
  const fetchOptions = {
    all: options.all || count > 50,
    maxPages: options.maxPages
  };

  let tweets = [];
  const hasFolders = Object.keys(config.folders || {}).length > 0;

  if (hasFolders && source === 'bookmarks') {
    // X API v2 doesn't support folder-specific fetching; fetchFromFolders warns and falls back
    console.log(`Fetching from ${Object.keys(config.folders).length} folder(s)${includeMedia ? ' (with media)' : ''}`);
    tweets = fetchFromFolders(configWithOptions, count, fetchOptions);
  } else {
    // Normal fetch from source
    console.log(`Fetching from source: ${source}${includeMedia ? ' (with media)' : ''}${fetchOptions.all ? ' (paginated)' : ''}`);
    tweets = fetchFromSource(configWithOptions, count, fetchOptions);
  }

  if (!tweets || tweets.length === 0) {
    console.log(`No ${source} found`);
    return { bookmarks: [], count: 0 };
  }

  // Get IDs already processed or pending
  const existingIds = getExistingBookmarkIds(config);
  let pendingIds = new Set();
  try {
    if (fs.existsSync(config.pendingFile)) {
      const pending = JSON.parse(fs.readFileSync(config.pendingFile, 'utf8'));
      pendingIds = new Set((pending.bookmarks || []).map(b => b.id.toString()));
    }
  } catch (e) {}

  // Determine which tweets to process
  let toProcess;
  if (options.specificIds) {
    toProcess = tweets.filter(b => options.specificIds.includes(b.id.toString()));
  } else if (options.force) {
    // Force mode: skip duplicate checking, process all fetched tweets
    toProcess = tweets;
  } else {
    toProcess = tweets.filter(b => {
      const id = b.id.toString();
      return !existingIds.has(id) && !pendingIds.has(id);
    });
  }

  if (toProcess.length === 0) {
    console.log('No new tweets to process');
    return { bookmarks: [], count: 0 };
  }

  console.log(`Preparing ${toProcess.length} tweets...`);

  const prepared = [];

  for (const bookmark of toProcess) {
    try {
      console.log(`\nProcessing bookmark ${bookmark.id}...`);
      const text = bookmark.text || '';

      // Format date from tweet's createdAt, falling back to current date
      let date;
      if (bookmark.createdAt) {
        const tweetDate = dayjs(bookmark.createdAt).tz(config.timezone || 'America/New_York');
        date = tweetDate.format('dddd, MMMM D, YYYY');
      } else {
        date = now.format('dddd, MMMM D, YYYY');
      }
      const author = bookmark.author?.username || 'unknown';

      // Find and expand t.co links
      // Use pre-expanded URLs from API entities where available
      const tcoLinks = text.match(/https?:\/\/t\.co\/\w+/g) || [];
      const links = [];

      for (const link of tcoLinks) {
        // Use pre-expanded URL from API entities, fall back to curl
        let expanded;
        if (bookmark._expandedUrls && bookmark._expandedUrls[link]) {
          expanded = bookmark._expandedUrls[link];
          console.log(`  Pre-expanded: ${link} -> ${expanded}`);
        } else {
          expanded = expandTcoLink(link);
          console.log(`  Curl-expanded: ${link} -> ${expanded}`);
        }

        // Categorize the link
        let type = 'unknown';
        let content = null;

        if (expanded.includes('github.com')) {
          type = 'github';
        } else if (expanded.includes('youtube.com') || expanded.includes('youtu.be')) {
          type = 'video';
        } else if (expanded.includes('x.com') || expanded.includes('twitter.com')) {
          if (expanded.includes('/photo/') || expanded.includes('/video/')) {
            type = 'media';
          } else {
            type = 'tweet';
            // Quote tweet - fetch the quoted tweet for context
            const tweetIdMatch = expanded.match(/status\/(\d+)/);
            if (tweetIdMatch) {
              const quotedTweetId = tweetIdMatch[1];
              console.log(`  Quote tweet detected, fetching ${quotedTweetId}...`);
              const quotedTweet = fetchTweet(config, quotedTweetId);
              if (quotedTweet) {
                content = {
                  id: quotedTweet.id,
                  author: quotedTweet.author?.username || 'unknown',
                  authorName: quotedTweet.author?.name || quotedTweet.author?.username || 'unknown',
                  text: quotedTweet.text || '',
                  tweetUrl: `https://x.com/${quotedTweet.author?.username || 'unknown'}/status/${quotedTweet.id}`,
                  source: 'quote-tweet'
                };
              }
            }
          }
        } else if (expanded.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          type = 'image';
        } else {
          type = 'article';
        }

        // Fetch content for articles and GitHub repos
        if (type === 'article' || type === 'github') {
          try {
            const fetchResult = await fetchContent(expanded, type, config);

            if (fetchResult.source === 'github-api') {
              content = {
                name: fetchResult.name,
                fullName: fetchResult.fullName,
                description: fetchResult.description,
                stars: fetchResult.stars,
                language: fetchResult.language,
                topics: fetchResult.topics,
                readme: fetchResult.readme,
                url: fetchResult.url,
                source: 'github-api'
              };
              console.log(`  GitHub repo: ${fetchResult.fullName} (${fetchResult.stars} stars)`);
            } else {
              content = {
                text: fetchResult.text?.slice(0, 10000),
                source: fetchResult.source,
                paywalled: fetchResult.paywalled
              };
            }
          } catch (error) {
            console.log(`  Could not fetch content: ${error.message}`);
            content = { error: error.message };
          }
        }

        links.push({
          original: link,
          expanded,
          type,
          content
        });
      }

      // If this is a reply, fetch the parent tweet for context
      let replyContext = null;
      if (bookmark.inReplyToStatusId) {
        console.log(`  This is a reply to ${bookmark.inReplyToStatusId}, fetching parent...`);
        const parentTweet = fetchTweet(config, bookmark.inReplyToStatusId);
        if (parentTweet) {
          replyContext = {
            id: parentTweet.id,
            author: parentTweet.author?.username || 'unknown',
            authorName: parentTweet.author?.name || parentTweet.author?.username || 'unknown',
            text: parentTweet.text || '',
            tweetUrl: `https://x.com/${parentTweet.author?.username || 'unknown'}/status/${parentTweet.id}`
          };
        }
      }

      // Check for native quote tweet (from normalized xurl response)
      let quoteContext = null;
      if (bookmark.quotedTweet) {
        const qt = bookmark.quotedTweet;
        quoteContext = {
          id: qt.id,
          author: qt.author?.username || 'unknown',
          authorName: qt.author?.name || qt.author?.username || 'unknown',
          text: qt.text || '',
          tweetUrl: `https://x.com/${qt.author?.username || 'unknown'}/status/${qt.id}`,
          source: 'native-quote'
        };
      }

      // Capture media attachments (photos, videos, GIFs) - EXPERIMENTAL
      // Only included if includeMedia is true (--media flag)
      const media = configWithOptions.includeMedia ? (bookmark.media || []) : [];

      // Build tags array from folder tag (if present)
      const tags = [];
      if (bookmark._folderTag) {
        tags.push(bookmark._folderTag);
      }

      prepared.push({
        id: bookmark.id,
        author,
        authorName: bookmark.author?.name || author,
        text,
        tweetUrl: `https://x.com/${author}/status/${bookmark.id}`,
        createdAt: bookmark.createdAt,
        links,
        media,
        tags,
        date,
        isReply: !!bookmark.inReplyToStatusId,
        replyContext,
        isQuote: !!quoteContext,
        quoteContext
      });

      const mediaInfo = media.length > 0 ? ` (${media.length} media)` : '';
      const tagInfo = tags.length > 0 ? ` [${tags.join(', ')}]` : '';
      console.log(`  Prepared: @${author} with ${links.length} links${mediaInfo}${tagInfo}${replyContext ? ' (reply)' : ''}${quoteContext ? ' (quote)' : ''}`);

    } catch (error) {
      console.error(`  Error processing bookmark ${bookmark.id}: ${error.message}`);
    }
  }

  // Merge prepared bookmarks into pending file
  let existingPending = { bookmarks: [] };
  try {
    if (fs.existsSync(config.pendingFile)) {
      const parsed = JSON.parse(fs.readFileSync(config.pendingFile, 'utf8'));
      existingPending = { bookmarks: parsed.bookmarks || [], ...parsed };
    }
  } catch (e) {}

  const existingPendingIds = new Set(existingPending.bookmarks.map(b => b.id));
  const newBookmarks = prepared.filter(b => !existingPendingIds.has(b.id));

  // Merge and sort by createdAt ascending (oldest first)
  // This ensures when processed, oldest get added first, newest end up on top
  const allBookmarks = [...existingPending.bookmarks, ...newBookmarks];
  allBookmarks.sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateA - dateB; // Ascending: oldest first
  });

  const output = {
    generatedAt: now.toISOString(),
    count: allBookmarks.length,
    bookmarks: allBookmarks
  };

  const pendingDir = path.dirname(config.pendingFile);
  if (!fs.existsSync(pendingDir)) {
    fs.mkdirSync(pendingDir, { recursive: true });
  }
  fs.writeFileSync(config.pendingFile, JSON.stringify(output, null, 2));
  console.log(`\nMerged ${newBookmarks.length} new bookmarks into ${config.pendingFile} (total: ${output.count})`);

  // Update state
  state.last_check = now.toISOString();
  saveState(config, state);

  return { bookmarks: prepared, count: prepared.length, pendingFile: config.pendingFile };
}
