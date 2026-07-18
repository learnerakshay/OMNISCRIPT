# OMNISCRIPT — Engineering Project Guide

## Purpose and scope

OMNISCRIPT is a single-page AI chat application intended for software-engineering assistance. It combines a React client with an Express API in one Node.js deployment, persists conversation history in PostgreSQL through Prisma, authenticates users with Clerk, and calls OpenAI through the AI SDK.

This document describes the repository as implemented. It distinguishes current behavior from planned or implied behavior so a maintainer can take ownership without relying on product claims, stale configuration comments, or README content.

## System architecture

```text
Browser
  React 19 + Vite SPA
  Clerk client session
  React Query cache + local UI state/localStorage
        |
        | authenticated JSON requests and custom SSE stream
        v
Express server (server.ts)
  Clerk JWT verification
  Zod-backed chat actions
  Prisma repositories
  OpenAI AI SDK orchestration
  Tool registry (web search / URL reader)
        |                    |
        v                    v
PostgreSQL               OpenAI API / public web
```

### Runtime topology

`server.ts` owns the HTTP process on port 3000. In development it attaches Vite in middleware mode. In production it serves the compiled Vite assets from `dist` and falls back to `index.html` for SPA routes. API routes are registered before the Vite/static handler.

The frontend and API are same-origin. Client requests use relative `/api/...` paths, so no separate API host or CORS configuration is currently required.

## Repository map

```text
.
├── assets/
│   └── .aistudio                         AI Studio artifact metadata
├── prisma/
│   └── schema.prisma                     PostgreSQL data schema
├── src/
│   ├── actions/
│   │   └── chat-actions.ts               Validated server-side use cases
│   ├── components/
│   │   ├── code-block.tsx                Basic client-side code highlighting/copy UI
│   │   ├── logo-symbol.tsx               Animated OMNISCRIPT mark
│   │   ├── message-bubble.tsx            Message, Markdown, citations, actions
│   │   ├── settings-dialog.tsx           Client preferences UI
│   │   ├── sidebar.tsx                   Conversation navigation and user controls
│   │   ├── theme-toggle.tsx              Theme selector
│   │   ├── thinking-skeleton.tsx         Streaming/loading visual
│   │   └── tool-status.tsx               Tool progress and citations views
│   ├── constants/index.ts                Global constants (currently unused)
│   ├── hooks/
│   │   ├── use-chat.ts                   Authenticated API and React Query hooks
│   │   └── use-sounds.ts                 Optional Web Audio effects
│   ├── lib/
│   │   ├── ai.ts                         OpenAI provider/model/error mapping
│   │   ├── prisma.ts                     Prisma singleton and DB URL creation
│   │   ├── utils.ts                      `cn` class utility (currently unused)
│   │   ├── validation.ts                 Zod request schemas
│   │   ├── repositories/chat-repository.ts
│   │   │                                 Ownership checks and database CRUD
│   │   └── tools/registry.ts             Tool declarations and execution
│   ├── providers/
│   │   ├── root-provider.tsx             Provider composition and Clerk setup gate
│   │   ├── query-provider.tsx            Shared React Query client
│   │   ├── theme-provider.tsx            Light/dark/system setting
│   │   ├── accent-provider.tsx           Accent palette setting
│   │   ├── settings-provider.tsx         Local preference state
│   │   └── toast-provider.tsx            In-app toast state and rendering
│   ├── types/index.ts                    General types (currently unused)
│   ├── utils/date.ts                     Relative conversation activity formatting
│   ├── App.tsx                           Main page, composer, stream orchestration
│   ├── index.css                         Tailwind theme tokens and global styles
│   └── main.tsx                          React bootstrap
├── .env.example                          Environment-variable reference; partially stale
├── firebase-applet-config.json           Legacy/unintegrated Firebase configuration
├── index.html                            Vite HTML entry
├── metadata.json                         AI Studio metadata; partially stale
├── package.json                          Scripts and dependencies
├── README.md                             AI Studio setup guide; stale for current stack
├── server.ts                             Express API, auth, AI, SSE, asset hosting
├── tsconfig.json                         TypeScript compiler configuration
└── vite.config.ts                        Vite, React, Tailwind, aliases
```

