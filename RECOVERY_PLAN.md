# OMNISCRIPT Recovery Plan

## Objective

Stabilize the current production application before starting new milestones. The recovery work must preserve the existing React/Express architecture and must not alter the established authentication, database, chat persistence, AI provider, streaming endpoint, or tool-calling product capabilities unless required to correct a confirmed regression.

## Recovery principles

- Fix runtime errors before visual or feature work.
- Keep changes narrow and independently verifiable.
- Preserve existing API routes, persistence behavior, Clerk ownership checks, and OpenAI/tool integrations.
- Do not redesign the UI; restore consistency within the existing visual system.
- Validate light mode, dark mode, desktop, mobile, direct chat, and tool-assisted chat after each affected change.

## Issue register

| Priority | Issue | Root cause / evidence | Difficulty | Likely files |
|---|---|---|---|---|
| P0 | `Cannot read properties of undefined (reading 'query')` | **Probable direct cause:** `server.ts` assigns `const toolArgs = call.args as any` and then reads `toolArgs.query` or `toolArgs.url` without validating the tool-call payload. An incomplete/malformed model tool call can leave `args` undefined. | Small | `server.ts` |
| P0 | Stream failures are silently hidden | In `App.tsx`, an SSE `{ error }` causes a throw inside a `try`, but that same `try` catches it as a parse warning. The response may end with no useful user-facing failure state. | Small | `src/App.tsx` |
| P0 | Tool handling is brittle | The stream endpoint processes only `toolCalls[0]`; unexpected tool names or malformed tool calls have no complete user-facing fallback. Tool failures do not use one normalized result shape. | Medium | `server.ts`, `src/lib/tools/registry.ts` |
| P1 | Accent hover/focus styling may disappear in production | `App.tsx` composes Tailwind variants dynamically, e.g. `hover:${classes.accentBg}` and `focus-within:${classes.focusBorder}`. Tailwind cannot reliably include runtime-generated class names in the production stylesheet. | Small–Medium | `src/App.tsx`, `src/providers/accent-provider.tsx` |
| P1 | Premium thinking/streaming visual is likely incomplete | `ThinkingSkeleton` constructs classes such as `border-${colorName}-500/15` and `via-${colorName}-500/10` at runtime. These classes are not statically discoverable by Tailwind, which can omit their CSS. | Medium | `src/components/thinking-skeleton.tsx`, `src/providers/accent-provider.tsx` |
| P1 | Light-mode visual inconsistency | Semantic design tokens are mixed with hard-coded zinc surfaces across the sidebar, loading states, messages, settings, and code blocks. This creates inconsistent contrast and hierarchy in light mode. | Medium | `src/index.css`, `src/App.tsx`, `src/components/sidebar.tsx`, `src/components/message-bubble.tsx`, `src/components/thinking-skeleton.tsx`, `src/components/settings-dialog.tsx`, `src/components/code-block.tsx` |
| P1 | Cmd/Ctrl+K has conflicting behavior | `App.tsx` registers the shortcut to focus the composer; `Sidebar` registers it to focus search. Both listeners can run, so the observed target depends on listener timing. | Small | `src/App.tsx`, `src/components/sidebar.tsx` |
| P1 | Duplicate stream state property | `App.tsx` assigns `status` twice when setting a streaming tool-call state. It is currently overwritten at runtime but indicates a regression in the parser path. | Trivial | `src/App.tsx` |
| P2 | Settings promise non-functional behavior | Settings apply `high-contrast`, `show-focus-indicators`, and `reduce-motion` classes, but `index.css` does not define those classes. `smoothStreaming` only affects the thinking skeleton, not response streaming. | Medium | `src/providers/settings-provider.tsx`, `src/index.css`, `src/App.tsx`, `src/components/thinking-skeleton.tsx` |
| P2 | Motion behavior is inconsistent | Some Motion components honor reduced motion while other continuous/ripple animations do not. | Medium | `src/App.tsx`, `src/components/sidebar.tsx`, `src/components/logo-symbol.tsx`, `src/components/settings-dialog.tsx` |
| P2 | Query failures have no recovery UI | Conversation/message hooks expose errors but `App.tsx` does not render error or retry states. A stale local remembered conversation ID can leave an incomplete active-chat view. | Medium | `src/App.tsx`, `src/hooks/use-chat.ts` |
| P2 | Sidebar state polish gaps | Pinned IDs are local-only and are not pruned after deletion. Delete pending state is global, so unrelated message actions can be disabled. | Small | `src/components/sidebar.tsx`, `src/App.tsx`, `src/hooks/use-chat.ts` |
| P2 | Encoding artifacts are visible | UI strings contain corrupted symbols such as `â€¢`, `âŒ˜`, `Â©`, and `3Â°â€“5Â°`. | Small | `src/App.tsx`, `src/components/sidebar.tsx`, `src/components/settings-dialog.tsx`, `src/components/logo-symbol.tsx`, `src/providers/root-provider.tsx` |
| P3 | Some production copy is inaccurate | Settings contains unsupported privacy/encryption/legal claims; auth fallback messaging conflicts with the actual Clerk configuration gate. | Small | `src/components/settings-dialog.tsx`, `src/App.tsx`, `src/providers/root-provider.tsx` |
| P3 | No visual regression coverage | The repository contains no automated visual/browser tests and dependencies are not installed in this workspace for runtime comparison. | Medium | New test/config files only after approval |

