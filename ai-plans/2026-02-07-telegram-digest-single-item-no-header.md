# Task: Skip Telegram digest header for single item

## Context
- Ticket/Request: `TelegramMarkdownV2DigestPostAssembler` should not include `HEADER_TITLE` when the digest contains exactly one item.
- Related docs:
  - `docs/modules/publishing.md`

## Objective
Ensure Telegram `MarkdownV2` digest posts omit the header title when there is exactly one digest item, without introducing extra blank lines.

## Technical Approach
- Normalize and filter digest items deterministically.
- Assemble the post by joining non-empty sections (header, items, footer) with `\n\n` so formatting is conditional.

## Implementation Steps
- [x] Step 1: Update `TelegramMarkdownV2DigestPostAssembler` to skip header when exactly one item.
- [x] Step 2: Keep formatting stable (no extra `\n\n` when header is omitted).
- [x] Step 3: Update `docs/modules/publishing.md` to document the formatting rule.
- [x] Step 4: Run `npm run build` to confirm the repo compiles.

## Files to Modify/Create
- `src/modules/publishing/adapters/TelegramMarkdownV2DigestPostAssembler.ts` - conditional header section.
- `docs/modules/publishing.md` - document single-item header rule.
- `ai-plans/2026-02-07-telegram-digest-single-item-no-header.md` - plan/traceability.

## Testing Strategy (if needed)
- [x] `npm run build`

## Rollback Plan
- Revert the commit on the task branch.

## Open Questions
- None.

## Completed
- Date completed: 2026-02-07
- Deviations: None.
- Follow-ups: None.

