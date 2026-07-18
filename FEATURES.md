# OMNISCRIPT Features

## 1. Authentication and User Management

OMNISCRIPT uses Clerk for sign-up, sign-in, and sign-out controls. The frontend is session-gated with Clerk components, while Express verifies Clerk bearer tokens before protected API operations. Conversation, message, branch, rename, and deletion operations derive the user identity from the verified token and enforce ownership in the repository layer. The interface also displays the current Clerk user identity in the signed-in workspace.

## 2. Conversation Management

Conversations persist in PostgreSQL and appear in a sidebar ordered by recent activity. The sidebar supports title search, inline rename, deletion confirmation, timestamps, title truncation, and a Recents section. New Chat clears the active selection and returns to the landing state; the first sent message creates a persisted conversation with a deterministic concise title. Pinning and unpinning are available in the sidebar and are stored in browser local storage rather than the database.

## 3. AI Chat Experience

The chat workspace persists both user and assistant messages and renders assistant Markdown with GitHub-flavored Markdown support. Code blocks have syntax-oriented rendering and copy controls. Assistant output streams to the interface over Server-Sent Events, with loading indicators, controlled error toasts, and prevention of concurrent sends while a conversation or message is being created. React Query reloads persisted history after completion, so messages and tool metadata recover after refresh.

## 4. Tool Calling

The OpenAI AI SDK receives registered tool definitions and can choose a tool automatically. The backend normalizes tool-call formats, parses JSON arguments, validates them with Zod, streams tool status, executes the tool server-side, and supplies the structured result back to the model for the final response. The final assistant message stores the tool name, input-facing metadata, completion or failure state, and applicable result metadata so tool cards render after refresh.

### Calculator

The calculator accepts a required arithmetic `expression` and evaluates a restricted grammar without raw `eval`. It supports arithmetic operators and parentheses, rejects malformed expressions, and returns controlled errors such as division by zero. Its compact result card preserves the expression and displays normalized multiplication and division symbols.

### Current Date and Time

The date and time tool accepts an optional IANA timezone and returns a formatted current timestamp. Invalid timezone input produces a controlled tool error. The persisted tool card renders the tool context alongside the final assistant response.

### Tavily Web Search

Web search accepts a required, trimmed query and executes through Tavily from the backend only. It limits query length and result count, validates provider output, filters result URLs to HTTP(S), and uses an eight-second timeout. Missing or invalid keys, rate limits, malformed responses, network failures, and timeouts produce controlled errors. Successful searches persist compact title, URL, and snippet metadata; the card shows safe external links and works within branch-specific conversations.

## 5. Chat Branching

Each conversation has a persisted root branch and active branch pointer. A user can create a continuation from an assistant message, switch among sibling alternatives, and navigate available branch alternatives. Shared messages are referenced through message lineage before a fork, while later messages belong to their respective branches. Branch metadata and active-branch selection persist in PostgreSQL and are reloaded through React Query after refresh. Tool calls execute and persist in the currently selected branch.

## 6. Message and Conversation Deletion

Message deletion runs in a Prisma transaction. It determines the selected message's descendant lineage, removes branches whose fork point depends on deleted history, and preserves unrelated branches. Surviving branch heads are moved back to retained history before dependent records are removed. Tool metadata is stored with assistant messages and is removed with those messages. When deletion leaves a conversation without messages, the conversation is removed, React Query data is cleared, and the interface returns to New Chat.

## 7. Backend and Data Layer

Express exposes authenticated conversation, message, branch, and streaming endpoints. Zod validates request identifiers and message inputs before repository operations. Prisma maps PostgreSQL conversations, messages, and conversation branches with foreign-key relations and migrations. Repository methods validate ownership, use transactions for multi-record writes and deletion, and return controlled validation, not-found, authorization, and conflict errors. Tool execution, credentials, and database access remain server-side; the API can optionally allow configured separate frontend origins.

## 8. Frontend State Management

TanStack React Query manages conversation lists, conversation details, branch metadata, and branch-specific message caches. Structured query keys keep branch history separate from the active fallback key. Mutations invalidate the affected message, branch, conversation, or sidebar list entries after persistence. The application tracks active conversation and active branch state locally, validates branch identifiers before requests, and resolves stale selections from persisted branch metadata. Loading, error, and empty states are represented in the chat and sidebar UI.

