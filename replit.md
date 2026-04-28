# Workspace

## Overview

pnpm workspace monorepo — Bridge ELO Tracker web app plus a shared Express API server and PostgreSQL database.

## Apps

- **Bridge ELO Tracker** (`artifacts/bridge-elo`) — React + Vite frontend at `/`. Lets a bridge card game group track player ELO ratings across tournament sessions. Replaces their Excel spreadsheet.
- **API Server** (`artifacts/api-server`) — Express 5 backend at `/api`. Hosts all endpoints.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + TanStack Query + Wouter
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec) — single-mode for zod to avoid duplicate exports
- **Build**: esbuild (CJS bundle for server)

## ELO Algorithm

All players start at 1500. For each tournament round:
1. Each player who played has a reverse ranking (0 = last, n-1 = first)
2. V = sum of all reverse rankings
3. expected_i = 1 / (1 + 10^((1500 - ELO_i) / 400)) for players who played
4. AG = sum of all expected scores
5. diff_i = (ranking_i / V) - (expected_i / AG)
6. max_rank = MAX of all reverse rankings in this round
7. new_ELO_i = ELO_i + 16 * diff_i * max_rank

## Database Tables

- `players` — id, name, created_at
- `tournaments` — id, sequence_index, label, created_at
- `tournament_rankings` — id, tournament_id, player_id, reverse_ranking (nullable), unique(tournament_id, player_id)

## Seeded Players

Phillip, Eric, Gabby, Len, Peter, Morgan, Jazlene, Ewa, Andrew, John

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Important Notes

- The Orval config uses `mode: "single"` for Zod schemas (in `lib/api-spec/orval.config.ts`) to avoid duplicate export conflicts between Zod schemas and TypeScript interfaces.
- `lib/api-zod/src/index.ts` only exports from `./generated/api` (not `./generated/types`) for the same reason.
- ELO computation is server-side in `artifacts/api-server/src/lib/elo.ts` — the `/elo-history` endpoint returns the full computed history.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
