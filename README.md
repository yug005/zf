# Zer0Friction

Zer0Friction is a full-stack uptime monitoring app with:

- NestJS backend API
- React + Vite frontend
- PostgreSQL via Prisma
- Redis + BullMQ for background jobs

## Prerequisites

- Node.js 22+
- npm 10+
- Docker Desktop running locally

## Quick Start

1. Create your local env file:

```powershell
Copy-Item .env.example .env
```

2. Install backend dependencies:

```powershell
npm install
```

3. Install frontend dependencies:

```powershell
npm --prefix frontend install
```

4. Start PostgreSQL and Redis:

```powershell
npm run infra:up
```

5. Apply the Prisma migration:

```powershell
npm run prisma:migrate
```

6. Start backend and frontend together:

```powershell
npm run dev
```

## Local URLs

- Frontend: http://localhost:5173
- API: http://localhost:3000
- Health check: http://localhost:3000/health

## Local Admin

If `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set in `.env`, the backend will upsert that account on startup, give it unlimited monitor usage, and hide billing checkout in the UI.

## Useful Scripts

```powershell
npm run dev            # backend + frontend
npm run start:dev      # backend only
npm run frontend:dev   # frontend only
npm run prisma:migrate # apply database migrations
npm run infra:up       # start postgres + redis
npm run infra:down     # stop docker services
```

## CLI

Zer0Friction also ships with a terminal CLI from [`cli`](E:/zer0Friction/cli).

Build it:

```powershell
npm run cli:build
```

Run it from the repo:

```powershell
node cli/dist/index.js help
node cli/dist/index.js doctor
node cli/dist/index.js init
node cli/dist/index.js monitors list
```

Install it globally on your machine with npm link:

```powershell
npm run cli:link
zf help
```

Create a tarball package:

```powershell
npm run cli:pack
```

Shell completions:

```powershell
zf completion powershell | Out-String | Add-Content $PROFILE
zf completion bash >> ~/.bashrc
zf completion zsh >> ~/.zshrc
zf completion fish > ~/.config/fish/completions/zf.fish
```

## GitHub Deploy Automation

Zer0Friction can automatically record deploy changes so you do not need to fill the `Changes` page manually.

What is already built:

- API endpoint: `POST /api/v1/changes/ingest/deploy`
- GitHub-ready payload support
- deploy deduping with `externalId`
- change-to-incident correlation after deploys are reported

What you still need to do:

1. Add these GitHub repository secrets:
   - `ZER0FRICTION_BACKEND_URL`
   - `ZER0FRICTION_API_KEY`
   - `ZER0FRICTION_PROJECT_SLUG`
2. Optionally add these GitHub repository variables:
   - `ZER0FRICTION_SERVICE_NAME`
   - `ZER0FRICTION_ENVIRONMENT`
3. Use the workflow in [report-zer0friction-deploy.yml](E:/zer0Friction/.github/workflows/report-zer0friction-deploy.yml)

How it works:

1. A push to `main` or a manual workflow run happens in GitHub
2. GitHub sends deploy metadata to Zer0Friction
3. Zer0Friction stores it as a change event
4. If a monitor fails near that deploy, the app can mark it as a likely trigger

Important:

- Zer0Friction does not pull changes from GitHub by itself yet
- GitHub must send the deploy event using the workflow automation above
- Once that workflow is configured, deploy reporting becomes automatic

Detailed setup guide:

- [GitHub Deploy Automation Setup](E:/zer0Friction/GITHUB_DEPLOY_AUTOMATION.md)

## Troubleshooting

- The local Docker database uses `postgres:yugYUG123`, so make sure your `DATABASE_URL` matches `.env.example`.
- If `npm run dev` fails, confirm ports `3000`, `5173`, `5432`, and `6379` are free.
- Redis and PostgreSQL must be running before the backend can boot.
- Billing and notification environment variables are optional for basic local startup.

## Verified Local Startup

The following worked in this workspace on March 19, 2026:

```powershell
npm run infra:up
npm run prisma:migrate
npm run dev
```

After that:

- `http://localhost:3000/health` returned `200 OK`
- `http://localhost:5173` returned the Vite app
