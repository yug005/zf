import { execFileSync } from 'node:child_process';

type GitSnapshot = {
  branch?: string;
  commitSha?: string;
  repository?: string;
};

export function detectGitSnapshot(cwd = process.cwd()): GitSnapshot {
  return {
    branch: tryGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd),
    commitSha: tryGit(['rev-parse', 'HEAD'], cwd),
    repository: normalizeRepositoryUrl(tryGit(['remote', 'get-url', 'origin'], cwd)),
  };
}

function tryGit(args: string[], cwd: string): string | undefined {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

function normalizeRepositoryUrl(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  if (value.startsWith('git@github.com:')) {
    return `https://github.com/${value.slice('git@github.com:'.length).replace(/\.git$/, '')}`;
  }
  return value.replace(/\.git$/, '');
}
