# GitHub Deploy Automation Setup

Use this guide when you want GitHub to report deploys to Zer0Friction automatically so you do not need to fill the `Changes` page manually.

## What This Gives You

After this setup:

1. A push to `main` or a manual workflow run happens in GitHub
2. GitHub sends deploy metadata to Zer0Friction
3. Zer0Friction stores it as a change event
4. If a monitor fails soon after, Zer0Friction can show that deploy as a likely trigger

## Before You Start

Make sure:

- your Zer0Friction backend is reachable from GitHub
- you already have a project created inside Zer0Friction
- you have an API key from Zer0Friction
- your repo contains the workflow file at [.github/workflows/report-zer0friction-deploy.yml](E:/zer0Friction/.github/workflows/report-zer0friction-deploy.yml)

## Step 1: Find Your Project Slug

Inside Zer0Friction, open the project you want deploys to be attached to and note its slug.

Example:

- project name: `Marketing Website`
- project slug: `marketing-website`

You will use that slug in GitHub as `ZER0FRICTION_PROJECT_SLUG`.

## Step 2: Create an API Key

Inside Zer0Friction:

1. open `API Keys`
2. create a new key for GitHub automation
3. copy the key value

You will use that in GitHub as `ZER0FRICTION_API_KEY`.

## Step 3: Add GitHub Repository Secrets

In your GitHub repository:

1. open `Settings`
2. open `Secrets and variables`
3. open `Actions`
4. add these repository secrets:

- `ZER0FRICTION_BACKEND_URL`
  Example: `https://api.yourdomain.com`
- `ZER0FRICTION_API_KEY`
  Example: the API key you created in Zer0Friction
- `ZER0FRICTION_PROJECT_SLUG`
  Example: `marketing-website`

## Step 4: Add Optional Repository Variables

These are optional but helpful because they make the deploy history cleaner.

Add these repository variables in GitHub:

- `ZER0FRICTION_SERVICE_NAME`
  Example: `Marketing Website`
- `ZER0FRICTION_ENVIRONMENT`
  Example: `production`

If you skip them, the workflow still works and uses sensible defaults.

## Step 5: Commit the Workflow

Make sure this file exists in your repo:

- [.github/workflows/report-zer0friction-deploy.yml](E:/zer0Friction/.github/workflows/report-zer0friction-deploy.yml)

Once it is committed:

- pushes to `main` will report deploys automatically
- you can also run it manually from the GitHub Actions tab

## How To Test It

Use either of these:

### Option A: Manual Test

1. open your GitHub repo
2. go to `Actions`
3. open `Report Deploy To Zer0Friction`
4. click `Run workflow`

Then check Zer0Friction:

1. open `/changes`
2. confirm a new deploy event appears

### Option B: Real Push Test

1. push a commit to `main`
2. wait for the GitHub workflow to run
3. open Zer0Friction `/changes`
4. confirm the deploy appears automatically

## What You Should Expect In Zer0Friction

The recorded deploy event can include:

- provider: `GITHUB`
- project slug/project
- repository
- branch
- commit SHA
- version
- environment
- external id from GitHub Actions

If a monitor fails soon after that deploy, the `Change Intelligence` section can use it as a likely trigger.

## Troubleshooting

### No deploy appears in Zer0Friction

Check:

- `ZER0FRICTION_BACKEND_URL` is correct
- backend is publicly reachable
- `ZER0FRICTION_API_KEY` is valid
- `ZER0FRICTION_PROJECT_SLUG` matches a real Zer0Friction project
- the GitHub Actions run did not fail

### Workflow fails with 401 or 403

This usually means:

- API key is invalid
- API key was revoked
- the request is hitting the wrong backend URL

### Workflow succeeds but event is attached to the wrong project

This usually means:

- `ZER0FRICTION_PROJECT_SLUG` is wrong

## Important Note

This is automation-based integration, not a native GitHub app.

That means:

- GitHub sends deploy data to Zer0Friction
- Zer0Friction does not pull GitHub changes by itself yet

That is still enough to make deploy tracking automatic in normal use.
