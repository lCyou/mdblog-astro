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
        title: post.frontmatter?.title || 'lCyouのブログ',
        description: post.frontmatter?.description || '',
        pubDate: post.frontmatter?.pubDate,
        tags: post.frontmatter?.tags || [],
        author: post.frontmatter?.author || 'unknown',
      },
    };
  });
}

export const GET: APIRoute = async ({ props }) => {
  const { title, description, pubDate, tags, author } = props as {
    title: string;
    description: string;
    pubDate: string;
    tags: string[];
    author: string;
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
          position: 'relative',
          background: '#eee8d5', // Solarized light background (light beige)
          fontFamily: 'Noto Sans JP',
        },
        children: [
          // Left accent border (bold)
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                left: '60px',
                top: '60px',
                bottom: '60px',
                width: '16px',
                background: '#f3927e', // Coral accent
                borderRadius: '4px',
              },
            },
          },
          // Main content
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                height: '100%',
                padding: '60px',
                position: 'relative',
              },
              children: [
                // Content area (centered)
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '24px',
                      alignItems: 'flex-start',
                      maxWidth: '1000px',
                    },
                    children: [
                      // Title with underline
                      {
                        type: 'div',
                        props: {
                          style: {
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
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
                                  color: '#33312d', // Dark text
                                },
                                children: title,
                              },
                            },
                          ],
                        },
                      },
                      // Description
                      description && {
                        type: 'p',
                        props: {
                          style: {
                            fontSize: '28px',
                            margin: '0',
                            lineHeight: '1.4',
                            color: '#605d52', // Medium gray
                          },
                          children: description,
                        },
                      },
                      // Tags
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
                                fontSize: '22px',
                                background: '#eee8d5', // Light beige
                                color: '#33312d',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                border: '2px solid #d4cbb5', // Darker beige
                              },
                              children: `#${tag}`,
                            },
                          })),
                        },
                      },
                    ].filter(Boolean),
                  },
                },
                // Footer (absolute positioning at bottom right)
                {
                  type: 'div',
                  props: {
                    style: {
                      position: 'absolute',
                      bottom: '60px',
                      right: '60px',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                      color: '#605d52',
                      fontSize: '24px',
                    },
                    children: [
                      {
                        type: 'span',
                        props: {
                          children: `${author}`,
                        },
                      },
                      formattedDate && {
                        type: 'span',
                        props: {
                          children: ` / ${formattedDate}`,
                        },
                      },
                    ].filter(Boolean),
                  },
                },
              ],
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
