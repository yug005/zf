type ShellName = 'bash' | 'zsh' | 'fish' | 'powershell';

const COMMANDS = {
  init: ['--base-url', '--api-key', '--non-interactive'],
  status: ['--base-url', '--json'],
  config: ['show', 'get', 'set', 'clear'],
  auth: ['login', 'whoami'],
  projects: ['list', 'create', 'use', 'current'],
  'api-keys': ['list', 'create', 'revoke'],
  monitors: ['list', 'get', 'checks', 'create', 'update', 'pause', 'resume', 'delete'],
  deploy: ['report'],
  completion: ['bash', 'zsh', 'fish', 'powershell'],
  help: [],
} satisfies Record<string, string[]>;

const GLOBAL_OPTIONS = ['--help', '--json'];

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
    .map(
      ([command, values]) =>
        `    ${command}) COMPREPLY=( $(compgen -W "${values.join(' ')} ${GLOBAL_OPTIONS.join(' ')}" -- "$cur") ) ;;`,
    )
    .join('\n');
  return `# Zer0Friction bash completion
_zf_completion() {
  local cur prev words cword
  _init_completion || return

  local commands="${topLevel}"

  if [[ \$cword -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
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
  const commands = Object.keys(COMMANDS)
    .map((command) => `'${command}:${command}'`)
    .join(' ');
  const cases = Object.entries(COMMANDS)
    .map(([command, values]) => {
      const valuesSpec = values.map((value) => `'${value}:${value}'`).join(' ');
      return `${command})
      _values 'zf ${command}' ${valuesSpec}
      ;;
`;
    })
    .join('');

  return `#compdef zf

local -a commands
commands=(${commands})

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

  for (const [command, values] of Object.entries(COMMANDS)) {
    for (const value of values) {
      lines.push(`complete -c zf -f -n "__fish_seen_subcommand_from ${command}" -a "${value}"`);
    }
  }

  return `# Zer0Friction fish completion
${lines.join('\n')}
`;
}

function renderPowerShellCompletion(): string {
  const commandCases = Object.entries(COMMANDS)
    .map(([command, values]) => {
      const resultValues = values
        .map(
          (value) =>
            `[System.Management.Automation.CompletionResult]::new('${value}','${value}','ParameterValue','${value}')`,
        )
        .join(",\n          ");

      return `      '${command}' {
        return @(
          ${resultValues || ''}
        )
      }`;
    })
    .join('\n');

  const topLevel = Object.keys(COMMANDS)
    .map(
      (command) =>
        `[System.Management.Automation.CompletionResult]::new('${command}','${command}','ParameterValue','${command}')`,
    )
    .join(",\n        ");

  return `Register-ArgumentCompleter -Native -CommandName zf -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)

  $words = $commandAst.CommandElements | ForEach-Object { $_.Extent.Text }
  if ($words.Count -le 2) {
    return @(
        ${topLevel}
    ) | Where-Object { $_.CompletionText -like "$wordToComplete*" }
  }

  switch ($words[1]) {
${commandCases}
    default { return @() }
  }
}
`;
}