There are currently no committed Prisma migrations, tests, test configuration, CI workflows, or deployment/runbook artifacts.

## Technology stack

| Concern | Technology |
|---|---|
| UI | React 19, React DOM, TypeScript |
| Build/dev server | Vite 6, tsx, esbuild |
| Styling | Tailwind CSS 4, CSS custom properties, Google-hosted fonts |
| Animation/icons | Motion, Lucide React |
| Server state | TanStack React Query |
| Client presentation | react-markdown, remark-gfm |
| Authentication | Clerk React and Clerk backend SDK |
| Validation | Zod |
| Database | PostgreSQL, Prisma 5 |
| AI | `ai`, `@ai-sdk/openai`, fixed `gpt-4o-mini` model |
| External data tools | Native `fetch`, DuckDuckGo HTML scraping |

### Legacy or presently unused dependencies/configuration

Firebase, Firebase Admin, Google GenAI, and Firebase applet configuration are present but are not integrated into the active request path. The tool registry imports Google GenAI types only for declaration typing; the active model path is OpenAI. `@fontsource-variable/geist`, Base UI, shadcn, and several source utility/type modules do not have observed application use.

## Provider and component hierarchy

```text
main.tsx
└── RootProvider
    └── ClerkProvider
        └── QueryProvider
            └── ThemeProvider
                └── AccentProvider
                    └── SettingsProvider
                        └── ToastProvider
                            └── App
                                ├── SignedOut screen
                                ├── Sidebar (desktop and mobile drawer)
                                │   └── ThemeToggle
                                ├── Chat viewport
                                │   └── MessageBubble
                                │       ├── ToolStatusIndicator / CitationFooter
                                │       ├── ReactMarkdown
                                │       └── CodeBlock
                                ├── Composer
                                └── SettingsDialog
```

`App.tsx` is the top-level product orchestrator. It owns the selected conversation, mobile/sidebar layout state, composer input, scroll behavior, temporary streamed content, SSE parsing, and the sequence that saves a user prompt before requesting an AI response.

## Authentication flow

1. `RootProvider` reads `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` from Vite-exposed environment variables.
2. If no valid publishable key is available, it renders a Clerk configuration guide and does not render the application or Clerk provider.
3. With a key, Clerk provides client-side session state. `SignedOut` shows Clerk sign-in/sign-up modal buttons; `SignedIn` renders the application.
4. React Query hooks call `useAuth().getToken()` and attach `Authorization: Bearer <token>` to API requests.
5. Express `requireAuth` verifies the token using `CLERK_SECRET_KEY` and places `verified.sub` in `req.auth.userId`.
6. Chat actions pass that user ID into repository calls. Repository ownership checks compare it to `Conversation.userId` before reads or mutations.

### Important implementation notes

- Clerk is the live identity source.
- There is no Clerk webhook, local user provisioning, or synchronization to the Prisma `User` table.
- `User` schema comments still refer to Firebase UIDs, which conflicts with the actual Clerk implementation.
- The fallback/mock-session warning in `App.tsx` is not reachable when Clerk configuration is missing because `RootProvider` blocks the app first.

## Database architecture and flow

### Schema

| Model | Fields/purpose |
|---|---|
| `User` | `id`, unique `email`, `createdAt`; defined but not used by current runtime |
| `Conversation` | UUID, title, owning Clerk user ID, timestamps, related messages |
| `Message` | UUID, conversation UUID, `SYSTEM`/`USER`/`ASSISTANT` role, string content, timestamps |

`Message.conversationId` is a cascading foreign key. `Conversation.userId`, `Message.conversationId`, and `Message.createdAt` are indexed.

### Request/persistence path

```text
HTTP route
  → src/actions/chat-actions.ts
  → Zod schema validation
  → src/lib/repositories/chat-repository.ts
  → Prisma client
  → PostgreSQL
```

The repository verifies ownership before sensitive operations. Creating a message uses a Prisma transaction to create the message and update `Conversation.updatedAt`. Conversation deletion relies on the cascade to delete child messages.

