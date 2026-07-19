# OMNISCRIPT

OMNISCRIPT began as an extension assignment for a Generative AI JavaScript Cohort. Instead of limiting the work to an incremental ChaiGPT feature, the project became an opportunity to apply the cohort's lessons to a complete standalone AI workspace. The result is a production-style full-stack application with authentication, persistent conversations, chat branching, AI tool calling, and a modern, scalable architecture.

## Project Overview

OMNISCRIPT is an authenticated AI chat workspace built for reliable, long-lived conversations. It combines a responsive React interface with an Express API, PostgreSQL persistence, Clerk authentication, OpenAI-powered streaming, and server-side tools. Conversations, branch paths, messages, and tool results remain available after refresh, allowing users to continue work without losing context.

## Motivation

The project explores what a polished AI application requires beyond a single model request: secure user identity, persistent data, responsive streaming, useful tools, clear error handling, and a maintainable foundation for future integrations. OMNISCRIPT deliberately treats these capabilities as connected product systems rather than isolated demonstrations.

## Features

- **AI conversational interface** with real-time streamed responses.
- **Persistent conversations** backed by PostgreSQL and Prisma.
- **Chat branching** for alternate continuations while preserving shared history.
- **Clerk authentication** with server-side bearer-token verification and ownership checks.
- **OpenAI integration** through the AI SDK streaming workflow.
- **Tool Calling support** for intelligent, server-side tool invocation.
- **Third-party API integration**, currently Tavily-powered Web Search.
- **External knowledge retrieval** for up-to-date information and relevant web resources.
- **Calculator and current date/time tools** with validated inputs and controlled errors.
- **Responsive, dark-first UI** with desktop and mobile support.
- **Production deployment support** for Vercel-compatible frontend hosting and Render-compatible API hosting.
- **Clean architecture** with typed validation, repository boundaries, and React Query server-state caching.

### Tool Calling

The assistant can intelligently invoke external tools when a request needs deterministic computation, current date and time, or fresh web information instead of relying only on the language model. Tool calls are validated and executed on the server, streamed through the chat experience, persisted with the relevant assistant message, and then supplied back to the model for a natural-language answer.

### Third-Party Integration

OMNISCRIPT integrates external APIs to enrich responses with current information. Tavily Web Search retrieves relevant web resources and structured search results through a backend-only API key; the assistant uses those results to form its final response. The tool registry and result-rendering flow are intentionally designed so additional integrations can be added with minimal changes.

# 📸 Application Screenshots

## Landing Page

![Landing Page](assets/landing_pg.png)

> The OMNISCRIPT landing workspace for starting a new persistent chat.

## Hero Section

![Hero Section](assets/Hero_section.png)

> Suggested prompts and the chat composer in the empty-conversation experience.

## Authentication

![Clerk Sign In](assets/clerk_signin.png)

> Clerk-powered sign-in screen for authenticated workspace access.

## Chat Initialization

![Chat Initialization](assets/init_animation.png)

> Loading feedback while OMNISCRIPT prepares an assistant response.

## Streaming Response

![Streaming Response](assets/resp_animation.png)

> The main chat workspace displaying streamed assistant output.

## Technology Stack

| Area | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4, Motion for React |
| Client state | TanStack React Query |
| Authentication | Clerk React and Clerk Backend |
| AI | OpenAI, AI SDK, server-sent events |
| Tools | Tavily Search API, Zod validation |
| Backend | Node.js, Express, TypeScript |
| Data | PostgreSQL, Prisma, Prisma migrations |
| Rendering | React Markdown, remark-gfm, Lucide React |
| Deployment | Vercel-compatible frontend and Render-compatible Express API |

## Architecture

```text
React + Vite client
  ├─ Clerk session and authenticated UI
  ├─ React Query conversation, branch, and message caches
  └─ Streaming chat and persisted tool-result cards
             │
             ▼
Express API
  ├─ Clerk bearer-token verification
  ├─ Zod request validation and ownership checks
  ├─ OpenAI AI SDK streaming and tool orchestration
  └─ Prisma repository layer
             │
             ▼
PostgreSQL
  ├─ Conversations and messages
  ├─ Conversation branches and active-branch state
  └─ Persisted tool metadata and results
```

### Request Lifecycle

1. Clerk resolves the user session in the browser.
2. React Query loads the user's conversations, branch metadata, and selected branch history.
3. A new prompt creates a conversation when required, resolves its active branch, and persists the user message.
4. Express verifies the Clerk token, validates the request, and confirms ownership.
5. The AI SDK streams a response or selects a registered server-side tool.
6. Tool execution and status are streamed to the client; structured results are persisted with the assistant message.
7. The result is returned to the model for a final natural-language response.
8. React Query refreshes the precise conversation and branch caches so the completed history remains visible after refresh.

