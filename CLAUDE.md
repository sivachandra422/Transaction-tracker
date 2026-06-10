# Transaction Tracker — Repository Map & Engineering Guardrails

Android-first expense tracker: React 19 + TypeScript + Capacitor frontend, Express
backend (Vercel serverless in prod), Supabase Postgres + Auth, Dexie (IndexedDB)
offline cache, Notion sync, Gemini/OpenRouter/OpenAI transaction parsing.

## Guardrails (apply to every change)

1. **No dead code.** Every new component, hook, service, or page MUST be imported
   and rendered/called from the live tree before the change is committed. Verify by
   tracing the import graph below from the entry points.
2. **No duplicate versions.** Never create `FooV2`, `FooNew`, `Foo2`, or a parallel
   page/component that overlaps an existing one. Replace the existing implementation
   in place and delete what it obsoletes.
3. **Keep the repo buildable.** `npm run lint && npm run typecheck && npm test &&
   npm run build` must all pass before committing. CI enforces this.
4. **Do not break the APK pipeline** (`.github/workflows/android.yml`):
   `vite build` → `npx cap sync android` → Gradle.
5. **Update this map** when files are added, moved, or deleted.

## Import graph (entry points → leaves)

### Frontend (Vite entry: `index.html` → `src/main.tsx`)

```
src/main.tsx
├─ providers/ErrorBoundary.tsx
├─ services/secureStorage.ts        (Capacitor Preferences wrapper, init at boot)
└─ App.tsx                          (single-file app: tabs = dashboard|add|rules|charts|notion|ai)
   ├─ components/AndroidFrame.tsx   (device chrome shell; phone frame on ≥sm screens)
   ├─ components/BottomNav.tsx
   ├─ components/TransactionRow.tsx (virtualized rows via @tanstack/react-virtual)
   ├─ components/NotionSettings.tsx → services/notionApi.ts
   ├─ components/AiSettings.tsx
   ├─ store/transactionStore.ts    (zustand+persist) → services/db.ts (Dexie)
   ├─ store/settingsStore.ts       (zustand+persist) → services/secureStorage.ts
   ├─ store/syncStore.ts           (zustand, per-tx Notion sync status)
   ├─ services/aiApi.ts            → services/apiClient.ts
   ├─ services/notionApi.ts        → services/apiClient.ts
   ├─ services/supabase.ts         (auth + transactions CRUD)
   ├─ constants/index.ts           (categories, colors, heuristics, storage keys)
   └─ types.ts
```

### Backend (entries: `server.ts` dev/self-host, `api/index.ts` Vercel)

```
server.ts / api/index.ts
├─ backend/routes/ai.ts        → validators/aiValidators.ts, services/aiService.ts
├─ backend/routes/notion.ts    → validators/notionValidators.ts, services/notionService.ts
├─ backend/middleware/errorHandler.ts · rateLimiter.ts · requestLogger.ts
└─ backend/services/*          → backend/utils/retry.ts
```

Routes mount: `/api/health`, `/api/parse-transaction` (ai router), `/api/notion/*`
(search-pages, create-database, verify, sync). `vercel.json` rewrites `/api/*` →
`api/index`.

### Tests (Vitest, happy-dom)

`src/services/apiClient.test.ts`, `src/store/transactionStore.test.ts`,
`backend/services/aiService.test.ts`, `backend/utils/retry.test.ts`.

## Commands

- `npm run dev` — Express + Vite middleware on :3000
- `npm run lint` / `typecheck` / `test` / `build` — CI quality gates
- Android: `npm run build && npx cap sync android && cd android && ./gradlew assembleDebug`

## Known debt (priority order)

- **P0** `src/App.tsx` (~2,200 lines) holds onboarding/auth, dashboard, add/edit
  form, rules, and charts inline. Decompose into `src/pages/*` + `src/hooks/*`,
  replacing sections in place (guardrail 2). Form state is shared across tabs
  (SMS-sim and edit flows pre-fill the add form), so lift it to a store, not props.
- **P1** `alert()`/`confirm()` used for user feedback — replace with toasts/dialogs.
- **P1** Supabase URL/anon key have hardcoded fallbacks in `src/services/supabase.ts`
  (anon key is public-by-design, RLS must stay enforced; prefer env injection).
- **P2** No Supabase migrations are versioned in-repo; no sync/conflict queue between
  Dexie and Supabase.
