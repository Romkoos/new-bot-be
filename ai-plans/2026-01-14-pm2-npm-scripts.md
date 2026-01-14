# Task: Add npm scripts for PM2 operations

## Context
- Ticket/Request: Add `package.json` scripts to run all PM2 commands needed for this project.
- Related docs:
  - `docs/system/Lifecycle.md` (PM2 scheduling, boot sequence)
  - `ecosystem.config.js` / `ecosystem.config.cjs` (PM2 ecosystem config)

## Objective
Add a minimal set of npm scripts that make it easy and consistent to operate PM2 for this repo, without changing business behavior:

- Start/reload PM2 using the repo’s ecosystem file
- Ensure `dist/` exists before starting/reloading (build prerequisite)
- Provide common operational commands (status/logs/stop/delete)

## Technical Approach
- Update `package.json` `scripts` only (no new dependencies).
- Prefer scripts that reference `ecosystem.config.js` so `pm2 start` behavior is consistent.
- Add build+PM2 combo scripts to avoid “Script not found: dist/...”.

## Implementation Steps
- [x] Step 1: Add the following scripts to `package.json`:
  - `pm2:start`: build then `pm2 start ecosystem.config.js`
  - `pm2:reload`: build then `pm2 startOrReload ecosystem.config.js`
  - `pm2:restart`: `pm2 restart ecosystem.config.js`
  - `pm2:stop`: `pm2 stop ecosystem.config.js`
  - `pm2:delete`: `pm2 delete ecosystem.config.js`
  - `pm2:list`: `pm2 list`
  - `pm2:logs`: `pm2 logs`
  - `pm2:save`: `pm2 save`
  - `pm2:flush`: `pm2 flush`
 - [x] Step 2: Run `npm run pm2:list` to sanity-check scripts are wired (non-destructive).

## Files to Modify/Create
- `package.json` - add PM2 scripts.

## Testing Strategy (if needed)
- [ ] `npm run pm2:list` works.
- [ ] `npm run pm2:reload` builds and reloads (only if PM2 is installed in the environment).

## Rollback Plan
- Remove the added `pm2:*` scripts from `package.json`.

## Open Questions
- None.

