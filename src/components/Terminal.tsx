import careerData from '@/data/career.json';
import { fetchGitHubActivity, formatGitHubEvent, generateCommitHash } from '@/utils/github';
import { useEffect, useRef } from 'preact/hooks';

interface TerminalProps {}

// Kanagawa Dragon テーマ定義
const kanagawaDragonTheme = {
  background: '#0d0c0c',     // dragonBlack0 - より暗い背景
  foreground: '#c5c9c5',     // dragonWhite
  cursor: '#c4746e',         // dragonRed
  cursorAccent: '#0d0c0c',   // dragonBlack0
  selectionBackground: '#2D4F67', // waveBlue2

  // ANSI Colors
  black: '#0d0c0c',          // dragonBlack0
  red: '#c4746e',            // dragonRed
  green: '#8a9a7b',          // dragonGreen2
  yellow: '#c4b28a',         // dragonYellow
  blue: '#8ba4b0',           // dragonBlue2
  magenta: '#a292a3',        // dragonPink
  cyan: '#8ea4a2',           // dragonAqua
  white: '#c5c9c5',          // dragonWhite

  // Bright ANSI Colors
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

  // プロンプトを表示
  const showPrompt = (term: any) => {
    term.write('\r\n$ ');
  };

  // テキストを出力
  const writeLine = (term: any, text: string) => {
    term.write(text + '\r\n');
  };

  // GitHub アクティビティを表示
  const displayGitHubActivity = async (term: any) => {
    const result = await fetchGitHubActivity('lcyou');
    
    if (!result.success) {
      writeLine(term, `Error: ${result.error}`);
      return;
    }
    
    if (!result.events || result.events.length === 0) {
      writeLine(term, 'No recent activity found.');
      return;
    }

    // イベントを処理
    for (const event of result.events) {
      const formattedLines = formatGitHubEvent(event);
      formattedLines.forEach(line => writeLine(term, line));
    }
  };

  // コマンドを処理
  const handleCommand = async (term: any, command: string) => {
    const trimmed = command.trim();
    
    if (!trimmed) {
      showPrompt(term);
      return;
    }

    // コマンド履歴に追加
    commandHistoryRef.current.push(trimmed);
    historyIndexRef.current = commandHistoryRef.current.length;

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        writeLine(term, '');
        writeLine(term, 'Available commands:');
        writeLine(term, '  whoami              Show profile information');
        writeLine(term, '  log --career        Show career history (git log style)');
        writeLine(term, '  log --activity      Show GitHub activity (git log style)');
        writeLine(term, '  open <page>         Navigate to page (blog, about, search)');
        writeLine(term, '  clear               Clear terminal');
        writeLine(term, '  help                Show this help message');
        writeLine(term, '');
        break;

      case 'whoami':
        writeLine(term, '');
        writeLine(term, '@lcyou');
        writeLine(term, 'Software Engineer');
        writeLine(term, '');
        writeLine(term, 'GitHub  : https://github.com/lcyou');
        writeLine(term, 'Twitter : https://twitter.com/lCyo_u');
        writeLine(term, 'Bluesky : https://bsky.app/profile/lcyou.bsky.social');
        writeLine(term, '');
        break;

      case 'log':
        if (args[0] === '--career') {
          writeLine(term, '');
          for (const item of careerData.timeline) {
            const commitHash = generateCommitHash(item.id);
            writeLine(term, `commit ${commitHash}`);
            writeLine(term, `Date:   ${item.period}`);
            writeLine(term, '');
            writeLine(term, `    ${item.title}`);
            if (item.description) {
              writeLine(term, `    ${item.description}`);
            }
            writeLine(term, '');
          }
        } else if (args[0] === '--activity') {
          writeLine(term, '');
          await displayGitHubActivity(term);
        } else {
          writeLine(term, 'Usage: log <options>');
	  writeLine(term, '');
	  writeLine(term, '--career    : ');
	  writeLine(term, '--activity  : ');
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
          writeLine(term, `Opening ${page}...`);
          setTimeout(() => {
            window.location.href = routes[page];
          }, 500);
        } else {
          writeLine(term, 'Usage: open <page>');
          writeLine(term, 'Available pages: blog, about, search');
        }
        break;

      case 'clear':
        term.clear();
        showPrompt(term);
        return;

      default:
        writeLine(term, `bash: ${cmd}: command not found`);
        break;
    }

    showPrompt(term);
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    let term: any;
    let fitAddon: any;
    let cleanup = false;

    // 動的にxterm.jsをインポート
    const initTerminal = async () => {
      try {
        // xterm.js と addon を動的インポート
        const xtermModule = await import('@xterm/xterm');
        const fitAddonModule = await import('@xterm/addon-fit');
        await import('@xterm/xterm/css/xterm.css');

        if (cleanup) return;

        const { Terminal: XTerm } = xtermModule;
        const { FitAddon } = fitAddonModule;

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

        if (terminalRef.current) {
          term.open(terminalRef.current);
          fitAddon.fit();

          xtermRef.current = term;
          fitAddonRef.current = fitAddon;

          // ウェルカムメッセージ
          writeLine(term, "Welcome to lcyou's blog terminal!");
          writeLine(term, "Type 'help' to see available commands.");
          showPrompt(term);

          // キー入力処理
          term.onData((data: string) => {
            const code = data.charCodeAt(0);

            // Enter
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
                term.write('\b \b');
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
                
                // 現在の行をクリア
                term.write('\r\x1b[K$ ');
                term.write(historicalCommand);
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
                
                // 現在の行をクリア
                term.write('\r\x1b[K$ ');
                term.write(historicalCommand);
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
              term.write(data);
            }
          });

          // ウィンドウリサイズ対応
          const handleResize = () => {
            if (fitAddon) {
              fitAddon.fit();
            }
          };
          window.addEventListener('resize', handleResize);

          // クリーンアップ関数を設定
          return () => {
            cleanup = true;
            window.removeEventListener('resize', handleResize);
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
