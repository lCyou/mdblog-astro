import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';
import satori from 'satori';
import sharp from 'sharp';

interface PostFrontmatter {
  title?: string;
  description?: string;
  pubDate?: string;
  tags?: string[];
  author?: string;
}

interface Post {
  frontmatter?: PostFrontmatter;
}

async function generateOGImage(
  slug: string,
  title: string,
  description: string,
  pubDate: string,
  tags: string[],
  author: string
): Promise<Buffer> {
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

  // Convert SVG to PNG using Sharp
  const pngBuffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  return pngBuffer;
}

async function main() {
  console.log('🎨 Generating OG images...\n');

  // Ensure output directory exists
  const outputDir = join(process.cwd(), 'public/og');
  mkdirSync(outputDir, { recursive: true });

  // Get all markdown posts
  const postFiles = await glob('src/pages/posts/*.md');
  
  let successCount = 0;
  let errorCount = 0;

  // Generate OG image for each post
  for (const postPath of postFiles) {
    try {
      const slug = postPath.split('/').pop()?.replace('.md', '') || '';
      
      // Read post file to extract frontmatter
      const fileContent = readFileSync(postPath, 'utf-8');
      const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---/);
      
      if (!frontmatterMatch) {
        console.warn(`⚠️  No frontmatter found in ${slug}.md, skipping...`);
        continue;
      }

      // Parse frontmatter (simple YAML parsing)
      const frontmatterText = frontmatterMatch[1];
      const frontmatter: PostFrontmatter = {};
      
      const titleMatch = frontmatterText.match(/^title:\s*['"]?(.+?)['"]?$/m);
      const descMatch = frontmatterText.match(/^description:\s*['"]?(.+?)['"]?$/m);
      const authorMatch = frontmatterText.match(/^author:\s*['"]?(.+?)['"]?$/m);
      const pubDateMatch = frontmatterText.match(/^pubDate:\s*['"]?(.+?)['"]?$/m);
      const tagsMatch = frontmatterText.match(/^tags:\s*\[(.*?)\]/m);

      frontmatter.title = titleMatch ? titleMatch[1] : 'lCyouのブログ';
      frontmatter.description = descMatch ? descMatch[1] : '';
      frontmatter.author = authorMatch ? authorMatch[1] : 'unknown';
      frontmatter.pubDate = pubDateMatch ? pubDateMatch[1] : '';
      frontmatter.tags = tagsMatch 
        ? tagsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, ''))
        : [];

      const pngBuffer = await generateOGImage(
        slug,
        frontmatter.title || 'lCyouのブログ',
        frontmatter.description || '',
        frontmatter.pubDate || '',
        frontmatter.tags || [],
        frontmatter.author || 'unknown'
      );

      const outputPath = join(outputDir, `${slug}.png`);
      writeFileSync(outputPath, pngBuffer);

      console.log(`✅ Generated: ${slug}.png`);
      successCount++;
    } catch (error) {
      console.error(`❌ Error generating OG image for ${postPath}:`, error);
      errorCount++;
    }
  }

  // Generate default OG image
  try {
    const defaultPngBuffer = await generateOGImage(
      'default',
      'lCyouのブログ',
      'プログラミングと技術について',
      '',
      [],
      'lCyou'
    );

    const defaultOutputPath = join(process.cwd(), 'public/og-default.png');
    writeFileSync(defaultOutputPath, defaultPngBuffer);

    console.log(`✅ Generated: og-default.png`);
    successCount++;
  } catch (error) {
    console.error('❌ Error generating default OG image:', error);
    errorCount++;
  }

  console.log(`\n🎉 Done! Generated ${successCount} images (${errorCount} errors)`);
}

main().catch(console.error);