## Folder Structure

```text
.
├── src/
│   ├── App.tsx                 # Primary chat workspace and streaming client
│   ├── actions/                # Validated server action layer
│   ├── components/             # Chat, sidebar, settings, tool, and UI components
│   ├── hooks/                  # React Query chat hooks and interaction hooks
│   ├── lib/                    # AI, Prisma, validation, repository, and tool modules
│   └── providers/              # Clerk, React Query, settings, accent, and toast providers
├── prisma/
│   ├── schema.prisma           # PostgreSQL models and relations
│   └── migrations/             # Versioned database migrations
├── public/                     # Browser assets, including the favicon
├── assets/                     # Product screenshots used in this README
├── server.ts                   # Express API, auth middleware, and streaming route
├── vite.config.ts              # Vite and frontend environment configuration
└── .env.example                # Environment variable names and placeholders
```

## Installation

### Prerequisites

- Node.js 18 or later
- PostgreSQL database
- Clerk application credentials
- OpenAI API key
- Tavily API key for web-search support

### Setup

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and add the required values.
3. Generate the Prisma client:

   ```bash
   npx prisma generate
   ```

4. Apply pending migrations for a new local database:

   ```bash
   npx prisma migrate dev
   ```

## Environment Variables

`.env` holds local secrets and is ignored by Git. `.env.example` contains placeholders only. Never expose backend secrets through `VITE_` variables.

| Variable | Purpose | Scope |
| --- | --- | --- |
| `OPENAI_API_KEY` | OpenAI model access | Backend secret |
| `TAVILY_API_KEY` | Tavily web search access | Backend secret |
| `CLERK_SECRET_KEY` | Clerk token verification in Express | Backend secret |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk browser client configuration | Frontend public |
| `DATABASE_URL` | Preferred PostgreSQL connection string | Backend secret |
| `SQL_HOST` | Cloud SQL or PostgreSQL host fallback | Backend secret |
| `SQL_DB_NAME` | PostgreSQL database name fallback | Backend secret |
| `SQL_USER` | PostgreSQL user fallback | Backend secret |
| `SQL_PASSWORD` | PostgreSQL password fallback | Backend secret |
| `PORT` | Express listen port; defaults to `3000` | Backend runtime |
| `APP_URL` | Comma-separated browser origins permitted by the API | Backend runtime |
| `VITE_API_BASE_URL` | Optional API origin for a separately deployed frontend | Frontend public |
| `DISABLE_HMR` | Disables Vite HMR and file watching when set to `true` | Development runtime |

## Local Development

Start the development server after completing the setup steps:

```bash
npm run dev
```

Useful commands:

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the TypeScript Express server with Vite middleware in development. |
| `npm run build` | Builds the Vite frontend and bundles the Express server to `dist/server.cjs`. |
| `npm run start` | Starts the bundled production server. |
| `npm run preview` | Starts the Vite static preview server. |
| `npm run lint` | Runs `tsc --noEmit`. |
| `npm run clean` | Removes `dist` and `server.js`. |

## Deployment

### Frontend

Deploy the Vite frontend to Vercel with `VITE_CLERK_PUBLISHABLE_KEY`. When the API is hosted separately, set `VITE_API_BASE_URL` to the Render API origin. Leave it empty when Express serves the built frontend from the same origin.

### Backend

Deploy the Express service to Render with `npm run build` followed by `npm run start`. Configure `OPENAI_API_KEY`, `CLERK_SECRET_KEY`, `TAVILY_API_KEY` when web search is enabled, and a PostgreSQL connection. Render supplies `PORT`; the server honors it. For a separate frontend, set `APP_URL` to the Vercel origin or a comma-separated allowlist.

### Database

Use PostgreSQL with either `DATABASE_URL` or the supported `SQL_*` fallback values. Run `npx prisma generate` during build or deployment setup, and apply migrations through the standard Prisma workflow before serving production traffic.

## Future Improvements

- Multi-model provider selection and per-conversation model preferences.
- File upload, document-aware chat, and retrieval-augmented generation.
- Conversation export to Markdown and PDF.
- Shared conversations and team workspaces.
- Rich in-answer source citations for web-search responses.
- Voice input and text-to-speech responses.
- Custom user-created tools and integrations.
- Usage analytics, token tracking, and cost monitoring.
- Automated summaries and long-context compression.

## License

No license has been specified for this repository. Add a license file before distributing or accepting external contributions.
