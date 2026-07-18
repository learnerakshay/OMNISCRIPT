# OMNISCRIPT Master Implementation Roadmap

## Authority and purpose

This is the official implementation sequence for stabilizing and advancing OMNISCRIPT. It consolidates the Recovery Plan and Technical Audit, removes duplicate recommendations, and prioritizes work by production risk.

The objective is to restore a secure, stable, visually consistent AI chat product before new feature development. Each milestone must be completed and verified before the next milestone begins unless an approved exception states otherwise.

## Operating constraints

- Preserve the current React/Vite + Express architecture.
- Preserve Clerk authentication, conversation ownership checks, Prisma persistence, OpenAI integration, SSE protocol, and existing tool capabilities.
- Prefer the smallest possible change for each milestone.
- Do not combine unrelated cleanup with a milestone.
- Do not redesign the UI while correcting regressions.
- Maintain backward compatibility with persisted plain-text messages and existing OMNISCRIPT JSON tool-message envelopes.
- Before implementation, publish the exact file list and verification plan for the approved milestone.

## Phase 1 — Critical

These milestones are mandatory before any new product feature work. They close the highest-risk security and reliability gaps.

### Milestone 1.1 — Secure server-side URL retrieval

**Goal**

Close SSRF and resource-exhaustion risks in the `readUrl` tool while retaining the existing URL-reading user capability.

**Scope**

- Validate every requested URL and every redirect destination.
- Reject non-public, loopback, link-local, private, and otherwise disallowed network targets.
- Add request timeout and response-size limits before consuming a full body.
- Normalize fetch/tool failures into the established tool-result contract.

**Files likely affected**

- `src/lib/tools/registry.ts`
- `server.ts` only if a server-level timeout/error integration is required

**Estimated complexity**: Medium

**Risks**

- Overly restrictive validation can block legitimate public URLs.
- DNS and redirect validation must avoid opening a bypass path.
- Tool result changes must remain compatible with the existing citation/message renderer.

**Testing checklist**

- Public HTTPS page succeeds and retains title/content behavior.
- HTTP-to-HTTPS public redirect succeeds only after redirect destination validation.
- `localhost`, loopback, RFC1918/private, link-local, and metadata-style targets are rejected.
- Non-HTTP(S) protocols are rejected.
- Oversized, slow, invalid, and non-2xx responses fail safely and return a user-visible tool failure.
- Existing `webSearch` behavior remains unchanged.

### Milestone 1.2 — Stabilize tool-call and SSE error contracts

**Goal**

Eliminate stream crashes and hidden failures, including the reported `Cannot read properties of undefined (reading 'query')` error.

**Scope**

- Validate model tool-call payloads before reading `args.query` or `args.url`.
- Handle unsupported, malformed, and failed calls with a deterministic SSE error/status outcome.
- Normalize tool failure shapes.
- Ensure client-side SSE errors reach the existing toast/error path rather than being swallowed as parsing warnings.
- Remove the duplicate `status` assignment in streaming state creation.
- Preserve existing SSE event names: `status`, `citations`, `text`, and `[DONE]`.

**Files likely affected**

- `server.ts`
- `src/App.tsx`
- `src/lib/tools/registry.ts`

**Estimated complexity**: Medium

**Risks**

- SSE parser changes can regress normal, tool-assisted, or persisted-response rendering.
- Error event behavior must not cause duplicate messages or leave the composer permanently disabled.

**Testing checklist**

- Normal non-tool prompt completes and persists one assistant message.
- `webSearch` and `readUrl` complete with progress and citations.
- Missing/invalid tool args do not crash the server and show a useful user-facing failure.
- Unknown tool names fail safely.
- Tool network failure produces a visible error state.
- Server-emitted SSE error produces a toast and clears stream state.
- No duplicate message persistence occurs on success or failure.

### Milestone 1.3 — Add abuse and execution boundaries

**Goal**

Protect AI and tool endpoints from uncontrolled cost, concurrency, and abandoned work without changing normal chat behavior.

**Scope**

- Add scoped rate/concurrency controls for stream and tool requests.
- Add upstream abort handling when the client disconnects.
- Define safe request/tool execution timeouts.
- Add minimal structured operational logging for failed AI/tool operations without recording secrets.

**Files likely affected**

- `server.ts`
- `src/lib/tools/registry.ts`
- Potentially a new narrowly scoped server utility under `src/lib/`

**Estimated complexity**: Medium–High

**Risks**

- Poorly chosen limits can affect legitimate high-frequency users.
- Abort integration must not corrupt persistence or emit a completed response after disconnect.
- Logging must not expose tokens, secrets, or sensitive message content.

**Testing checklist**

