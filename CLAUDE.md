# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Terrateam GitHub App setup wizard - a Node.js application built with a modified Probot framework. It guides users through creating and configuring a GitHub App for Terrateam, a GitOps orchestration engine for infrastructure-as-code tools (Terraform, OpenTofu, CDKTF, Terragrunt, and Pulumi).

## Development Commands

```bash
# Install dependencies
npm install

# Start the application (runs on port 3000 by default)
npm start

# Development mode - bypasses GitHub App creation flow
TERRATEAM_DEV_MODE=true npm start

# Working in the Probot package
cd packages/probot
npm run build      # Compile TypeScript
npm run test       # Run Jest tests
npm run lint       # Check code formatting
npm run lint:fix   # Auto-fix formatting issues
```

## Architecture

The application follows a three-screen wizard flow:

1. **Welcome Screen** (`/probot`) - Collects optional user info and telemetry preferences
2. **App Setup** (`/probot/app-setup`) - Creates GitHub App via manifest
3. **Success Screen** (`/probot/success`) - Displays generated credentials

Key files:
- `packages/probot/lib/apps/setup.js` - Main wizard logic and routes
- `packages/probot/views/*.handlebars` - UI templates
- `app.yml` - GitHub App manifest template with required permissions

## Key Development Patterns

1. **Environment Variables**: The app generates a complete `.env` file for users. In dev mode (`TERRATEAM_DEV_MODE=true`), you can bypass the GitHub App creation flow.

2. **GitHub App Manifest**: The app dynamically generates a GitHub App manifest with specific permissions for Terrateam operations (workflows, issues, PRs, etc.).

4. **Telemetry**: Optional telemetry collection is handled via POST to `https://setup.terrateam.app/organizations` when users opt-in.

5. **Error Handling**: The setup flow includes validation for required fields and handles GitHub App creation errors gracefully.

## Testing Changes

When modifying the setup wizard:
1. Use `TERRATEAM_DEV_MODE=true` to test the UI flow without creating real GitHub Apps
2. The success page in dev mode shows mock data for testing the credential display
3. Changes to templates require server restart to take effect