## 9. UI and Visual Design

OMNISCRIPT uses a dark-only, minimal AI workspace interface. The landing page includes a hero, suggestion cards with subtle accent borders, a composer, and the OMNISCRIPT disclaimer. The sidebar provides Recents, searchable conversation history, pin, rename, and delete actions with truncated titles. Chat messages include Markdown, code blocks, branch navigation, compact calculator/date-time/web-search result cards, and streaming feedback. Settings expose appearance accents, chat preferences, accessibility options, shortcuts, and account information. The signed-out screen includes a cursor-following accent effect, and the browser uses the OMNISCRIPT title and favicon. Toasts, dialogs, responsive desktop/mobile layouts, loading states, and empty states are part of the interface.

## 10. Animations and Interactions

Motion for React is used for message entry, dialogs, sidebar interactions, loading indicators, tool-state transitions, and toast transitions. Suggestion cards use a restrained lift and scale hover interaction, while sidebar controls use compact individual hover feedback. The login screen supports a cursor-following accent effect on capable pointers, and user settings include a reduced-motion preference that is honored by several animated components. The interface favors restrained transitions over large decorative effects, although some generation and loading indicators intentionally animate to communicate active work.

## 11. Reliability and Production Readiness

The project uses TypeScript, Zod validation, Prisma migrations, and a singleton Prisma client to support a typed persistent architecture. Environment variables separate browser-safe configuration from backend secrets, and Clerk token verification plus repository ownership checks protect user-scoped data. Tool failures and AI provider failures are handled as controlled user-facing errors, while Tavily has explicit timeout and provider-error handling. The deployed frontend can use a separate Vercel origin and optional API base URL, while the Express backend is compatible with Render's injected port and configured CORS origins. Persistent conversation, branch, and tool metadata supports refresh recovery.

## Future Improvements

1. **Multi-model provider support**

   Add selectable model providers so users can choose an appropriate capability, latency profile, or cost profile for a conversation. This would primarily affect the AI provider abstraction, settings UI, and persisted conversation preferences. It is not currently implemented.

2. **File upload and document-aware chat**

   Allow users to attach files and ask questions grounded in their contents. This would require secure upload handling, storage, extraction pipelines, and message attachment metadata. It is not currently implemented.

3. **Retrieval-Augmented Generation over user documents**

   Build retrieval over uploaded documents to provide grounded responses from a user's private knowledge base. Likely architectural areas include embeddings, vector storage, document indexing, and tool orchestration. It is not currently implemented.

4. **Conversation export to Markdown and PDF**

   Enable users to export selected conversations for sharing, review, or archival. This would affect message serialization, export endpoints, and frontend export controls. It is not currently implemented.

5. **Shared conversations and team workspaces**

   Support controlled sharing, workspace membership, and collaborative conversation access. This would extend the current user-scoped authorization model, database relations, and sidebar/workspace UI. It is not currently implemented.

6. **Advanced source citations for web-search answers**

   Add richer in-answer source references and source-management controls for web-search responses. This would extend the web-search metadata model, Markdown rendering, and tool-result presentation. It is not currently implemented.

7. **Voice input and text-to-speech responses**

   Offer voice capture for prompts and spoken playback for responses to improve accessibility and hands-free use. This would involve browser media APIs, audio controls, and potentially a speech provider integration. It is not currently implemented.

8. **Custom user-created tools and integrations**

   Let users define controlled integrations for their own workflows. This would require a secure tool registry extension, credential management, validation, and permission boundaries. It is not currently implemented.

9. **Usage analytics, token tracking, and cost monitoring**

   Provide visibility into model usage and operational costs across conversations. This would require request telemetry, provider usage capture, reporting queries, and a user-facing analytics interface. It is not currently implemented.

10. **Automated conversation summaries and long-context compression**

   Summarize older conversation segments to retain useful context as threads grow. This would affect message lineage, summary persistence, prompt construction, and refresh-safe rendering. It is not currently implemented.