- Normal authenticated requests are unaffected within expected limits.
- Repeated rapid stream requests are limited predictably.
- A disconnected stream stops eligible upstream work and leaves no malformed assistant record.
- Timeout failures clear the client stream state and remain observable server-side.
- Logs contain request context/error classification but no secrets or raw credentials.

## Phase 2 — High Priority

These milestones restore reliable UI behavior and core AI-chat quality after critical safety and failure handling are addressed.

### Milestone 2.1 — Restore deterministic accent, focus, and streaming visuals

**Goal**

Restore existing premium interaction states that can be absent from production CSS due to runtime-generated Tailwind class names.

**Scope**

- Replace dynamic Tailwind variant construction with statically available classes from the existing accent palette.
- Restore consistent hover, focus, active, and disabled states in the composer, new-chat controls, and suggested prompts.
- Restore accent-aware thinking/streaming visuals without redesigning their layout.
- Retain the existing theme and accent provider interfaces where possible.

**Files likely affected**

- `src/App.tsx`
- `src/components/thinking-skeleton.tsx`
- `src/providers/accent-provider.tsx`

**Estimated complexity**: Medium

**Risks**

- Styling changes can unintentionally alter dark-mode colors or focus contrast.
- Tailwind class availability must be verified in a production build, not only development.

**Testing checklist**

- Production build contains required accent/focus/streaming styles.
- All six accent colors render correctly in light and dark modes.
- Hover, keyboard focus, disabled, active, and streaming states remain visually distinct.
- No layout shift is introduced in the composer or skeleton.
- Reduced-motion behavior remains intact.

### Milestone 2.2 — Deliver genuine direct-response streaming

**Goal**

Replace artificial post-completion text replay with actual incremental response streaming for normal chat prompts.

**Scope**

- Use the existing AI SDK streaming mechanism for direct responses.
- Preserve current SSE event format and client renderer.
- Preserve message persistence only after a successful completed stream.
- Keep tool-assisted streaming behavior functional.

**Files likely affected**

- `server.ts`
- `src/App.tsx` only if stream lifecycle handling requires a narrow compatibility adjustment

**Estimated complexity**: Medium

**Risks**

- Direct and tool-assisted paths can diverge if not validated together.
- Partial stream failures need the Phase 1 error contract.
- Persistence timing must avoid saving incomplete answers.

**Testing checklist**

- Direct prompts show text before full model completion.
- Direct response text is persisted exactly once after successful completion.
- Tool-assisted responses continue streaming with citations.
- Network/model failure does not persist malformed assistant content.
- Mobile auto-scroll and user-scrolled-up behavior remain correct.

### Milestone 2.3 — Repair light mode and core surface consistency

**Goal**

Make the existing interface visually coherent in light mode without changing its information architecture or visual identity.

**Scope**

- Standardize high-visibility surfaces on the existing semantic CSS tokens.
- Correct contrast, borders, elevation, selected state, and loading-state inconsistencies.
- Prioritize sidebar, chat viewport, composer, message bubbles, tool UI, settings modal, and code block.
- Retain current spacing, component hierarchy, and interaction patterns unless a defect requires change.

**Files likely affected**

- `src/index.css`
- `src/App.tsx`
- `src/components/sidebar.tsx`
- `src/components/message-bubble.tsx`
- `src/components/tool-status.tsx`
- `src/components/thinking-skeleton.tsx`
- `src/components/settings-dialog.tsx`
- `src/components/code-block.tsx`

**Estimated complexity**: Medium

**Risks**

- Token normalization can unintentionally affect dark mode.
- A broad visual sweep can become a UI redesign; keep changes constrained to consistency defects.

**Testing checklist**

- Light-mode review at desktop, tablet, and narrow mobile widths.
- Dark mode remains visually stable.
- Text, borders, controls, selected items, and disabled states meet readable contrast.
- Markdown tables, images, code blocks, tool citations, loading skeletons, and dialogs remain usable.
- No horizontal overflow in main chat, sidebar, or composer.

### Milestone 2.4 — Resolve core interaction conflicts and loading failures

**Goal**

Make existing navigation and loading behaviors predictable when data or client state is invalid.

**Scope**

- Assign Cmd/Ctrl+K to one documented behavior.
- Add contained error/retry presentation for failed conversation/message queries.
- Recover gracefully from stale remembered conversation IDs.
- Ensure stream completion/failure always restores a usable composer state.

**Files likely affected**

- `src/App.tsx`
- `src/components/sidebar.tsx`
- `src/hooks/use-chat.ts`

**Estimated complexity**: Medium

**Risks**

- Keyboard changes can disrupt established user expectations.
- Retry logic must not bypass React Query cache or create duplicate requests.

**Testing checklist**

