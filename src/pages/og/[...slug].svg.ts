import type { APIRoute } from 'astro';
import satori from 'satori';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function getStaticPaths() {
  // Get all markdown posts
  const posts = import.meta.glob('../posts/*.md', { eager: true });
  
  return Object.entries(posts).map(([path, post]: [string, any]) => {
    // Extract slug from file path
    const slug = path.split('/').pop()?.replace('.md', '') || '';
    return {
      params: { slug },
      props: {
        title: post.frontmatter?.title || 'lCyou Blog',
        description: post.frontmatter?.description || '',
        pubDate: post.frontmatter?.pubDate,
        tags: post.frontmatter?.tags || [],
      },
    };
  });
}

export const GET: APIRoute = async ({ props }) => {
  const { title, description, pubDate, tags } = props as {
    title: string;
    description: string;
    pubDate: string;
    tags: string[];
  };

  // Format date
  const formattedDate = pubDate ? new Date(pubDate).toLocaleDateString('ja-JP') : '';

  // Load fonts from node_modules
  const fontPath400 = join(
    process.cwd(),
    'node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff'
  );
  const fontPath700 = join(
    process.cwd(),
    'node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-700-normal.woff'
  );

  // Create SVG with Satori
  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '60px',
          color: 'white',
          fontFamily: 'Noto Sans JP',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              },
              children: [
                {
                  type: 'h1',
                  props: {
                    style: {
                      fontSize: '64px',
                      fontWeight: 'bold',
                      margin: '0',
                      lineHeight: '1.2',
                    },
                    children: title,
                  },
                },
                description && {
                  type: 'p',
                  props: {
                    style: {
                      fontSize: '32px',
                      margin: '0',
                      opacity: 0.9,
                    },
                    children: description,
                  },
                },
                tags.length > 0 && {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      gap: '12px',
                      flexWrap: 'wrap',
                    },
                    children: tags.map((tag: string) => ({
                      type: 'span',
                      props: {
                        style: {
                          fontSize: '24px',
                          background: 'rgba(255, 255, 255, 0.2)',
                          padding: '8px 16px',
                          borderRadius: '8px',
                        },
                        children: `#${tag}`,
                      },
                    })),
                  },
                },
              ].filter(Boolean),
            },
          },
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '28px',
                      fontWeight: 'bold',
                    },
                    children: 'lCyou Blog',
                  },
                },
                formattedDate && {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '24px',
                      opacity: 0.8,
                    },
                    children: formattedDate,
                  },
                },
              ].filter(Boolean),
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Noto Sans JP',
          data: readFileSync(fontPath400),
          weight: 400,
          style: 'normal',
        },
        {
          name: 'Noto Sans JP',
          data: readFileSync(fontPath700),
          weight: 700,
          style: 'normal',
        },
      ],
    }
  );

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
