# Skill: Update Dependency Versions

**Description:** Use this skill when requested to update dependencies in the AnyWear Client repository.

## Context

This project uses a single package manager:

- **Root Directory (`/`)**: Uses `pnpm` for the main Tauri + React frontend application.

## Critical Constraints
1.  **Node.js 24 (LTS)**: This project MUST stay on Node 24. Do NOT update `@types/node` beyond the `24.x` range (e.g., keep it pinned to `~24.x.x`).
2.  **Framework Requirements**: This project uses React 19, TypeScript 5, Vite, and Tauri v2. Be careful not to introduce breaking major version updates unless explicitly requested.
3.  **Explicit Consent**: NEVER run an update command without first showing the user exactly which versions will be changed and getting their explicit "Go ahead" or "Yes".

## Execution Steps

### Step 1: Frontend Application (pnpm)

1.  Run `pnpm outdated` to identify out-of-date packages.
2.  Share the list of outdated packages with the user and ask if they want a safe update (within semver ranges) or a major update (to absolute latest).
3.  **Preview Changes**: Based on the user's choice, run `pnpm update --dry-run` (or simulate the list if `--dry-run` is unavailable) to show the **specific target versions**.
4.  **Permission**: Ask: "Do you give permission to proceed with these specific version changes?"
5.  **Execute**: Only proceed if permission is granted.
    - For safe updates: `pnpm update`
    - For major updates: `pnpm update --latest`

### Step 2: Verification (CRITICAL)

You MUST verify the build succeeds after updating dependencies to catch breaking changes or type mismatches.

1.  Run `pnpm tsc --noEmit` in the root. If it fails, attempt to fix TypeScript errors or revert the update.
2.  Run `pnpm build` (which compiles TS and builds Vite). If it fails, resolve the build issues.
3.  (Optional) Run `pnpm test` or `pnpm vitest run` to ensure tests pass.

### Step 3: API Client Check

Updating dependencies like `orval` or Axios might affect the generated API client.

1.  Run `pnpm orval` to ensure the API hooks and models regenerate correctly based on the OpenAPI spec.
2.  Run `git status`. If `src/api/` shows modified content unexpectedly, inform the user about the changes to the generated code and confirm if they should be committed.