- Cmd/Ctrl+K has one consistent result on desktop and mobile keyboard environments.
- Failed conversation and message requests display useful recovery actions.
- Retrying succeeds without page reload when the backend becomes available.
- Deleted/nonexistent remembered conversation ID returns safely to the landing state.
- Composer remains usable after stream and query errors.

## Phase 3 — Medium Priority

These milestones improve scalability, accessibility, maintainability, and reliability after the product is stable and visually restored.

### Milestone 3.1 — Control conversation growth and duplicate submissions

**Goal**

Prevent long-chat degradation and duplicate message creation while preserving the existing persistence model.

**Scope**

- Define a token-aware history policy, such as bounded recent context with safe summarization where approved.
- Add idempotency/in-flight safeguards for message submission and stream initiation.
- Define retry semantics for failed assistant generation.

**Files likely affected**

- `server.ts`
- `src/App.tsx`
- `src/actions/chat-actions.ts`
- `src/lib/repositories/chat-repository.ts`
- Potentially Prisma schema/migration files only if durable idempotency requires persisted keys

**Estimated complexity**: High

**Risks**

- Context trimming can reduce answer quality or remove important prior details.
- Durable idempotency can require a schema migration; do not introduce one without an approved migration plan.
- Retries must not duplicate assistant messages.

**Testing checklist**

- Long conversations remain within defined model-context policy.
- Relevant recent context is retained and behavior is documented.
- Duplicate client submissions produce no duplicate user/assistant rows.
- Failed generation retry produces one intentional new result.
- Existing conversations and existing JSON tool envelopes remain readable.

### Milestone 3.2 — Complete accessibility and responsive hardening

**Goal**

Make existing controls keyboard-accessible, reduce-motion compliant, and dependable across constrained viewport sizes.

**Scope**

- Implement or remove currently non-functional high-contrast, focus-indicator, and motion preferences.
- Use semantic keyboard-operable controls for expandable interactive UI.
- Add dialog focus management and focus restoration.
- Audit narrow-width overflow, especially thinking/loading UI, Markdown tables, composer, and sidebar drawer.
- Reserve sensible image layout behavior and add image failure/loading treatment where appropriate.

**Files likely affected**

- `src/index.css`
- `src/providers/settings-provider.tsx`
- `src/App.tsx`
- `src/components/settings-dialog.tsx`
- `src/components/sidebar.tsx`
- `src/components/tool-status.tsx`
- `src/components/thinking-skeleton.tsx`
- `src/components/logo-symbol.tsx`
- `src/components/message-bubble.tsx`

**Estimated complexity**: Medium–High

**Risks**

- Focus trapping must not interfere with Clerk modal behavior.
- Motion changes may alter intended visual character if applied too broadly.
- Responsive fixes must preserve desktop density.

**Testing checklist**

- Full keyboard-only traversal, including settings, theme selector, tool detail expansion, and delete confirmation.
- Focus enters, remains within, and restores from dialogs correctly.
- Reduced-motion setting and OS motion preference reduce non-essential motion.
- High-contrast/focus preference either works measurably or is not exposed.
- 320px-class mobile, tablet, and desktop layouts have no unintended horizontal overflow.
- Screen-reader labels exist for icon-only controls and stateful controls.

### Milestone 3.3 — Improve client performance for long chats

**Goal**

Reduce rendering and scrolling cost without changing message content or visual design.

**Scope**

- Measure stream-related rerenders and scroll work.
- Reduce unnecessary top-level rerenders during streaming.
- Introduce message-windowing/virtualization only if measurement demonstrates a long-chat threshold requiring it.
- Consider lazy loading low-frequency modal/settings code only after verifying bundle impact.

**Files likely affected**

- `src/App.tsx`
- `src/components/message-bubble.tsx`
- `src/components/settings-dialog.tsx`
- `src/components/code-block.tsx`
- `src/components/thinking-skeleton.tsx`
- Build configuration only if measurement supports it

**Estimated complexity**: Medium–High

**Risks**

- Virtualization can break scroll-to-bottom, deep links, copy, animations, and dynamic Markdown height.
- Premature code splitting can complicate simple loading behavior.

**Testing checklist**

- Profile representative short and long conversations before and after changes.
- Streaming stays smooth while users remain at bottom and while they scroll upward.
- Copy, delete, citations, code blocks, and Markdown tables work for old and new messages.
- No lost or duplicated content during virtualized/windowed rendering, if adopted.
- Initial load and settings opening remain responsive.

### Milestone 3.4 — Establish data and operational readiness

**Goal**

Make database and runtime operations reproducible without changing user-facing behavior.

**Scope**

- Reconcile Prisma CLI and runtime database environment conventions.
- Introduce an approved Prisma migration workflow.
- Decide explicitly whether the local `User` model is required; align it with Clerk or retire it through a deliberate migration.
- Add health dependency checks and a minimal operational runbook.

