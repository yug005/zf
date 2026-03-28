# zer0friction-cli

`zer0friction-cli` is the command-line interface for Zer0Friction. It gives you a faster way to connect a workspace, inspect project health, manage monitors, create API keys, and report deploy events without opening the dashboard.

It is built for operators and developers who want:

- A guided setup flow for first-time onboarding
- Colorful, high-signal terminal output
- Interactive monitor and project creation
- Scriptable JSON output when automation matters
- A lightweight deploy reporting workflow from CI or local terminals

## Install

### From npm

```bash
npm install -g zer0friction-cli
```

### Verify the install

```bash
zf help
zf doctor
```

## Requirements

- Node.js `22+`
- A reachable Zer0Friction backend
- A Zer0Friction API key for authenticated commands

## Quick Start

Run the guided setup:

```bash
zf init
```

This flow helps you:

- Set the backend URL
- Save your API key locally
- Select a default project
- Optionally create your first monitor

Once configured, run a quick diagnostic:

```bash
zf doctor
```

## Common Commands

### Health and setup

```bash
zf init
zf doctor
zf status
zf auth whoami
```

### Project management

```bash
zf projects list
zf projects create --interactive
zf projects use --slug production
zf projects current
```

### Monitor operations

```bash
zf monitors list
zf monitors get --id <monitor-id>
zf monitors checks --id <monitor-id> --limit 20
zf monitors create --interactive
zf monitors update --id <monitor-id> --name "Checkout API"
zf monitors pause --id <monitor-id>
zf monitors resume --id <monitor-id>
zf monitors delete --id <monitor-id>
```

### API keys

```bash
zf api-keys list
zf api-keys create --name "GitHub Actions"
zf api-keys revoke --id <key-id>
```

### Deploy reporting

```bash
zf deploy report --environment production --service api
```

This is useful for correlating incidents with deploy activity directly from CI/CD pipelines.

## Configuration

The CLI stores config in:

```text
~/.zer0friction/config.json
```

Supported saved values:

- `baseUrl`
- `apiKey`
- `projectId`
- `projectName`

You can also override config with environment variables:

```bash
export ZF_BASE_URL="https://your-api.example.com"
export ZF_API_KEY="zf_xxx"
export ZF_PROJECT_ID="project_123"
```

Config commands:

```bash
zf config show
zf config get base-url
zf config set base-url https://your-api.example.com
zf config clear project-id
```

## JSON Output

Several commands support `--json` so the CLI can plug into scripts and automation:

```bash
zf doctor --json
zf status --json
zf auth whoami --json
zf projects list --json
zf monitors list --json
```

Use the human-readable UI for everyday work and `--json` when you want machine-readable output.

## Interactive Workflows

The CLI includes interactive flows for:

- `zf init`
- `zf projects create --interactive`
- `zf monitors create --interactive`

These flows are designed to be safe, guided, and fast. If you are in a non-interactive environment, pass explicit flags instead.

## Shell Completion

Generate completion scripts for supported shells:

```bash
zf completion bash
zf completion zsh
zf completion fish
zf completion powershell
```

Examples:

```bash
zf completion bash >> ~/.bashrc
zf completion zsh >> ~/.zshrc
zf completion fish > ~/.config/fish/completions/zf.fish
zf completion powershell | Out-String | Add-Content $PROFILE
```

## CI/CD Example

You can report a deployment after shipping:

```bash
zf deploy report \
  --project-slug production \
  --environment production \
  --service api \
  --provider GITHUB \
  --type DEPLOY \
  --version 2026.03.28 \
  --commit-sha "$GITHUB_SHA"
```

## Troubleshooting

If `zf doctor` fails:

- Confirm your backend URL is correct
- Confirm your API key is valid
- Confirm the backend is reachable from your terminal
- Confirm your default project still exists

If interactive commands fail:

- Make sure you are running in a real TTY shell
- Use explicit flags in CI or non-interactive sessions

## Local Development

Inside the Zer0Friction repository:

```bash
npm run cli:build
npm run cli:link
zf help
```

You can also package the CLI locally:

```bash
npm run cli:pack
```

## Positioning

The goal of `zer0friction-cli` is simple: make Zer0Friction feel fast, operational, and terminal-native. The dashboard remains great for broad visibility, while the CLI is built for quick decisions, deploy workflows, and hands-on incident response.