### Connection configuration

At runtime, `src/lib/prisma.ts` constructs a PostgreSQL URL from `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, and `SQL_DB_NAME`; it supports Unix-socket and TCP forms. `schema.prisma` separately declares `DATABASE_URL`. This dual model needs to be reconciled before standardizing Prisma CLI migration workflows.

## API surface

All listed routes except health require Clerk authentication.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Basic service status |
| POST | `/api/conversations` | Create conversation |
| GET | `/api/conversations` | List current user conversations |
| GET | `/api/conversations/:id` | Retrieve owned conversation metadata |
| PATCH | `/api/conversations/:id` | Rename conversation |
| DELETE | `/api/conversations/:id` | Delete conversation and messages |
| POST | `/api/conversations/:id/messages` | Persist a message |
| GET | `/api/conversations/:id/messages` | List conversation messages chronologically |
| DELETE | `/api/messages/:id` | Delete an owned message |
| POST | `/api/conversations/:id/stream` | Generate and stream the assistant reply |

## AI request lifecycle

```text
Prompt in App.tsx
  → create a conversation when none is selected
  → persist USER message
  → POST stream endpoint
  → server verifies ownership and loads all messages
  → normalize persisted tool-envelope assistant messages to text
  → OpenAI `generateText` with tool schemas
  ├── no tool call: replay returned complete text over SSE, persist text
  └── tool call: execute tool, invoke OpenAI `streamText`, persist envelope
  → client reads SSE with Fetch ReadableStream API
  → temporary MessageBubble displays accumulating text/status
  → invalidate React Query messages cache after `[DONE]`
```

### Model configuration

`src/lib/ai.ts` lazy-initializes an OpenAI provider from `OPENAI_API_KEY` and fixes the model name to `gpt-4o-mini`. It maps common credential, quota, overload, and network error signatures to user-facing messages.

### Message format

Ordinary responses are stored as plain text. Tool-assisted assistant messages are stored as a JSON string with this conceptual shape:

```json
{
  "omniscript": true,
  "text": "assistant markdown",
  "toolCall": { "name": "webSearch", "status": "completed" },
  "citations": [{ "title": "...", "url": "..." }]
}
```

`MessageBubble` and the server both recognize this envelope by checking for the exact serialized prefix. This is an implementation detail, not a database-level type contract.

## Tool calling architecture

Two tools are available:

- `webSearch(query)`: fetches DuckDuckGo HTML, parses up to six title/URL/snippet results using regex/string splitting, then provides results to the model.
- `readUrl(url)`: fetches an HTTP(S) URL, strips common HTML sections with regex, extracts the title and visible text, then limits the resulting text passed to the model to 15,000 characters.

The model’s tool schemas are declared inline in `server.ts`. Tool execution is dispatched from `src/lib/tools/registry.ts`. The registry independently holds Google GenAI-shaped declarations and exposes `getRegisteredTools()`, but that function is unused by the active OpenAI request path. This is duplicate tool-definition logic.

Only the first tool call returned by the initial model response is processed. The server then gives that tool result to a second model call, streams the synthesis, and persists text plus tool/citation metadata.

## Streaming architecture

The stream endpoint uses a custom server-sent-event-like protocol over a `fetch` POST response. It sets `Content-Type: text/event-stream` and emits messages in this form:

```text
data: {"type":"status",...}

data: {"type":"citations",...}

data: {"type":"text","text":"..."}

