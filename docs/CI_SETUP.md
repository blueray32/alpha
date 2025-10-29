# CI/CD Setup Guide

## Overview

Alpha uses GitHub Actions for continuous integration and merge gates. All pull requests must pass automated tests before merging.

## CI Pipeline

The CI pipeline (`.github/workflows/ci.yml`) runs on:
- All pull requests to `master`/`main`
- All pushes to `master`/`main`

### Pipeline Steps

1. **Checkout & Setup**: Clones repo and sets up Node.js 20
2. **Install Dependencies**: Runs `npm ci` for clean install
3. **Install Playwright**: Installs Chromium browser for E2E tests
4. **Linting**: Runs `npm run lint` to check code style
5. **Unit Tests**: Runs `npm test` (vitest)
6. **E2E Tests**: Runs `npm run test:e2e` (smoke tests)
7. **Build**: Runs `npm run build` to verify TypeScript compiles
8. **Upload Artifacts**: Saves test results for review

## Setting Up Branch Protection

To enforce the merge gate on GitHub:

### Step 1: Navigate to Settings

1. Go to your repository on GitHub
2. Click **Settings** tab
3. Click **Branches** in the left sidebar

### Step 2: Add Branch Protection Rule

1. Click **Add rule** or **Add branch protection rule**
2. Enter branch name pattern: `master` (or `main`)

### Step 3: Configure Protection Rules

Enable these settings:

✅ **Require a pull request before merging**
- Require approvals: 0 (or 1+ for team review)
- Dismiss stale pull request approvals when new commits are pushed

✅ **Require status checks to pass before merging**
- Require branches to be up to date before merging
- Add status check: `Test & Validate` (the CI job name)

✅ **Do not allow bypassing the above settings**
- Applies to administrators too (recommended)

### Step 4: Optional Settings

Consider enabling:
- **Require conversation resolution before merging**
- **Require signed commits**
- **Require linear history**

## Testing the CI Locally

Before pushing, you can run the same checks locally:

```bash
# Run linting
npm run lint

# Run unit tests
npm test

# Run E2E smoke tests
npm run test:e2e

# Build project
npm run build
```

All commands should pass before committing.

## CI Failure Handling

If the CI fails:

1. **Check the GitHub Actions tab** to see which step failed
2. **Download artifacts** to inspect test results/screenshots
3. **Fix the issue locally** and verify with local tests
4. **Push the fix** - CI will automatically re-run

## Smoke Tests

The E2E smoke tests (`tests/e2e/smoke.test.ts`) validate:

1. ✅ ValidationRunner initialization
2. ✅ YAML flow parsing
3. ✅ Contract Guard enforcement
4. ✅ Model Discovery (with/without API keys)

These tests run in CI without requiring external services or API keys.

## Status Badge

Add this to your README to show CI status:

```markdown
![CI](https://github.com/YOUR_USERNAME/alpha/actions/workflows/ci.yml/badge.svg)
```

Replace `YOUR_USERNAME` with your GitHub username.

## Troubleshooting

### Playwright Installation Fails

If Playwright browser installation fails in CI:

```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium
```

The `--with-deps` flag ensures system dependencies are installed.

### Tests Pass Locally But Fail in CI

Common causes:
- **Environment differences**: Check Node.js version matches (20.x)
- **Dependencies**: Use `npm ci` instead of `npm install`
- **Timing issues**: Add appropriate waits in E2E tests
- **Missing files**: Ensure all files are committed

### Build Fails in CI

Check:
- **TypeScript errors**: Run `npm run build` locally
- **Missing dependencies**: Ensure `package-lock.json` is committed
- **Import paths**: Use `.js` extensions for ES modules

## Next Steps

Once CI is set up:

1. **Create a test PR** to verify the merge gate works
2. **Try pushing a failing commit** (intentionally break a test) to verify blocking
3. **Fix the issue** and verify the PR becomes mergeable again

This ensures your merge gate is working correctly before relying on it for production.
