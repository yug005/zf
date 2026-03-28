# zer0friction-cli

Production-ready command line tooling for Zer0Friction.

`zer0friction-cli` gives teams a fast terminal interface for connecting a workspace, inspecting health, creating monitors, managing API keys, and reporting deploys without bouncing through the web UI for every operational task.

It is designed for engineers who want:

- Fast setup with guided onboarding
- Clear, high-signal terminal output instead of raw JSON by default
- Scriptable automation when JSON output is needed
- Monitor and project management from a terminal
- Deploy reporting that fits naturally into CI/CD workflows

## Why this exists

Dashboards are great for visibility. Operators still need fast actions.

The Zer0Friction CLI is built to make common workflows feel immediate:

- bring a new workspace online
- validate auth and backend connectivity
- create monitors with guided prompts
- inspect monitor state and recent checks
- manage API keys safely
- report deploy events from CI or local terminals

## Install

```bash
npm install -g zer0friction-cli
```

Verify the install:

```bash
zf help
zf doctor
```

## Requirements

- Node.js `22+`
- A reachable Zer0Friction backend
- A Zer0Friction API key for authenticated commands

## First run

The fastest way to get started is the guided setup:

```bash
zf init
```

This flow helps you:

- set your backend URL
- save your API key locally
- choose a default project
- optionally create your first monitor

After setup, validate the environment:

```bash
zf doctor
```

## What it can do

### Workspace and connectivity

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

### API key management

```bash
zf api-keys list
zf api-keys create --name "GitHub Actions"
zf api-keys revoke --id <key-id>
```

### Deploy reporting

```bash
zf deploy report --environment production --service api
```

This is especially useful for change tracking and incident correlation from CI/CD systems.

## Quick examples

Create and connect your CLI profile:

```bash
zf init
```

Switch the default project:

```bash
zf projects use --slug production
```

Create a monitor interactively:

```bash
zf monitors create --interactive
```

Inspect recent checks:

```bash
zf monitors checks --id <monitor-id> --limit 20
```

Report a deploy from the terminal:

```bash
zf deploy report \
  --project-slug production \
  --environment production \
  --service api \
  --provider GITHUB \
  --type DEPLOY
```

## Configuration

The CLI stores its local config at:

```text
~/.zer0friction/config.json
```

Saved fields:

- `baseUrl`
- `apiKey`
- `projectId`
- `projectName`

You can inspect or update config directly:

```bash
zf config show
zf config get base-url
zf config set base-url https://your-api.example.com
zf config clear project-id
```

## Environment variable overrides

You can override saved config for local shells, CI jobs, or one-off runs:

```bash
export ZF_BASE_URL="https://your-api.example.com"
export ZF_API_KEY="zf_xxx"
export ZF_PROJECT_ID="project_123"
```

Supported environment variables:

- `ZF_BASE_URL`
- `ZF_API_KEY`
- `ZF_PROJECT_ID`

## Interactive workflows

The CLI includes guided flows for:

- `zf init`
- `zf projects create --interactive`
- `zf monitors create --interactive`

These flows are optimized for humans.

If you are in CI or another non-interactive environment, pass explicit flags instead.

## JSON output for automation

Human-readable output is the default, but several commands support `--json` for scripts and integrations:

```bash
zf doctor --json
zf status --json
zf auth whoami --json
zf projects list --json
zf monitors list --json
```

Use this when the CLI becomes part of a pipeline, a script, or another tool.

## Shell completion

Generate completions for supported shells:

```bash
zf completion bash
zf completion zsh
zf completion fish
zf completion powershell
```

Install examples:

```bash
zf completion bash >> ~/.bashrc
zf completion zsh >> ~/.zshrc
zf completion fish > ~/.config/fish/completions/zf.fish
zf completion powershell | Out-String | Add-Content $PROFILE
```

## CI/CD usage

The CLI works well in deployment pipelines. Example:

```bash
zf deploy report \
  --project-slug production \
  --environment production \
  --service api \
  --provider GITHUB \
  --type DEPLOY \
  --version "$GITHUB_SHA" \
  --commit-sha "$GITHUB_SHA"
```

Typical uses in automation:

- report deploys after shipping
- validate connectivity with `zf doctor --json`
- inspect workspace state in support or ops scripts

## Troubleshooting

If `zf doctor` fails:

- confirm the backend URL is correct
- confirm the API key is valid
- confirm the backend is reachable from your network
- confirm the selected project still exists

If interactive prompts fail:

- make sure you are running in a real TTY shell
- use explicit flags in CI or other non-interactive environments

If the CLI authenticates but commands fail:

- run `zf config show`
- verify the saved base URL and project
- re-run `zf init` if needed

## Upgrade and reinstall

Update to the latest published version:

```bash
npm install -g zer0friction-cli@latest
```

Verify the updated build:

```bash
zf help
zf doctor
```

## Local development

Inside the Zer0Friction repository:

```bash
npm run cli:build
npm run cli:link
zf help
```

Create a local tarball:

```bash
npm run cli:pack
```

## Product philosophy

The Zer0Friction dashboard remains the broad operational view.

`zer0friction-cli` is the action surface:

- faster than clicking through pages
- easier to automate than browser flows
- easier to use under pressure during incidents

If you like terminals, the CLI should feel like the natural front door to Zer0Friction.
