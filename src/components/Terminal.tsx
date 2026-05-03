import careerData from '@/data/career.json';
import { greetingArt } from '@/data/greetings';
import { fetchGitHubActivity, formatGitHubEvent, generateCommitHash } from '@/utils/github';
import { useEffect, useRef } from 'preact/hooks';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {}

// ANSI色コードユーティリティ
const ANSI = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  white: '\x1b[97m',
};

// 色付きテキストを生成するヘルパー
const colorize = (text: string, color: string) => `${color}${text}${ANSI.reset}`;

// 時間帯に基づいた挨拶ASCII Artを取得
const getGreetingArt = (date: Date): string[] => {
  const hour = date.getHours();
  
  if (hour >= 5 && hour < 12) {
    return greetingArt.morning;
  } else if (hour >= 12 && hour < 18) {
    return greetingArt.afternoon;
  } else if (hour >= 18 && hour < 22) {
    return greetingArt.evening;
  } else {
    return greetingArt.night;
  }
};

const kanagawaDragonTheme = {
  background: '#0d0c0c',     // dragonBlack0 - より暗い背景
  foreground: '#c5c9c5',     // dragonWhite
  cursor: '#c4746e',         // dragonRed
  cursorAccent: '#0d0c0c',   // dragonBlack0
  selectionBackground: '#2D4F67', // waveBlue2

  black: '#0d0c0c',          // dragonBlack0
  red: '#c4746e',            // dragonRed
  green: '#8a9a7b',          // dragonGreen2
  yellow: '#c4b28a',         // dragonYellow
  blue: '#8ba4b0',           // dragonBlue2
  magenta: '#a292a3',        // dragonPink
  cyan: '#8ea4a2',           // dragonAqua
  white: '#c5c9c5',          // dragonWhite

  brightBlack: '#a6a69c',    // dragonGray
  brightRed: '#E46876',      // waveRed
  brightGreen: '#87a987',    // dragonGreen
  brightYellow: '#E6C384',   // carpYellow
  brightBlue: '#7FB4CA',     // springBlue
  brightMagenta: '#938AA9',  // springViolet1
  brightCyan: '#7AA89F',     // waveAqua2
  brightWhite: '#c5c9c5',    // dragonWhite
};

