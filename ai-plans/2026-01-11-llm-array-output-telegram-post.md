# Task: Accept LLM array output and assemble Telegram digest post

## Context
- Ticket/Request: LLM prompt changed — model now returns a JSON array of strings (each string is a digest item). We must build a publishable digest post:
  - header title at the top
  - bulleted list where each bullet is one array element
  - footer appended at the end (link to channel)
- Related docs:
  - `docs/modules/publishing.md`
  - `docs/system/DependencyInjection.md`

## Objective
Update the publishing flow so it:
- parses the LLM response as `string[]` (JSON array)
- normalizes items minimally and deterministically
- assembles a Telegram-ready MarkdownV2 message (header + list + footer) via a dedicated adapter
- persists and publishes the assembled message (not the raw LLM JSON)

## Technical Approach
### Ports (provider-agnostic naming)
- Add a new port in `src/modules/publishing/ports/`:
  - `DigestPostAssemblerPort` with `assemblePost(input: { items: string[] }): string`

### Adapters
- Add a dedicated adapter for Telegram MarkdownV2 post assembly (allowed to be provider-specific in name):
  - `TelegramMarkdownV2DigestPostAssembler`
  - Responsibilities:
    - deterministic MarkdownV2 escaping for header + bullet items + footer label
    - footer link formatting: `[escapedLabel](rawUrl)`
    - bullet formatting uses `\\- ` (escaped dash) for MarkdownV2
  - Constants:
    - `CHANNEL_URL = "https://t.me/yalla_balagan_news"`
    - `HEADER_TITLE = "Йалла дайджест!"`
    - `FOOTER_TITLE = "Йалла балаган | Новости"`

### Telegram publisher
- Update `TelegramMarkdownPublisher` to **not** apply blanket MarkdownV2 escaping.
  - It should publish the given text “as-is” with the configured `parse_mode`.
  - This prevents breaking the footer link and list formatting.

### Orchestrator changes
- Update `PublishDigestOrchestrator`:
  - parse `generated.text` strictly as JSON `string[]` (throw on invalid)
  - normalize items: trim, drop empty items
  - call `DigestPostAssemblerPort` to build the final message
  - persist/publish the assembled message

### Prompt changes (optional but recommended)
- Update the prompt builder to explicitly require:
  - output must be **ONLY** a JSON array of strings (no prose)

## Implementation Steps
- [x] Step 1: Add `DigestPostAssemblerPort` and adapter `TelegramMarkdownV2DigestPostAssembler`.
- [x] Step 2: Update orchestrator to parse `string[]` and assemble final post via the port.
- [x] Step 3: Update Telegram publisher to stop escaping and just send text as-is.
- [x] Step 4: Wire the assembler adapter in `src/app/di/container.ts`.
- [ ] Step 5: Build + quick manual run of `npm run dev:cli:publish` (with env configured).

## Files to Modify/Create
- `src/modules/publishing/ports/DigestPostAssemblerPort.ts` - new port
- `src/modules/publishing/adapters/TelegramMarkdownV2DigestPostAssembler.ts` - new adapter
- `src/modules/publishing/application/PublishDigestOrchestrator.ts` - parse array + assemble
- `src/modules/publishing/public/index.ts` - export new port type (contract)
- `src/modules/publishing/adapters/TelegramMarkdownPublisher.ts` - remove blanket escaping
- `src/app/di/container.ts` - wire assembler adapter

## Testing Strategy
- [ ] Unit-ish: feed sample `string[]` and verify assembled output format (header, bullets, footer link).
- [ ] Manual: run publish CLI and verify Telegram accepts MarkdownV2.

## Rollback Plan
- Revert this plan’s commits; return to publishing raw LLM output as the published text.

## Open Questions
- Should we keep `TELEGRAM_PARSE_MODE=MarkdownV2` mandatory, or allow Markdown fallback?
