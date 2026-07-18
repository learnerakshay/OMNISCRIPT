# OMNISCRIPT

An AI-powered engineering assistant built with modern full-stack technologies.

## Features

- AI Chat
- Streaming Responses
- Tool Calling
- Live Web Search (Tavily)
- Chat Branching
- Clerk Authentication
- Prisma
- PostgreSQL

## Tech Stack

- React
- TypeScript
- Vite
- Express
- Prisma
- Clerk
- OpenAI SDK

## Installation

```bash
npm install
npm run dev
```

## Environment and Render deployment checklist

Configure these values as server-side environment variables in Render. Do not expose any secret through a `VITE_` or `NEXT_PUBLIC_` variable.

- `OPENAI_API_KEY` — required for AI generation.
- `TAVILY_API_KEY` — required for the Web Search tool; create it in the Tavily dashboard.
- `CLERK_SECRET_KEY` — required by the Express authentication middleware.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — required by the browser Clerk client.
- `DATABASE_URL` — PostgreSQL connection string for Prisma, or the existing `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, and `SQL_DB_NAME` configuration.

## Status

🚧 Under Active Development