## Phased execution plan

### Phase 1 — Runtime stabilization

1. Validate every model tool call before reading its arguments.
2. Return a clear SSE failure event for malformed and unsupported calls.
3. Propagate SSE errors in the client to the existing toast/error path.
4. Remove the duplicate streaming state property.
5. Verify direct chat, `webSearch`, `readUrl`, malformed tool data, and failed tool execution.

Primary files: `server.ts`, `src/App.tsx`, optionally `src/lib/tools/registry.ts`.

### Phase 2 — Restore deterministic UI states

1. Replace dynamic Tailwind variant construction with statically available class combinations sourced from the existing accent palette.
2. Restore accent-aware thinking/streaming visuals without changing their layout or interaction model.
3. Resolve the Cmd/Ctrl+K ownership conflict.
4. Validate hover, focus, active, disabled, and streaming states in all six accent colors.

Primary files: `src/App.tsx`, `src/components/thinking-skeleton.tsx`, `src/components/sidebar.tsx`, `src/providers/accent-provider.tsx`.

### Phase 3 — Light-mode consistency and accessibility

1. Audit the sidebar, chat viewport, composer, message bubbles, loading state, settings modal, and code block in light mode.
2. Prefer existing semantic tokens (`background`, `card`, `muted`, `border`, `foreground`) where hard-coded zinc shades break contrast or visual hierarchy.
3. Implement or remove non-functional accessibility preference classes only after confirming intended behavior.
4. Ensure reduced-motion preference is consistently honored by existing animations.

Primary files: `src/index.css`, `src/App.tsx`, `src/components/sidebar.tsx`, `src/components/message-bubble.tsx`, `src/components/thinking-skeleton.tsx`, `src/components/settings-dialog.tsx`, `src/components/code-block.tsx`.

### Phase 4 — Interaction resilience and final polish

1. Add contained error/retry presentation for failed conversation/message queries.
2. Handle stale remembered conversations gracefully.
3. Prune stale local pinned IDs and narrow destructive-action pending state where needed.
4. Correct encoding defects and unsupported production claims.
5. Perform desktop/mobile and light/dark regression checks.

Primary files: `src/App.tsx`, `src/hooks/use-chat.ts`, `src/components/sidebar.tsx`, `src/components/settings-dialog.tsx`, `src/components/logo-symbol.tsx`, `src/providers/root-provider.tsx`.

## Guardrails for implementation

- Keep API routes registered before the Vite/static fallback.
- Retain Clerk JWT verification and database ownership checks for every user-scoped route.
- Do not expose server secrets to client code.
- Do not change the stored assistant-message envelope format during recovery.
- Keep existing SSE event names (`status`, `citations`, `text`, `[DONE]`) compatible unless an explicit migration is approved.
- Preserve tool names and current user-facing tool behavior while adding defensive validation.
- Do not expand recovery into unrelated database, authentication, or AI model changes.

## Approval gate

No application code should be changed until this plan is approved. Each implementation request should begin with a targeted plan, exact file list, and verification approach.
