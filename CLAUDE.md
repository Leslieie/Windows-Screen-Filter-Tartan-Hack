# CLAUDE.md — ScreenTint Project Rules

## Git & Repository Rules

- **NEVER** push `.claude/` directory, `.claude*` config files, or any Claude-related settings to the repo
- **NEVER** add Claude as a collaborator, contributor, or author in git config
- **NEVER** commit with Claude-authored git user name/email — use the existing repo git config
- Add `.claude/` and `.claude*` to `.gitignore` if not already there
- Keep commit messages **short** (max 72 chars subject line, imperative mood)
- Keep inline code comments **short** — 1 line max unless truly complex logic

## Commit & Push Policy

- **NEVER** commit or push without my explicit permission
- Before any commit: show me a summary of ALL changed files with a brief diff overview
- Wait for my approval before running `git commit` and `git push`
- If I say "commit" or "push", proceed. Otherwise, always ask first
- Batch related changes into logical commits — don't make 10 tiny commits for one feature

## Visual Testing Policy

This is a **visual application** — screen color filters cannot be fully verified by automated tests alone.

- After implementing any visual change (overlay positioning, color matrix application, window tracking), **pause and tell me to test it manually**
- Do NOT assume a visual feature works just because the code compiles and unit tests pass
- When pausing for visual testing, tell me:
  1. What you implemented
  2. How to trigger/test it (which window to open, which button to click)
  3. What I should see if it's working correctly
  4. What I should see if it's NOT working (common failure modes)
- Wait for my confirmation before proceeding to the next step
- You CAN and should still write automated tests for non-visual logic (matrix math, window enumeration, state management, etc.)

## Code Style & Formatting

- Use existing project code style — don't reformat files you didn't change
- 2-space indentation for JS/JSON, 4-space for C++
- No trailing whitespace
- Keep functions small and focused
- Prefer descriptive variable names over comments
- C++ addon: follow existing naming conventions in `magnification.cpp`

## Architecture Rules

- Don't restructure the project folder layout without asking
- Don't remove existing fullscreen filter code — keep as fallback
- Don't modify palette math (`matrix-ops.js`, `palettes/`) unless specifically asked
- Don't add new npm dependencies without asking first — explain why it's needed
- Don't add new C++ libraries without asking — explain the alternative
- Keep the native addon API surface minimal — only expose what JS actually needs

## What You Can Do Without Asking

- Read any file in the project
- Run `npm install` (existing dependencies only)
- Run `node-gyp rebuild` to compile the native addon
- Run existing tests
- Create new files in appropriate directories
- Run the app with `npm start` for testing
- Fix obvious bugs, typos, or build errors

## What You Must Ask Before Doing

- Adding new npm/C++ dependencies
- Changing project structure or file layout
- Modifying shared interfaces (IPC contracts, N-API exports)
- Deleting any existing code or files
- Any `git commit`, `git push`, or `git` operations
- Changes that affect the build pipeline or `package.json` scripts
- Anything that feels like a big architectural decision

## Error Handling

- If the native addon fails to compile, show me the full error output
- If you're stuck between two approaches, explain both with tradeoffs and let me decide
- If something requires Windows-specific testing you can't do, say so clearly
- Don't silently skip errors — surface them
