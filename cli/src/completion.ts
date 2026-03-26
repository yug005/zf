type ShellName = 'bash' | 'zsh' | 'fish' | 'powershell';

type CommandSpec = {
  options?: string[];
  subcommands?: Record<string, { options?: string[] }>;
};

const GLOBAL_OPTIONS = ['--help', '--json'];
const CONFIG_KEYS = ['base-url', 'api-key', 'project-id'];

const COMMANDS: Record<string, CommandSpec> = {
  init: { options: ['--base-url', '--api-key', '--non-interactive'] },
  doctor: { options: ['--base-url', '--json'] },
  status: { options: ['--base-url', '--json'] },
  config: {
    subcommands: {
      show: { options: ['--json'] },
      get: { options: CONFIG_KEYS },
      set: { options: CONFIG_KEYS },
      clear: { options: CONFIG_KEYS },
    },
  },
  auth: {
    subcommands: {
      login: { options: ['--base-url', '--api-key'] },
      whoami: { options: ['--json'] },
    },
  },
  projects: {
    subcommands: {
      list: { options: ['--json'] },
      create: { options: ['--name', '--slug', '--description', '--json'] },
      use: { options: ['--id', '--slug'] },
      current: { options: [] },
    },
  },
  'api-keys': {
    subcommands: {
      list: { options: ['--json'] },
      create: { options: ['--name', '--json'] },
      revoke: { options: ['--id'] },
    },
  },
  monitors: {
    subcommands: {
      list: { options: ['--project-id', '--json'] },
      get: { options: ['--id', '--json'] },
      checks: { options: ['--id', '--limit', '--json'] },
      create: {
        options: [
          '--project-id',
          '--name',
          '--url',
          '--type',
          '--method',
          '--interval',
          '--timeout',
          '--expected-status',
          '--retries',
          '--service',
          '--feature',
          '--journey',
          '--owner',
          '--region',
          '--business-criticality',
          '--sla-tier',
          '--headers',
          '--body',
          '--interactive',
          '--json',
        ],
      },
      update: {
        options: [
          '--id',
          '--name',
          '--url',
          '--type',
          '--method',
          '--interval',
          '--timeout',
          '--expected-status',
          '--retries',
          '--service',
          '--feature',
          '--journey',
          '--owner',
          '--region',
          '--business-criticality',
          '--sla-tier',
          '--headers',
          '--body',
          '--json',
        ],
      },
      pause: { options: ['--id'] },
      resume: { options: ['--id'] },
      delete: { options: ['--id', '--force'] },
    },
  },
  deploy: {
    subcommands: {
      report: {
        options: [
          '--project-id',
          '--project-slug',
          '--monitor-id',
          '--provider',
          '--type',
          '--title',
          '--summary',
          '--service',
          '--environment',
          '--version',
          '--external-id',
          '--repository',
          '--branch',
          '--commit-sha',
          '--deployment-id',
          '--deployment-url',
          '--happened-at',
          '--watch-window',
          '--metadata',
          '--json',
        ],
      },
    },
  },
  completion: {
    subcommands: {
      bash: {},
      zsh: {},
      fish: {},
      powershell: {},
    },
  },
  help: {},
};

export function isSupportedShell(value: string): value is ShellName {
  return value === 'bash' || value === 'zsh' || value === 'fish' || value === 'powershell';
}

export function renderCompletion(shell: ShellName): string {
  switch (shell) {
    case 'bash':
      return renderBashCompletion();
    case 'zsh':
      return renderZshCompletion();
    case 'fish':
      return renderFishCompletion();
    case 'powershell':
      return renderPowerShellCompletion();
  }
}

export function renderInstallHint(shell: ShellName): string {
  switch (shell) {
    case 'bash':
      return 'Run `zf completion bash >> ~/.bashrc` and restart the shell.';
    case 'zsh':
      return 'Run `zf completion zsh >> ~/.zshrc` and restart the shell.';
    case 'fish':
      return 'Run `zf completion fish > ~/.config/fish/completions/zf.fish`.';
    case 'powershell':
      return 'Run `zf completion powershell | Out-String | Add-Content $PROFILE`, then reopen PowerShell.';
  }
}