data: [DONE]
```

The client does not use `EventSource` because the request needs a bearer authorization header. It reads `response.body` manually, buffers lines, parses JSON, and updates temporary streaming state.

Tool-assisted responses use AI SDK `streamText` and therefore receive genuine incremental text. Direct responses use `generateText`, wait for the whole model output, then replay it in 24-character chunks with a short delay. That branch is simulated streaming, not token streaming.

## State management

| State category | Owner | Storage/behavior |
|---|---|---|
| Conversation/message server state | React Query | Query keys, 2-minute stale time, mutation invalidation |
| Clerk session/user | Clerk | Clerk provider/hooks |
| Page layout, composer, selected chat, streaming | `App.tsx` local React state | In-memory |
| Toast queue | Toast provider | In-memory context |
| Theme | Theme provider | localStorage + `dark` class on `<html>` |
| Accent palette | Accent provider | localStorage + CSS ring variable |
| UI preferences | Settings provider | localStorage + selected classes on `<html>` |
| Pins and last conversation | Sidebar/App | localStorage |

The client’s authenticated fetch helper is centralized in `use-chat.ts`. It obtains a Clerk token, applies JSON headers, parses API errors, and is used by the React Query hooks.

## UI and rendering architecture

The visual system uses Tailwind tokens backed by CSS custom properties in `src/index.css`. The main layout is a responsive left sidebar and a chat viewport with a sticky header and bottom-anchored composer. Desktop displays a persistent sidebar; mobile uses a motion-animated drawer.

### Message rendering

- User messages and assistant messages have distinct bubbles/avatar treatments.
- Assistant text is rendered with `react-markdown` and `remark-gfm`.
- Custom renderers support headings, lists, tables, blockquotes, links, images, and code blocks.
- Links open in a new tab with `rel="noreferrer"`.
- Code blocks have copy actions and a basic hand-written regex highlighter for SQL and JavaScript/TypeScript-family languages.
- Tool state and citations are rendered before/after the response based on persisted metadata.

### Sidebar

The sidebar includes client-side title search, local-only pinned chats, rename/delete controls, create conversation, settings launch, profile display, sign-out, and theme switching. Pins are IDs held in browser storage and are not persisted to the database or synchronized between browsers.

## Theme and preferences

`ThemeProvider` supports `light`, `dark`, and `system` choices. System mode registers a browser media-query listener. The resolved mode adds or removes `dark` from the document root.

`AccentProvider` stores one of blue, purple, emerald, orange, rose, or cyan and exposes grouped Tailwind class strings to consuming components.

`SettingsProvider` stores:

- reduce motion
- enter to send
- automatic scrolling
- timestamps
- smooth streaming
- remember last conversation
- keyboard navigation
- high contrast
- focus indicators

Some settings are active (`enterToSend`, timestamps, auto-scroll, remembered conversation, keyboard navigation, reduced message animation). `smoothStreaming` is not consumed, and the CSS currently does not define behavior for the `high-contrast`, `show-focus-indicators`, or `reduce-motion` classes it applies.

## Current implementation status

### Complete

- React/Vite SPA shell and responsive chat UI.
- Clerk client/server JWT wiring and conversation ownership checks.
- Conversation CRUD and message CRUD API endpoints.
- Prisma repository pattern with ownership validation and transactional message append/update.
- Conversation persistence and cascade deletion at schema level.
- OpenAI model provider configuration and standard error mapping.
- Markdown/GFM rendering, citations, code-copy actions, and temporary streaming UI.
- Conversation sidebar with search, rename, delete confirmation, local pins, and responsive drawer.
- Light/dark/system mode, accent palette selection, toasts, and optional sound effects.

### Partially complete

- **Authentication lifecycle:** Clerk protects app/API, but there is no user provisioning/synchronization and missing-key behavior conflicts with fallback messaging.
- **Database operations:** CRUD is present, but no migrations, seed data, database runbook, or use of `User` exists.
- **AI generation:** Works conceptually, but model selection is fixed, history is unbounded, and direct answers are not truly streamed.
- **Tool calling:** Two tools and citation UI exist, but only one model tool call is handled and schemas are duplicated.
- **Streaming:** Tool synthesis streams; regular answers are replayed after completion.
- **Accessibility preferences:** UI/state exists, but several preferences have no CSS implementation.
- **Production error handling:** Route errors are normalized, but streamed error events are swallowed by the client parser.

### Missing

- Test suite, test infrastructure, CI pipeline, linting beyond TypeScript invocation, and reproducible dependency setup in this workspace.
- Prisma migrations and an explicit deployment migration process.
- Clerk webhook/user provisioning if local user records are required.
- Rate limiting, audit events, usage controls, request cancellation, and idempotency support.
- Context-window management, conversation summarization, and model/provider configuration strategy.
- Secure production-grade URL retrieval policy.
- Operational runbook, observability, health dependencies, alerting, backup/retention policies.

## Known technical debt and risks

### Security

- `readUrl` is vulnerable to server-side request forgery: it allows arbitrary HTTP(S) targets and follows redirects without hostname/IP validation. It can reach private or internal services from the server network.
- URL responses are fully read before text is truncated, creating memory/time exposure for large responses.
- No rate limiting, tool quotas, request cancellation, or explicit tool timeout policy is implemented.

### Reliability and correctness

- A `{ error }` SSE event is thrown inside a `try` that catches it as a parse error, so users may not see a stream failure notification.
- Only `toolCalls[0]` is supported.
- Tool execution failure shapes are inconsistent (`success: false` versus objects containing only `error`), which can lead to inaccurate persisted tool status.
- Full conversation history is always sent to OpenAI; long histories raise cost/latency and may exceed the model context window.
- Client-side guards prevent duplicate sends in one UI instance, but there is no server-side idempotency or in-flight conversation lock.
- Server work continues when a client disconnects.

### Maintainability

- `App.tsx` centralizes a large amount of unrelated orchestration.
- Tool schemas are duplicated between the server and the registry.
- Tool metadata is encoded as a JSON string in `Message.content` rather than represented in a typed database field/model.
- Prisma CLI configuration and runtime DB configuration use different environment conventions.
- The README, `.env.example`, `metadata.json`, and Firebase comments retain Gemini/Firebase assumptions despite the active OpenAI/Clerk implementation.
- Several unused dependencies/files remain, and visible UI strings include encoding artifacts such as `â€¢`, `âŒ˜`, and `Â©`.
- Local pinned conversation IDs are not pruned when a conversation is removed.

## Future roadmap

The sequence below is designed to preserve the existing architecture and reduce regression risk.

1. **Establish a reproducible baseline.** Reconcile environment documentation, install/lock dependencies consistently, add a verified type-check/build command, create Prisma migrations, and update README/setup documentation for Clerk, PostgreSQL, and OpenAI.
2. **Harden identity and data lifecycle.** Confirm whether the local `User` model is required. If it is, provision it from Clerk through a controlled lifecycle; otherwise remove its assumptions in a deliberate migration. Preserve the existing conversation ownership boundary.
3. **Secure external tools.** Add URL policy enforcement, redirect-by-redirect validation, DNS/IP private-range protection, response byte limits, timeouts, rate limits, and structured tool logging before exposing URL reading broadly.
4. **Unify AI/tool contracts.** Use one typed source of truth for OpenAI tool schemas and execution. Add multiple-tool-step support and explicit tool error/result contracts while preserving current citation rendering.
5. **Make streaming real and resilient.** Use a genuine streaming model call for direct responses, define a versioned SSE event contract, propagate server errors correctly, and cancel upstream work on client disconnect.
6. **Control conversation scale.** Introduce token-aware history limits and/or summaries, idempotent message submission, safe retries, and a persisted failed-assistant state.
7. **Increase test coverage before structural changes.** Add unit tests for validation/repository ownership/tool URL policy and integration tests for authenticated CRUD, standard chat, tool chat, stream errors, and deletion behavior.
8. **Complete product polish.** Wire the remaining accessibility settings to CSS, clean stale pin state and encoding artifacts, then split `App.tsx` only after behavior is covered by tests.

## Maintainer guardrails

- Keep API routes registered before the Vite/static fallback.
- Preserve Clerk JWT verification and repository ownership checks on every user-scoped operation.
- Do not expose `OPENAI_API_KEY`, `CLERK_SECRET_KEY`, or database credentials to Vite/client code.
- Treat tool URL fetching as a security boundary, not a convenience fetch.
- Maintain compatibility with persisted plain-text assistant messages and existing JSON tool envelopes until a deliberate data migration is shipped.
- Apply the smallest targeted change possible and validate both direct-chat and tool-assisted flows after changes to `App.tsx`, `server.ts`, repositories, or message rendering.
