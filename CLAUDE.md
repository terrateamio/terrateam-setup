# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Terrateam GitHub App setup wizard - a Node.js monorepo application built with a modified Probot framework (v12.3.0). It guides users through creating and configuring a GitHub App for Terrateam, a GitOps orchestration engine for infrastructure-as-code tools (Terraform, OpenTofu, CDKTF, Terragrunt, and Pulumi).

## Development Commands

```bash
# Install dependencies
npm install

# Start the application (runs on port 3000 by default)
npm start

# Development mode - bypasses GitHub App creation flow and uses mock OAuth
TERRATEAM_DEV_MODE=true npm start

# Production mode - requires GitHub OAuth credentials
GITHUB_CLIENT_ID=your_client_id GITHUB_CLIENT_SECRET=your_secret npm start

# Direct access to success page in dev mode
# Visit http://localhost:3000/probot/dev

# Working in the Probot package
cd packages/probot
npm run build      # Compile TypeScript to JavaScript (lib/ directory)
npm run test       # Run Jest tests (includes pretest TypeScript compilation)
npm run lint       # Check code formatting with Prettier
npm run lint:fix   # Auto-fix formatting issues
npm run pretest    # TypeScript compilation check without emitting files
npm run doc        # Generate TypeDoc documentation
```

## Architecture

**Monorepo Structure**: Root package delegates to `packages/probot/` which contains the modified Probot framework.

**Three-Screen Wizard Flow**:
1. **Welcome Screen** (`/probot`) - Collects optional user info and telemetry preferences
2. **App Setup** (`/probot/app-setup`) - Creates GitHub App via manifest
3. **Success Screen** (`/probot/success`) - Displays generated credentials

**Key Components**:
- `packages/probot/lib/apps/setup.js` - Main wizard logic and Express routes
- `packages/probot/lib/manifest-creation.js` - GitHub App creation via manifest API
- `packages/probot/views/*.handlebars` - UI templates (Handlebars templating)
- `packages/probot/static/` - CSS assets and logo
- `app.yml` - GitHub App manifest template with required permissions

**UI Framework**: Express.js with Handlebars templating, styled with Primer CSS (GitHub's design system)

## Key Development Patterns

1. **Development Mode**: Set `TERRATEAM_DEV_MODE=true` to bypass GitHub App creation flow and use mock data. Access `/probot/dev` for direct success page testing.

2. **GitHub App Manifest**: Dynamically generates manifest with specific Terrateam permissions (actions, contents, workflows, issues, PRs, etc.). Configuration in `app.yml`.

3. **Environment Management**: Uses `update-dotenv` package to safely generate `.env` files with GitHub App credentials.

4. **Telemetry System**: Optional collection via POST to `https://telemetry.terrateam.io/event/terrateam-setup/opt-in`. Respects user privacy preferences stored in sessionStorage.

5. **GitHub OAuth Integration**: Tunnel configuration step includes GitHub OAuth popup that proxies through Terratunnel's remote OAuth service at `https://tunnel.terrateam.dev`. No local OAuth secrets required.

6. **GitHub Enterprise Support**: Configurable via `GHE_HOST`, `GHE_PROTOCOL`, `GH_ORG`, `GITHUB_API_BASE_URL`, and `GITHUB_WEB_BASE_URL` environment variables for enterprise deployments.

7. **Session Management**: Uses browser sessionStorage for wizard state persistence between screens, including tunnel configuration and OAuth tokens.

## Testing and Development

**Development Workflow**:
1. Use `TERRATEAM_DEV_MODE=true` to test UI flow without creating real GitHub Apps
2. Mock data is generated for credential display testing
3. Template changes require server restart to take effect
4. TypeScript source is in `packages/probot/src/` (if exists), compiled output in `packages/probot/lib/`

**Jest Configuration**: Test environment set to Node.js, uses ts-jest preset, coverage excludes compiled `lib/` directory.

**Code Quality**: Prettier for formatting, TypeScript for type safety, includes pretest compilation checks.