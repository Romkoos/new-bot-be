# Task: Telegram digest MarkdownV2 formatting

## Context
- Ticket/Request: Add formatting to the text sent to Telegram (digest header + item spacing + item headline bold).
- Related docs:
  - `docs/modules/publishing.md` (Telegram MarkdownV2 digest formatting section)

## Objective
Update the Telegram digest post assembly so that:
- Header title is **bold** and prefixed with a flying rocket icon (`🚀` + space).
- There is **exactly one empty line** between digest items.
- Each digest item has its **headline** (text before the first `.`) rendered in **bold**.

## Technical Approach
- Keep using Telegram `MarkdownV2` (escape reserved characters in user/LLM-provided content).
- Introduce small, deterministic formatting helpers in `TelegramMarkdownV2DigestPostAssembler`:
  - `mdV2Bold(escapedText)` wrapper that adds `*...*` around already-escaped content.
  - Item formatter that:
    - splits on the first period (`.`)
    - escapes both segments separately
    - bolds only the headline segment
  - Join digest items with `\n\n` to ensure a single empty line between items.
- Update `docs/modules/publishing.md` to reflect the new formatting rules (header icon+bold, item spacing, headline bold).

## Implementation Steps
- [x] Step 1: Update `TelegramMarkdownV2DigestPostAssembler` formatting (header + item formatting + spacing).
- [x] Step 2: Add unit tests for `TelegramMarkdownV2DigestPostAssembler` covering:
  - header present/absent rules (0 items, 1 item, 2+ items)
  - header bold + `🚀` prefix
  - single empty line between items
  - headline bolding behavior with/without a period
- [x] Step 3: Update docs (`docs/modules/publishing.md`) to document the new Telegram MarkdownV2 formatting.
- [x] Step 4: Run checks (`npm test`, `npm run build`) and fix any issues.

## Completed
- Date completed: 2026-02-07
- Deviations: none
- Follow-ups: none

## Files to Modify/Create
- `src/modules/publishing/adapters/TelegramMarkdownV2DigestPostAssembler.ts` - implement MarkdownV2 formatting rules.
- `src/modules/publishing/tests/TelegramMarkdownV2DigestPostAssembler.test.ts` - new test coverage for digest assembly output.
- `docs/modules/publishing.md` - update “Telegram MarkdownV2 digest formatting” section.

## Testing Strategy (if needed)
- [ ] Verify `assemblePost()` output strings match expected MarkdownV2 (including escaping and bold markers).
- [ ] Run `npm test`.
- [ ] Run `npm run build`.

## Rollback Plan
- Revert the commit(s) touching the assembler + tests + docs, restoring the previous digest output shape (single-line bullets, unformatted header).

## Open Questions
- None.

