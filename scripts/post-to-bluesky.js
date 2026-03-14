#!/usr/bin/env node
/**
 * post-to-bluesky.js
 *
 * Fetches the blog's RSS feed, compares with previously posted articles,
 * and posts any new ones to Bluesky using the AT Protocol API directly.
 *
 * Required environment variables:
 *   BLUESKY_HANDLE       – Bluesky handle (e.g. "yourname.bsky.social")
 *   BLUESKY_APP_PASSWORD – App password created in Bluesky settings
 */

import fs from 'fs';
import path from 'path';

const RSS_URL = 'https://blog.lcyou.me/rss.xml';
const BLUESKY_API_BASE = 'https://bsky.social/xrpc';
const STATE_FILE = path.join(process.cwd(), '.posted-articles.json');
const POST_DELAY_MS = 1000;
const MAX_POST_GRAPHEMES = 300;

// Reuse a single Segmenter instance for all grapheme operations
const graphemeSegmenter = new Intl.Segmenter();

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

function loadPostedGuids() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return new Set(Array.isArray(data.posted) ? data.posted : []);
    }
  } catch (err) {
    console.error('Warning: could not read state file, starting fresh.', err.message);
  }
  return new Set();
}

function savePostedGuids(posted) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ posted: [...posted] }, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// RSS helpers
// ---------------------------------------------------------------------------

/**
 * Extract the text content of a single XML tag (supports CDATA).
 * Only matches the first occurrence – safe for item-level parsing.
 */
function extractTag(xml, tag) {
  // CDATA variant
  const cdataRe = new RegExp(
    `<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`,
    'i',
  );
  const cdataMatch = xml.match(cdataRe);
  if (cdataMatch) return cdataMatch[1].trim();

  // Plain text variant
  const plainRe = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
  const plainMatch = xml.match(plainRe);
  if (plainMatch) return plainMatch[1].trim();

  return null;
}

function parseRSSItems(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRe.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const guid = extractTag(itemXml, 'guid') || link;
    const pubDate = extractTag(itemXml, 'pubDate');

    if (title && link && guid) {
      items.push({ title, link, guid, pubDate });
    }
  }

  return items;
}

async function fetchRSSItems(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch RSS feed: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  return parseRSSItems(text);
}

// ---------------------------------------------------------------------------
// Bluesky AT Protocol helpers
// ---------------------------------------------------------------------------

async function createSession(identifier, password) {
  const res = await fetch(`${BLUESKY_API_BASE}/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Bluesky authentication failed (${res.status}): ${body}`);
  }
  return res.json();
}

/**
 * Count Unicode grapheme clusters so we stay within Bluesky's 300-grapheme limit.
 */
function countGraphemes(str) {
  return [...graphemeSegmenter.segment(str)].length;
}

/**
 * Truncate a string to at most `max` grapheme clusters, appending "…" when cut.
 */
function truncateGraphemes(str, max) {
  const segments = [...graphemeSegmenter.segment(str)];
  if (segments.length <= max) return str;
  return segments
    .slice(0, max - 1)
    .map((s) => s.segment)
    .join('') + '…';
}

/**
 * Build the post text and the URL facet that makes the link clickable.
 *
 * Format:
 *   新しい記事を公開しました！📝
 *
 *   <title>
 *
 *   <url>
 */
function buildPostPayload(title, url) {
  const HEADER = '新しい記事を公開しました！📝\n\n';
  const SEPARATOR = '\n\n';

  // Calculate how many graphemes are available for the title
  const overhead = countGraphemes(HEADER) + countGraphemes(SEPARATOR) + countGraphemes(url);
  const maxTitle = MAX_POST_GRAPHEMES - overhead;
  const safeTitle = maxTitle > 0 ? truncateGraphemes(title, maxTitle) : '';

  const text = `${HEADER}${safeTitle}${SEPARATOR}${url}`;

  // Bluesky facets use UTF-8 byte offsets
  const encoder = new TextEncoder();
  const byteStart = encoder.encode(`${HEADER}${safeTitle}${SEPARATOR}`).length;
  const byteEnd = byteStart + encoder.encode(url).length;

  const record = {
    $type: 'app.bsky.feed.post',
    text,
    createdAt: new Date().toISOString(),
    facets: [
      {
        index: { byteStart, byteEnd },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }],
      },
    ],
  };

  return record;
}

async function createBlueskyPost(accessJwt, did, title, url) {
  const record = buildPostPayload(title, url);

  const res = await fetch(`${BLUESKY_API_BASE}/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessJwt}`,
    },
    body: JSON.stringify({
      repo: did,
      collection: 'app.bsky.feed.post',
      record,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create Bluesky post (${res.status}): ${body}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const handle = process.env.BLUESKY_HANDLE;
  const appPassword = process.env.BLUESKY_APP_PASSWORD;

  if (!handle || !appPassword) {
    console.error('Error: BLUESKY_HANDLE and BLUESKY_APP_PASSWORD must be set.');
    process.exit(1);
  }

  // 1. Load state
  const postedGuids = loadPostedGuids();
  console.log(`State: ${postedGuids.size} previously posted article(s).`);

  // 2. Fetch RSS feed
  console.log(`Fetching RSS feed: ${RSS_URL}`);
  let items;
  try {
    items = await fetchRSSItems(RSS_URL);
  } catch (err) {
    console.error('Error fetching RSS feed:', err.message);
    process.exit(1);
  }
  console.log(`RSS feed: ${items.length} article(s) found.`);

  // 3. Find new articles (not yet posted)
  const newItems = items.filter((item) => !postedGuids.has(item.guid));
  console.log(`New articles to post: ${newItems.length}`);

  if (newItems.length === 0) {
    console.log('Nothing to post. Exiting.');
    return;
  }

  // 4. Authenticate
  console.log('Authenticating with Bluesky…');
  let session;
  try {
    session = await createSession(handle, appPassword);
  } catch (err) {
    console.error('Authentication error:', err.message);
    process.exit(1);
  }
  console.log('Authenticated successfully.');

  // 5. Post new articles in chronological order (oldest first)
  const sortedNew = [...newItems].reverse();
  for (let i = 0; i < sortedNew.length; i++) {
    const article = sortedNew[i];
    console.log(`Posting [${i + 1}/${sortedNew.length}]: ${article.title}`);
    try {
      await createBlueskyPost(session.accessJwt, session.did, article.title, article.link);
      postedGuids.add(article.guid);
      console.log(`  ✓ Posted: ${article.link}`);
    } catch (err) {
      console.error(`  ✗ Failed to post "${article.title}":`, err.message);
    }

    // Avoid hitting rate limits between consecutive posts
    if (i < sortedNew.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, POST_DELAY_MS));
    }
  }

  // 6. Persist updated state
  savePostedGuids(postedGuids);
  console.log('State saved.');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
