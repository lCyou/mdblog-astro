/**
 * GitHubイベントの型定義
 */
export interface GitHubEvent {
  id: string;
  type: 'PushEvent' | 'PullRequestEvent' | 'IssuesEvent' | 'CreateEvent' | string;
  created_at: string;
  repo: {
    name: string;
  };
  payload: {
    commits?: Array<{ sha: string; message: string }>;
    pull_request?: { title: string; state: string };
    issue?: { title: string };
    ref?: string;
    ref_type?: string;
    action?: string;
  };
}

/**
 * GitHubアクティビティ取得結果
 */
export interface GitHubActivityResult {
  success: boolean;
  events?: GitHubEvent[];
  error?: string;
}

/**
 * ANSI色コードユーティリティ
 */
const ANSI = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  white: '\x1b[97m',
};

/**
 * 色付きテキストを生成するヘルパー
 */
const colorize = (text: string, color: string) => `${color}${text}${ANSI.reset}`;


/**
 * GitHubの公開アクティビティを取得
 * @param username GitHubユーザー名
 * @returns アクティビティ取得結果
 */
export async function fetchGitHubActivity(username: string): Promise<GitHubActivityResult> {
  try {
    const response = await fetch(`https://api.github.com/users/${username}/events/public`);
    
    if (!response.ok) {
      if (response.status === 403) {
        return {
          success: false,
          error: 'GitHub API rate limit exceeded. Please try again later.',
        };
      }
      return {
        success: false,
        error: `HTTP ${response.status}: Failed to fetch GitHub activity.`,
      };
    }

    const events = await response.json();
    
    if (!Array.isArray(events) || events.length === 0) {
      return {
        success: true,
        events: [],
      };
    }

    return {
      success: true,
      events: events.slice(0, 10), // 最新10件のみ
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to fetch GitHub activity. Please check your connection.',
    };
  }
}

/**
 * ランダムなコミットハッシュを生成（表示用）
 * @param seed シード文字列
 * @returns 7文字のハッシュ
 */
export function generateCommitHash(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).substring(0, 7).padStart(7, '0');
}

/**
 * GitHubイベントをgit log風のフォーマットに変換
 * @param event GitHubイベント
 * @returns フォーマット済み文字列の配列
 */
export function formatGitHubEvent(event: GitHubEvent): string[] {
  const lines: string[] = [];
  const commitHash = generateCommitHash(event.id);
  const date = new Date(event.created_at).toISOString().split('T')[0];
  
  lines.push(`${colorize('commit', ANSI.yellow)} ${colorize(commitHash, ANSI.brightYellow)}`);
  lines.push(`${colorize('Date:', ANSI.blue)}   ${colorize(date, ANSI.white)}`);
  lines.push('');

  switch (event.type) {
    case 'PushEvent':
      const commitCount = event.payload.commits?.length || 0;
      lines.push(`    ${colorize('[PushEvent]', ANSI.brightGreen)} ${colorize(event.repo.name, ANSI.cyan)}`);
      lines.push(`    ${colorize(event.payload.ref || 'refs/heads/main', ANSI.gray)} – ${colorize(`${commitCount} commit(s)`, ANSI.white)}`);
      break;
    
    case 'PullRequestEvent':
      const action = event.payload.action || 'opened';
      const prTitle = event.payload.pull_request?.title || 'Pull Request';
      lines.push(`    ${colorize('[PullRequestEvent]', ANSI.brightMagenta)} ${colorize(event.repo.name, ANSI.cyan)}`);
      lines.push(`    ${colorize(action, ANSI.yellow)}: "${colorize(prTitle, ANSI.white)}"`);
      break;
    
    case 'IssuesEvent':
      const issueAction = event.payload.action || 'opened';
      const issueTitle = event.payload.issue?.title || 'Issue';
      lines.push(`    ${colorize('[IssuesEvent]', ANSI.brightBlue)} ${colorize(event.repo.name, ANSI.cyan)}`);
      lines.push(`    ${colorize(issueAction, ANSI.yellow)}: "${colorize(issueTitle, ANSI.white)}"`);
      break;
    
    case 'CreateEvent':
      const refType = event.payload.ref_type || 'branch';
      const ref = event.payload.ref || 'main';
      lines.push(`    ${colorize('[CreateEvent]', ANSI.brightCyan)} ${colorize(event.repo.name, ANSI.cyan)}`);
      lines.push(`    ${colorize('created', ANSI.green)} ${colorize(refType, ANSI.yellow)}: ${colorize(ref, ANSI.white)}`);
      break;
    
    default:
      lines.push(`    ${colorize(`[${event.type}]`, ANSI.gray)} ${colorize(event.repo.name, ANSI.cyan)}`);
  }
  
  lines.push('');
  return lines;
}