function renderBashCompletion(): string {
  const topLevel = Object.keys(COMMANDS).join(' ');
  const cases = Object.entries(COMMANDS)
    .map(([command, spec]) => {
      const subcommands = Object.keys(spec.subcommands || {});
      const options = unique(spec.options || []);
      const subcommandCases = Object.entries(spec.subcommands || {})
        .map(
          ([subcommand, subSpec]) =>
            `      ${subcommand}) COMPREPLY=( $(compgen -W "${unique([...(subSpec.options || []), ...GLOBAL_OPTIONS]).join(' ')}" -- "$cur") ) ;;`,
        )
        .join('\n');
      const topLevelValues = unique([...subcommands, ...options, ...GLOBAL_OPTIONS]).join(' ');
      const fallbackValues = unique([...options, ...GLOBAL_OPTIONS]).join(' ');
      const nestedCase = subcommandCases
        ? `      case "\${words[2]}" in
${subcommandCases}
        *)
          COMPREPLY=( $(compgen -W "${fallbackValues}" -- "$cur") )
          ;;
      esac`
        : `      COMPREPLY=( $(compgen -W "${fallbackValues}" -- "$cur") )`;

      return `    ${command})
      if [[ \$cword -eq 2 ]]; then
        COMPREPLY=( $(compgen -W "${topLevelValues}" -- "$cur") )
        return
      fi
${nestedCase}
      ;;`;
    })
    .join('\n');

  return `# Zer0Friction bash completion
_zf_completion() {
  local cur prev words cword
  _init_completion || return

  if [[ \$cword -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "${topLevel}" -- "$cur") )
    return
  fi

  case "\${words[1]}" in
${cases}
    *)
      COMPREPLY=( $(compgen -W "${GLOBAL_OPTIONS.join(' ')}" -- "$cur") )
      ;;
  esac
}

complete -F _zf_completion zf
`;
}

function renderZshCompletion(): string {
  const topLevel = Object.keys(COMMANDS)
    .map((command) => `'${command}:${command}'`)
    .join(' ');
  const cases = Object.entries(COMMANDS)
    .map(([command, spec]) => {
      const commandEntries = unique([
        ...Object.keys(spec.subcommands || {}),
        ...(spec.options || []),
        ...GLOBAL_OPTIONS,
      ])
        .map((value) => `'${value}:${value}'`)
        .join(' ');
      return `  ${command})
    _values 'zf ${command}' ${commandEntries}
    ;;
`;
    })
    .join('');

  return `#compdef zf

local -a commands
commands=(${topLevel})

if (( CURRENT == 2 )); then
  _describe 'command' commands
  return
fi

case "$words[2]" in
${cases}  *)
    _arguments '*: :(${GLOBAL_OPTIONS.join(' ')})'
    ;;
esac
`;
}

function renderFishCompletion(): string {
  const lines = Object.keys(COMMANDS).map(
    (command) => `complete -c zf -f -n "__fish_use_subcommand" -a "${command}"`,
  );

  for (const [command, spec] of Object.entries(COMMANDS)) {
    for (const option of spec.options || []) {
      lines.push(`complete -c zf -f -n "__fish_seen_subcommand_from ${command}" -a "${option}"`);
    }
    for (const [subcommand, subSpec] of Object.entries(spec.subcommands || {})) {
      lines.push(`complete -c zf -f -n "__fish_seen_subcommand_from ${command}" -a "${subcommand}"`);
      for (const option of subSpec.options || []) {
        lines.push(`complete -c zf -f -n "__fish_seen_subcommand_from ${subcommand}" -a "${option}"`);
      }
    }
  }

  return `# Zer0Friction fish completion
${lines.join('\n')}
`;
}

function renderPowerShellCompletion(): string {
  const topLevel = Object.keys(COMMANDS)
    .map(
      (command) =>
        `[System.Management.Automation.CompletionResult]::new('${command}','${command}','ParameterValue','${command}')`,
    )
    .join(",\n        ");

  const cases = Object.entries(COMMANDS)
    .map(([command, spec]) => {
      const entries = unique([
        ...Object.keys(spec.subcommands || {}),
        ...(spec.options || []),
        ...GLOBAL_OPTIONS,
      ]);
      const valueList = entries
        .map(
          (value) =>
            `[System.Management.Automation.CompletionResult]::new('${value}','${value}','ParameterValue','${value}')`,
        )
        .join(",\n          ");

      return `      '${command}' {
        return @(
          ${valueList}
        )
      }`;
    })
    .join('\n');

  return `Register-ArgumentCompleter -Native -CommandName zf -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)

  $words = $commandAst.CommandElements | ForEach-Object { $_.Extent.Text }
  if ($words.Count -le 2) {
    return @(
        ${topLevel}
    ) | Where-Object { $_.CompletionText -like "$wordToComplete*" }
  }

  switch ($words[1]) {
${cases}
    default { return @() }
  }
}
`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
