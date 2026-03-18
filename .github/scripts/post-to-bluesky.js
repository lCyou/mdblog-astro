/**
 * Post new blog articles to Bluesky.
 *
 * Environment variables (all required unless noted):
 *   BLUESKY_HANDLE   - Bluesky username/handle (e.g. user.bsky.social)
 *   BLUESKY_PASSWORD - Bluesky app password
 *   RSS_URL          - Full URL of the blog RSS feed (optional, has default)
 *   STATE_FILE       - Path to the JSON state file (optional, has default)
 *   MAX_ARTICLES     - How many recent feed items to check (optional, default 10)
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const RSS_URL = process.env.RSS_URL || 'https://blog.lcyou.me/rss.xml';
const STATE_FILE = process.env.STATE_FILE || '.github/bluesky-posted.json';
const MAX_ARTICLES = parseInt(process.env.MAX_ARTICLES || '10', 10);
const BLUESKY_HANDLE = process.env.BLUESKY_HANDLE;
const BLUESKY_PASSWORD = process.env.BLUESKY_PASSWORD;

// ── GitHub Actions output helper ─────────────────────────────────────────────

function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `${name}=${value}\n`);
  }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow one redirect
        resolve(fetchUrl(res.headers.location));
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)); });
  });
}

function postJSON(hostname, urlPath, body, headers) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...headers,
      },
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch (_) { parsed = data; }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${typeof parsed === 'object' ? JSON.stringify(parsed) : parsed}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(bodyStr);
    req.end();
  });
}

// ── RSS parsing ───────────────────────────────────────────────────────────────

function extractTag(xml, tag) {
  // Match CDATA-wrapped content first, then plain text
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
  const plainRe  = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');

  const cdata = xml.match(cdataRe);
  if (cdata) return cdata[1].trim();

  const plain = xml.match(plainRe);
  if (plain) return plain[1].trim();

  return '';
}

function parseRSSItems(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const chunk = m[1];
    const title       = extractTag(chunk, 'title');
    const link        = extractTag(chunk, 'link') || extractTag(chunk, 'guid');
    const description = extractTag(chunk, 'description');
    const pubDate     = extractTag(chunk, 'pubDate');
    if (title && link) {
      items.push({ title, link, description, pubDate });
    }
  }
  return items;
}

// ── State management ──────────────────────────────────────────────────────────

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      if (Array.isArray(data.posted)) return data;
    }
  } catch (e) {
    console.warn(`Could not read state file (${e.message}), starting fresh.`);
  }
  return { posted: [] };
}

function saveState(state) {
  fs.mkdirSync(path.dirname(path.resolve(STATE_FILE)), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

// ── Post text builder ─────────────────────────────────────────────────────────

/**
 * Truncate a string so that its UTF-8 byte length does not exceed maxBytes,
 * appending an ellipsis when the string is shortened.
 * Operates character-by-character so multi-byte characters (e.g. CJK) are
 * never split mid-codepoint.
 */
function truncateByBytes(str, maxBytes) {
  if (Buffer.byteLength(str) <= maxBytes) return str;
  const ellipsis      = '…';
  const ellipsisBytes = Buffer.byteLength(ellipsis); // 3 bytes (U+2026)
  const budget        = maxBytes - ellipsisBytes;
  let byteCount = 0;
  let result    = '';
  for (const char of str) {
    const charBytes = Buffer.byteLength(char);
    if (byteCount + charBytes > budget) break;
    result    += char;
    byteCount += charBytes;
  }
  return result + ellipsis;
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Build the post text and rich-text facets for a Bluesky post.
 * Format:
 *   📝 {title}
 *
 *   {description, if available and fits within 300 chars}
 *
 *   {link}
 *
 * Returns { text, facets } where facets make the URL clickable.
 */
function buildPost(article) {
  const LIMIT = 300;
  const link  = article.link;

  let text = `📝 ${article.title}\n\n`;

  if (article.description) {
    const clean = decodeHtmlEntities(
      article.description.replace(/<[^>]+>/g, '')
    ).replace(/\s+/g, ' ').trim();

    if (clean) {
      // Budget: total limit minus header bytes minus link bytes minus 2 bytes
      // for the '\n\n' separator that follows the excerpt.
      const SEPARATOR_BYTES = 2;
      const budget = LIMIT - Buffer.byteLength(text) - Buffer.byteLength(link) - SEPARATOR_BYTES;
      if (budget > 20) {
        text += truncateByBytes(clean, budget) + '\n\n';
      }
    }
  }

  const linkByteStart = Buffer.byteLength(text);
  text += link;
  const linkByteEnd = Buffer.byteLength(text);

  const facets = [
    {
      index:    { byteStart: linkByteStart, byteEnd: linkByteEnd },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: link }],
    },
  ];

  return { text, facets };
}

// ── Bluesky API ───────────────────────────────────────────────────────────────

async function authenticate() {
  console.log(`Authenticating as ${BLUESKY_HANDLE} …`);
  return postJSON(
    'bsky.social',
    '/xrpc/com.atproto.server.createSession',
    { identifier: BLUESKY_HANDLE, password: BLUESKY_PASSWORD }
  );
}

async function createPost(session, article) {
  const { text, facets } = buildPost(article);

  console.log(`Posting: ${article.title}`);
  console.log(`  ${text.length} chars | link facet [${facets[0].index.byteStart}-${facets[0].index.byteEnd}]`);

  await postJSON(
    'bsky.social',
    '/xrpc/com.atproto.repo.createRecord',
    {
      repo:       session.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type:     'app.bsky.feed.post',
        text,
        facets,
        createdAt: new Date().toISOString(),
      },
    },
    { Authorization: `Bearer ${session.accessJwt}` }
  );

  console.log(`  ✓ Done`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!BLUESKY_HANDLE || !BLUESKY_PASSWORD) {
    console.error('Error: BLUESKY_HANDLE and BLUESKY_PASSWORD must be set.');
    process.exit(1);
  }

  console.log(`Fetching RSS feed: ${RSS_URL}`);
  const xml   = await fetchUrl(RSS_URL);
  const items = parseRSSItems(xml);
  console.log(`Feed contains ${items.length} item(s); checking up to ${MAX_ARTICLES}.`);

  const recent     = items.slice(0, MAX_ARTICLES);
  const state      = loadState();
  const newArticles = recent.filter((a) => !state.posted.includes(a.link));

  if (newArticles.length === 0) {
    console.log('No new articles to post.');
    setOutput('posted_count', '0');
    return;
  }

  console.log(`${newArticles.length} new article(s) to post.`);

  const session     = await authenticate();
  let   postedCount = 0;

  // Post oldest-first so the timeline reads in order
  for (const article of [...newArticles].reverse()) {
    try {
      await createPost(session, article);
      state.posted.push(article.link);
      postedCount++;
      if (postedCount < newArticles.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (e) {
      console.error(`  ✗ Failed to post "${article.title}": ${e.message}`);
    }
  }

  saveState(state);
  console.log(`\nPosted ${postedCount}/${newArticles.length} article(s) to Bluesky.`);
  setOutput('posted_count', String(postedCount));
}

main().catch((e) => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
