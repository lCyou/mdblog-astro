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
  
  lines.push(`commit ${commitHash}`);
  lines.push(`Date:   ${date}`);
  lines.push('');

  switch (event.type) {
    case 'PushEvent':
      const commitCount = event.payload.commits?.length || 0;
      lines.push(`    [PushEvent] ${event.repo.name}`);
      lines.push(`    ${event.payload.ref || 'refs/heads/main'} – ${commitCount} commit(s)`);
      break;
    
    case 'PullRequestEvent':
      const action = event.payload.action || 'opened';
      const prTitle = event.payload.pull_request?.title || 'Pull Request';
      lines.push(`    [PullRequestEvent] ${event.repo.name}`);
      lines.push(`    ${action}: "${prTitle}"`);
      break;
    
    case 'IssuesEvent':
      const issueAction = event.payload.action || 'opened';
      const issueTitle = event.payload.issue?.title || 'Issue';
      lines.push(`    [IssuesEvent] ${event.repo.name}`);
      lines.push(`    ${issueAction}: "${issueTitle}"`);
      break;
    
    case 'CreateEvent':
      const refType = event.payload.ref_type || 'branch';
      const ref = event.payload.ref || 'main';
      lines.push(`    [CreateEvent] ${event.repo.name}`);
      lines.push(`    created ${refType}: ${ref}`);
      break;
    
    default:
      lines.push(`    [${event.type}] ${event.repo.name}`);
  }
  
  lines.push('');
  return lines;
}
