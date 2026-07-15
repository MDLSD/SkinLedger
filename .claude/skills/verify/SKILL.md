---
name: verify
description: Build, launch and drive SkinLedger (Next.js + NextAuth + Prisma/SQLite) to verify changes end-to-end over HTTP.
---

# Verify SkinLedger

## Build & launch

```bash
npm run build                      # prod build (Turbopack), typechecks too
npm run start -- -p 3789           # run in background; wait until curl / returns 200
```

Dev server alternative: `npm run dev -- -p 3789` (slower first paint, no rebuild needed).

DB: SQLite at `prisma/dev.db` (env `DATABASE_URL="file:./prisma/dev.db"`, resolved from repo root).
Migrate: `npx prisma migrate dev`; seed platforms: `npx prisma db seed`.
Test user: `test@example.com` / `password123`.

## Driving server actions without a browser (progressive enhancement)

Forms rendered by `useActionState` can be POSTed with curl. Extract hidden fields from the page HTML first:

```bash
HTML=$(curl -s -c cookies.txt http://localhost:3789/login)
ACT=$(echo "$HTML" | grep -o 'name="\$ACTION_1:0" value="[^"]*"' | sed 's/.*value="//;s/"$//' | sed 's/&quot;/"/g')
KEY=$(echo "$HTML" | grep -o 'name="\$ACTION_KEY" value="[^"]*"' | sed 's/.*value="//;s/"$//')
curl -s -L -b cookies.txt -c cookies.txt -X POST http://localhost:3789/login \
  -F '$ACTION_REF_1=' -F "\$ACTION_1:0=$ACT" -F '$ACTION_1:1=[{}]' -F "\$ACTION_KEY=$KEY" \
  -F 'email=test@example.com' -F 'password=password123'
```

Success = redirect chain ends at `/app` (200). Auth guard: unauthenticated GET `/app` → 307 to `/login`.

Gotchas:
- Forms without bound args (e.g. logout in the /app header) render a single
  `name="$ACTION_ID_<hash>"` hidden input instead — POST just that field:
  `curl -X POST ... -F '$ACTION_ID_<hash>='`.
- Action IDs change on every build — always re-extract after rebuilding.
- "Failed to find Server Action" in the server log = stale/wrong action id.
- Error messages from actions come back embedded in the HTML response — grep for the Russian message text.
- Read the server's background output file for `[auth][error]` lines when auth misbehaves.

## Direct DB inspection

```bash
npx tsx -e "
import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './src/generated/prisma/client';
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }) });
prisma.user.findMany().then(u => { console.log(u); return prisma.\$disconnect(); });
"
```