**Files likely affected**

- `prisma/schema.prisma`
- New `prisma/migrations/` files if approved
- `src/lib/prisma.ts`
- `.env.example`
- `README.md`
- `server.ts`
- Potentially a new operational documentation file

**Estimated complexity**: Medium–High

**Risks**

- Schema changes are irreversible without a migration/rollback plan.
- Environment changes can break deployment if secrets/configuration are not coordinated.
- User identity changes must preserve existing conversation ownership.

**Testing checklist**

- Fresh database setup succeeds from documented steps.
- Existing database migration succeeds on a copy/representative environment.
- Runtime connects using the documented configuration.
- Health endpoint distinguishes process health from required dependency health, if expanded.
- Existing Clerk users retain access to their conversations.

## Phase 4 — Nice-to-have

These improvements should begin only after Phases 1–3 are stable, tested, and accepted.

### Milestone 4.1 — Product copy and micro-polish pass

**Goal**

Remove visual credibility defects and make product language accurate, concise, and professional.

**Scope**

- Correct encoding artifacts.
- Remove unsupported security/privacy/legal claims.
- Align setup/fallback messaging with actual Clerk behavior.
- Refine empty, loading, and error copy within the existing UI layout.

**Files likely affected**

- `src/App.tsx`
- `src/components/sidebar.tsx`
- `src/components/settings-dialog.tsx`
- `src/components/logo-symbol.tsx`
- `src/providers/root-provider.tsx`

**Estimated complexity**: Small

**Risks**

- Copy changes must not make legal/compliance claims without approval.
- Avoid changing brand voice into a UI redesign exercise.

**Testing checklist**

- No visible encoding corruption.
- Settings, setup, loading, and empty states use accurate language.
- Light/dark typography remains legible after copy changes.
- No layout clipping caused by updated text at mobile widths.

### Milestone 4.2 — Remove confirmed dead code and legacy residue

**Goal**

Reduce maintenance noise after runtime behavior is covered and stabilized.

**Scope**

- Remove confirmed unused modules, imports, dependencies, Firebase/Gemini residue, and stale metadata.
- Update documentation to match the active OpenAI + Clerk + Prisma architecture.
- Do not remove anything based solely on package presence; verify runtime/build references first.

**Files likely affected**

- `package.json`
- `bun.lock`
- `README.md`
- `metadata.json`
- `firebase-applet-config.json` if confirmed obsolete
- `src/constants/index.ts`
- `src/types/index.ts`
- `src/lib/utils.ts`
- `src/hooks/use-chat.ts`
- `src/lib/tools/registry.ts`

**Estimated complexity**: Medium

**Risks**

- Removing platform metadata/dependencies without deployment confirmation can break AI Studio or deployment behavior.
- Lockfile changes can update unrelated transitive dependencies; keep dependency operations tightly scoped.

**Testing checklist**

- Production build/type-check succeeds in a provisioned dependency environment.
- Development server starts.
- Authentication, database access, direct chat, tools, streaming, Markdown, theme, and settings remain functional.
- Documentation and environment examples match runtime requirements.

### Milestone 4.3 — Automated quality gates

**Goal**

Prevent the same UI and streaming regressions from recurring.

**Scope**

- Add targeted unit tests for validation, ownership, tool URL policy, and stream event parsing.
- Add integration coverage for authenticated CRUD and direct/tool-assisted chat lifecycle.
- Add visual/browser regression checks for light mode, dark mode, narrow mobile, and critical dialogs.
- Add CI checks for type-checking, tests, and production build.

**Files likely affected**

- New test files and test configuration
- `package.json`
- CI workflow files
- Potentially small testability-only exports in existing modules

**Estimated complexity**: High

**Risks**

- External Clerk/OpenAI dependencies require reliable mocking or isolated test environments.
- Snapshot-only visual tests can become noisy; prioritize key states and behavior assertions.

**Testing checklist**

- Tests run deterministically locally and in CI.
- Security tests cover blocked URL destinations and redirect handling.
- Stream parser tests cover text, status, citations, `[DONE]`, and error events.
- Browser tests cover light/dark modes, mobile layout, dialogs, and keyboard flow.
- CI blocks regressions while remaining fast enough for normal development.

## Completion criteria before new feature milestones

New feature development may resume only when:

1. Phase 1 is complete and accepted.
2. Direct and tool-assisted chats have no known runtime crash paths.
3. Production CSS reliably includes accent, focus, and streaming states.
4. Light-mode core surfaces are reviewed and accepted.
5. Error/retry behavior is usable for stream and query failures.
6. A baseline verification process exists for the affected flows.
