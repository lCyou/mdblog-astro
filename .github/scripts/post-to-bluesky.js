/**
 * Post new blog articles to Bluesky.
 *
 * Environment variables (all required unless noted):
 *   BLUESKY_HANDLE   - Bluesky username/handle (e.g. user.bsky.social)
 *   BLUESKY_PASSWORD - Bluesky app password
 *   POST_FILES       - Space-separated list of new post file paths to share
 *   BLOG_BASE_URL    - Blog base URL (optional, default: https://blog.lcyou.me)
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const BLUESKY_HANDLE  = process.env.BLUESKY_HANDLE;
const BLUESKY_PASSWORD = process.env.BLUESKY_PASSWORD;
const POST_FILES      = (process.env.POST_FILES || '').trim().split(/\s+/).filter(Boolean);
const BLOG_BASE_URL   = (process.env.BLOG_BASE_URL || 'https://blog.lcyou.me').replace(/\/$/, '');

// ── HTTP helper ───────────────────────────────────────────────────────────────

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

// ── Frontmatter parsing ───────────────────────────────────────────────────────

/**
 * Parse YAML frontmatter from a markdown file.
 * Handles simple scalar values and quoted strings.
 * Returns an object with the frontmatter fields.
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const fm = {};
  for (const line of match[1].split(/\r?\n/)) {
    // Match "key: value" lines (value may be empty); skip block/array fields
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    // Strip surrounding matching quotes if present
    const val = m[2].trim();
    if (val.length >= 2 &&
        ((val.startsWith("'") && val.endsWith("'")) ||
         (val.startsWith('"') && val.endsWith('"')))) {
      fm[m[1]] = val.slice(1, -1);
    } else {
      fm[m[1]] = val;
    }
  }
  return fm;
}

function fileToUrl(filePath) {
  const basename = path.basename(filePath, '.md');
  return `${BLOG_BASE_URL}/posts/${basename}`;
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

/**
 * Build the post text and rich-text facets for a Bluesky post.
 * Format:
 *   📝 {title}
 *
 *   {description, if available and fits within 300 bytes}
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
    const clean = article.description.replace(/\s+/g, ' ').trim();
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
  console.log(`  ${Buffer.byteLength(text)} bytes | link facet [${facets[0].index.byteStart}-${facets[0].index.byteEnd}]`);

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

  if (POST_FILES.length === 0) {
    console.log('No post files specified.');
    return;
  }

  console.log(`Processing ${POST_FILES.length} file(s): ${POST_FILES.join(', ')}`);

  const articles = [];
  for (const filePath of POST_FILES) {
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const fm      = parseFrontmatter(content);

    if (!fm.title) {
      console.warn(`No title found in frontmatter: ${filePath}`);
      continue;
    }

    articles.push({
      title:       fm.title,
      description: fm.description || '',
      link:        fileToUrl(filePath),
    });
  }

  if (articles.length === 0) {
    console.log('No valid articles to post.');
    return;
  }

  const session = await authenticate();

  for (let i = 0; i < articles.length; i++) {
    try {
      await createPost(session, articles[i]);
      if (i < articles.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (e) {
      console.error(`  ✗ Failed to post "${articles[i].title}": ${e.message}`);
    }
  }
}

main().catch((e) => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
