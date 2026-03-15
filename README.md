# mdblog-astro

A personal blog built with [Astro](https://astro.build), deployed to [Cloudflare Pages](https://pages.cloudflare.com).  
Live at **[blog.lcyou.me](https://blog.lcyou.me)**.

## Overview

mdblog-astro is a Markdown-driven personal blog powered by the Astro framework.  
Posts are written in Markdown (`.md`) files and exposed as routes automatically.  
The site is served via Cloudflare Pages using Astro's Cloudflare adapter, and includes OG image generation, RSS feed, sitemap, tag pages, reading-time estimates, and a light/dark theme.

## Structure

### File Tree

```text
/
├── public/                          # Static assets served as-is
│   ├── assets/videos/fallback.mp4
│   ├── favicon.ico
│   ├── favicon.svg
│   ├── og-default.png               # Default OG image (auto-generated)
│   └── robots.txt
├── scripts/
│   └── create-post.js               # CLI helper for scaffolding new posts
├── src/
│   ├── components/                  # Reusable UI components
│   │   ├── DecryptedText.tsx        # Animated text (Preact)
│   │   ├── Footer.astro
│   │   ├── Header.astro
│   │   ├── Menu.astro
│   │   ├── Navigation.astro
│   │   ├── ReflectiveCard.tsx       # Hero card on the home page (Preact)
│   │   ├── SocialLinks.astro
│   │   ├── TableOfContents.astro    # Auto-generated TOC for posts
│   │   └── ThemeToggle.astro        # Light / dark mode switch
│   ├── data/
│   │   ├── career.json              # Timeline data for the about page
│   │   └── seo.ts                   # Site-wide SEO config
│   ├── layouts/
│   │   ├── BaseLayout.astro         # HTML shell with SEO, header, footer
│   │   ├── MarkdownPostLayout.astro # Layout wrapper for blog posts
│   │   └── PageLayout.astro         # Layout wrapper for static pages
│   ├── pages/
│   │   ├── index.astro              # Home page (hero)
│   │   ├── blog.astro               # Post listing page
│   │   ├── about.astro              # About / career timeline page
│   │   ├── 404.astro                # Not-found error page
│   │   ├── 500.astro                # Internal server error page
│   │   ├── rss.xml.js               # RSS feed endpoint
│   │   ├── posts/                   # Markdown blog posts + images
│   │   └── tags/                    # Tag index & per-tag listing pages
│   ├── scripts/
│   │   ├── generate-og-images.ts    # Generates PNG OG images for every post
│   │   ├── remark-modified-time.mjs # Remark plugin: injects last-modified date
│   │   └── remark-reading-time.mjs  # Remark plugin: injects reading-time estimate
│   └── styles/
│       └── global.css               # Global styles & CSS variables (themes)
├── astro.config.mjs                 # Astro configuration
├── wrangler.jsonc                   # Cloudflare Workers / Pages config
├── tsconfig.json
└── package.json
```

### Tools

| Tool | Role |
| :--- | :--- |
| [Astro](https://astro.build) | Core framework – static-site generation & routing |
| [Preact](https://preactjs.com) | Lightweight interactive components (`@astrojs/preact`) |
| [Cloudflare adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) | Edge-runtime deployment on Cloudflare Pages |
| [astro-icon](https://github.com/natemoo-re/astro-icon) | SVG icon component (Iconify sets: `mdi`, `devicon`, `system-uicons`) |
| [astro-seo](https://github.com/jonasmerlin/astro-seo) | SEO meta tags & Open Graph |
| [Satori](https://github.com/vercel/satori) + [Sharp](https://sharp.pixelplumbing.com) | Programmatic OG image generation |
| [@astrojs/rss](https://docs.astro.build/en/guides/rss/) | RSS feed generation |
| [@astrojs/sitemap](https://docs.astro.build/en/guides/integrations-guide/sitemap/) | Auto-generated sitemap |
| [dayjs](https://day.js.org) | Date formatting in post layouts |
| [reading-time](https://github.com/ngryman/reading-time) | Estimated reading time via remark plugin |
| [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP) | Japanese typeface used in OG image generation |
| [Shiki](https://shiki.style) | Syntax highlighting (Everforest Dark / Gruvbox Dark Medium) |
| [Wrangler](https://developers.cloudflare.com/workers/wrangler/) | Local preview & deployment to Cloudflare |

## Features

- **Markdown-based posts** – write posts in `.md` files; frontmatter controls title, date, description, tags, and author
- **Automatic OG images** – per-post Open Graph PNG images are generated at build time using Satori + Sharp and served from `/og/<slug>.png`
- **RSS feed** – available at `/rss.xml`
- **Sitemap** – auto-generated at `/sitemap-index.xml`
- **Tag pages** – posts are tagged; browsable via `/tags` and `/tags/<tag>`
- **Table of contents** – auto-generated TOC injected into each post layout
- **Reading time** – estimated reading time displayed per post
- **Light / dark theme** – Solarized Light and a dark variant, toggled without flash on load
- **Responsive design** – mobile-friendly layout with a bottom navigation bar on small screens
- **SEO** – Open Graph, Twitter Card, canonical URLs, and per-page metadata via `astro-seo`
- **Post scaffolding CLI** – run `pnpm post` to interactively create a new post with the correct filename and frontmatter template

## Commands

All commands are run from the root of the project:

| Command | Action |
| :--- | :--- |
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start local dev server at `localhost:4321` |
| `pnpm build` | Generate OG images then build production site to `./dist/` |
| `pnpm preview` | Build and preview locally via Wrangler (Cloudflare runtime) |
| `pnpm post` | Interactively scaffold a new blog post |
| `pnpm generate:og` | Re-generate OG images only |