export default function Terminal({}: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const currentLineRef = useRef('');
  const cursorPositionRef = useRef(0);
  const commandHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const isBootingRef = useRef(true);
  const skipBootRef = useRef({ value: false });

  const showPrompt = (term: any) => {
    term.write('\r\n$ ');
  };

  const writeLine = (term: any, text: string) => {
    term.write(text + '\r\n');
  };

  const highlightCommand = (line: string): string => {
    if (!line) return '';
    
    const parts = line.split(/(\s+)/); // スペースを保持しながら分割
    if (parts.length === 0) return line;
    
    const knownCommands = ['help', 'whoami', 'log', 'open', 'clear'];
    const knownOptions = ['--career', '--activity'];
    const knownPages = ['blog', 'about', 'search'];
    
    let result = '';
    let isFirstPart = true;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (part.match(/^\s+$/)) {
        result += part;
        continue;
      }
      
      if (isFirstPart) {
        if (knownCommands.includes(part)) {
          result += colorize(part, ANSI.brightGreen);
        } else {
          result += part;
        }
        isFirstPart = false;
      }
      else if (part.startsWith('--')) {
        if (knownOptions.includes(part)) {
          result += colorize(part, ANSI.brightYellow);
        } else {
          result += colorize(part, ANSI.yellow);
        }
      }
      else if (part.startsWith('<') && part.endsWith('>')) {
        result += colorize(part, ANSI.gray);
      }
      else if (knownPages.includes(part)) {
        result += colorize(part, ANSI.brightBlue);
      }
      else {
        result += colorize(part, ANSI.blue);
      }
    }
    
    return result;
  };

  // GitHub アクティビティを表示
  const displayGitHubActivity = async (term: any) => {
    const result = await fetchGitHubActivity('lcyou');
    
    if (!result.success) {
      writeLine(term, colorize(`Error: ${result.error}`, ANSI.brightRed));
      return;
    }
    
    if (!result.events || result.events.length === 0) {
      writeLine(term, colorize('No recent activity found.', ANSI.yellow));
      return;
    }

    for (const event of result.events) {
      const formattedLines = formatGitHubEvent(event);
      formattedLines.forEach(line => writeLine(term, line));
    }
  };

  const handleCommand = async (term: any, command: string) => {
    const trimmed = command.trim();
    
    if (!trimmed) {
      showPrompt(term);
      return;
    }

    commandHistoryRef.current.push(trimmed);
    historyIndexRef.current = commandHistoryRef.current.length;

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        writeLine(term, '');
        writeLine(term, 'Available commands:');
        writeLine(term, `  ${colorize('whoami', ANSI.green)}              ${colorize('Show profile information', ANSI.gray)}`);
        writeLine(term, `  ${colorize('log', ANSI.green)}                 ${colorize('Show my activity', ANSI.gray)}`);
        writeLine(term, `  ${colorize('open', ANSI.green)}                ${colorize('Navigate to page', ANSI.gray)}`);
        writeLine(term, `  ${colorize('clear', ANSI.green)}               ${colorize('Clear terminal', ANSI.gray)}`);
        writeLine(term, `  ${colorize('help', ANSI.green)}                ${colorize('Show this help message', ANSI.gray)}`);
        writeLine(term, '');
        break;

      case 'whoami':
        writeLine(term, '');
        writeLine(term, colorize('@lcyou', ANSI.brightCyan));
        writeLine(term, colorize('Software Engineer', ANSI.gray));
        writeLine(term, '');
        writeLine(term, `GitHub  : ${colorize('https://github.com/lcyou', ANSI.cyan)}`);
        writeLine(term, `Twitter : ${colorize('https://twitter.com/lCyo_u', ANSI.cyan)}`);
        writeLine(term, `Bluesky : ${colorize('https://bsky.app/profile/lcyou.bsky.social', ANSI.cyan)}`);
        writeLine(term, '');
        break;

      case 'log':
        if (args[0] === '--career') {
          writeLine(term, '');
          for (const item of careerData.timeline) {
            const commitHash = generateCommitHash(item.id);
            writeLine(term, `${colorize('commit', ANSI.yellow)} ${colorize(commitHash, ANSI.brightYellow)}`);
            writeLine(term, `${colorize('Date:', ANSI.blue)}   ${colorize(item.period, ANSI.white)}`);
            writeLine(term, '');
            writeLine(term, `    ${colorize(item.title, ANSI.brightGreen)}`);
            if (item.description) {
              writeLine(term, `    ${colorize(item.description, ANSI.gray)}`);
            }
            writeLine(term, '');
          }
        } else if (args[0] === '--activity') {
          writeLine(term, '');
          await displayGitHubActivity(term);
        } else {
          writeLine(term, colorize('Usage: log <options>', ANSI.yellow));
	  writeLine(term, '');
	  writeLine(term, `--career    : ${colorize('Show career history', ANSI.gray)}`);
	  writeLine(term, `--activity  : ${colorize('Show GitHub activity', ANSI.gray)}`);
        }
        break;

      case 'open':
        const routes: Record<string, string> = {
          blog: '/blog/',
          about: '/about/',
          search: '/search/',
        };
        
        const page = args[0];
        if (page && routes[page]) {
          writeLine(term, colorize(`Opening ${page}...`, ANSI.brightCyan));
          setTimeout(() => {
            window.location.href = routes[page];
          }, 500);
        } else {
          writeLine(term, colorize('Usage: open <page>', ANSI.yellow));
          writeLine(term, colorize('Available pages: blog, about, search', ANSI.gray));
        }
        break;

      case 'clear':
        term.clear();
        showPrompt(term);
        return;

      default:
        writeLine(term, colorize(`bash: ${cmd}: command not found`, ANSI.red));
        writeLine(term, colorize(`type 'help' to see available command`, ANSI.red));
        break;
    }

    showPrompt(term);
  };

  // ブートアニメーションを再生
  const playBootAnimation = async (term: any, skipRequested: { value: boolean }) => {
    const checkSkip = async (ms: number): Promise<boolean> => {
      const start = Date.now();
      while (Date.now() - start < ms) {
        if (skipRequested.value) return false;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return true;
    };
    
    const username = 'lcyou';
    const now = new Date();
    const datetime = now.toString(); // Unix-style format
    const greetingArtLines = getGreetingArt(now);
    
    // ブートシーケンスメッセージ
    writeLine(term, colorize('Initializing terminal environment...', ANSI.cyan));
    if (!await checkSkip(300)) return;
    
    term.write(colorize('Loading kernel modules... ', ANSI.gray));
    if (!await checkSkip(200)) return;
    writeLine(term, colorize('[OK]', ANSI.brightGreen));
    
    term.write(colorize('Initializing shell... ', ANSI.gray));
    if (!await checkSkip(200)) return;
    writeLine(term, colorize('[OK]', ANSI.brightGreen));
    
    term.write(colorize('Mounting filesystems... ', ANSI.gray));
    if (!await checkSkip(200)) return;
    writeLine(term, colorize('[OK]', ANSI.brightGreen));
    
    writeLine(term, colorize('Starting system services...', ANSI.gray));
    if (!await checkSkip(150)) return;
    
    writeLine(term, `  ${colorize('[✓]', ANSI.brightGreen)} GitHub integration`);
    if (!await checkSkip(150)) return;
    
    writeLine(term, `  ${colorize('[✓]', ANSI.brightGreen)} Command processor`);
    if (!await checkSkip(150)) return;
    
    writeLine(term, `  ${colorize('[✓]', ANSI.brightGreen)} History manager`);
    if (!await checkSkip(200)) return;
    
    writeLine(term, '');
    writeLine(term, colorize('System ready.', ANSI.cyan));
    if (!await checkSkip(300)) return;
    
    writeLine(term, '');
    writeLine(term, colorize(`Author: ${username}`, ANSI.yellow));
    writeLine(term, colorize(`Time: ${datetime}`, ANSI.white));
    writeLine(term, '');
    
    // ASCII Artグリーティングを表示
    for (const line of greetingArtLines) {
      writeLine(term, colorize(line, ANSI.brightMagenta));
    }
    
    await checkSkip(400);
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    let term: any;
    let fitAddon: any;
    let cleanup = false;

    const initTerminal = async () => {
      try {
        const xtermModule = await import('@xterm/xterm');
        const fitAddonModule = await import('@xterm/addon-fit');
        const webLinksAddonModule = await import('@xterm/addon-web-links');

        if (cleanup) return;

        const { Terminal: XTerm } = xtermModule;
        const { FitAddon } = fitAddonModule;
        const { WebLinksAddon } = webLinksAddonModule;

        // xterm インスタンスを作成
        term = new XTerm({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          theme: kanagawaDragonTheme,
          rows: 24,
          cols: 80,
        });

        fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        
        // WebLinksAddon を追加（URL を自動的にクリック可能にする）
        const webLinksAddon = new WebLinksAddon();
        term.loadAddon(webLinksAddon);

        if (terminalRef.current) {
          term.open(terminalRef.current);
          fitAddon.fit();

          xtermRef.current = term;
          fitAddonRef.current = fitAddon;

          isBootingRef.current = true;
          skipBootRef.current = { value: false };

          // アニメーションを非同期実行
          playBootAnimation(term, skipBootRef.current).then(() => {
            showPrompt(term);
            isBootingRef.current = false;
          });

          // キー入力処理
          term.onData((data: string) => {
            // ブート中の場合はスキップフラグを立てて入力を無視
            if (isBootingRef.current) {
              skipBootRef.current.value = true;
              return;
            }
            
            const code = data.charCodeAt(0);

            if (code === 13) {
              term.write('\r\n');
              handleCommand(term, currentLineRef.current);
              currentLineRef.current = '';
              cursorPositionRef.current = 0;
              return;
            }

            // Backspace
            if (code === 127) {
              if (cursorPositionRef.current > 0) {
                currentLineRef.current = 
                  currentLineRef.current.slice(0, cursorPositionRef.current - 1) +
                  currentLineRef.current.slice(cursorPositionRef.current);
                cursorPositionRef.current--;
                
                const highlighted = highlightCommand(currentLineRef.current);
                term.write('\r\x1b[K$ ' + highlighted);
              }
              return;
            }

            // Ctrl+C
            if (code === 3) {
              term.write('^C');
              currentLineRef.current = '';
              cursorPositionRef.current = 0;
              showPrompt(term);
              return;
            }

            // 矢印キー (上)
            if (data === '\x1b[A') {
              if (historyIndexRef.current > 0) {
                historyIndexRef.current--;
                const historicalCommand = commandHistoryRef.current[historyIndexRef.current];
                
                const highlighted = highlightCommand(historicalCommand);
                term.write('\r\x1b[K$ ' + highlighted);
                currentLineRef.current = historicalCommand;
                cursorPositionRef.current = historicalCommand.length;
              }
              return;
            }

            // 矢印キー (下)
            if (data === '\x1b[B') {
              if (historyIndexRef.current < commandHistoryRef.current.length - 1) {
                historyIndexRef.current++;
                const historicalCommand = commandHistoryRef.current[historyIndexRef.current];
                
                const highlighted = highlightCommand(historicalCommand);
                term.write('\r\x1b[K$ ' + highlighted);
                currentLineRef.current = historicalCommand;
                cursorPositionRef.current = historicalCommand.length;
              } else if (historyIndexRef.current === commandHistoryRef.current.length - 1) {
                historyIndexRef.current++;
                term.write('\r\x1b[K$ ');
                currentLineRef.current = '';
                cursorPositionRef.current = 0;
              }
              return;
            }

            // 通常の文字入力
            if (code >= 32 && code < 127) {
              currentLineRef.current = 
                currentLineRef.current.slice(0, cursorPositionRef.current) +
                data +
                currentLineRef.current.slice(cursorPositionRef.current);
              cursorPositionRef.current++;
              
              // ハイライト付きで再描画
              const highlighted = highlightCommand(currentLineRef.current);
              term.write('\r\x1b[K$ ' + highlighted);
            }
          });

          // ウィンドウリサイズ対応
          const handleResize = () => {
            if (fitAddon) {
              fitAddon.fit();
            }
          };
          window.addEventListener('resize', handleResize);
          window.visualViewport?.addEventListener('resize', handleResize);

          // クリーンアップ関数を設定
          return () => {
            cleanup = true;
            window.removeEventListener('resize', handleResize);
            window.visualViewport?.removeEventListener('resize', handleResize);
            if (term) {
              term.dispose();
            }
          };
        }
      } catch (error) {
        console.error('Failed to initialize terminal:', error);
      }
    };

    initTerminal();

    // クリーンアップ
    return () => {
      cleanup = true;
      if (term) {
        term.dispose();
      }
    };
  }, []);

  return (
    <div
      ref={terminalRef}
      style={{
        width: '100%',
        height: '100%',
      }}
    />
  );
}
