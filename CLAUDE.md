# CLAUDE.md

Guidance for working in the **labs-itbd** repository.

## What this is

An internal ITBD web platform ("Labs ITBD") hosting two assessment modules behind a shared dashboard:

- **Interview** — candidates record audio answers to module questions; audio is transcribed (Deepgram, falling back to OpenAI Whisper) and evaluated by OpenAI. Admins manage modules, question banks, standard responses, and review results.
- **Email Assessments** — candidates respond to email scenarios; responses are scored against rubrics (OpenAI + manual override). Admins manage scenarios, prompts, sessions, and submissions.

Both modules share one MySQL database, one auth layer (Microsoft Entra ID SSO), and one background-job queue.

## Stack

- **Next.js 16** (App Router, React 19, RSC) + **TypeScript** (strict)
- **Tailwind CSS v4** (CSS-first config in [app/globals.css](app/globals.css); no `tailwind.config`) + **shadcn/ui** (new-york style, Radix primitives, lucide icons)
- **Drizzle ORM** over **MySQL/MariaDB** (`mysql2` pool)
- **Auth.js v5 (next-auth beta)** with the Drizzle adapter, Microsoft Entra ID as the only provider
- **OpenAI** / **Vercel AI SDK** (`ai`, `@ai-sdk/*`) for evaluation; **Deepgram** for transcription
- **Zod** for validation, **react-hook-form** for forms, **sonner** for toasts, **recharts** for charts

## Commands

```bash
npm run dev        # next dev (port 3000)
npm run build      # next build
npm run start      # next start -p 3001
npm run lint       # eslint
npm run db:push    # node sync-schema.mjs — apply Drizzle schema to the DB
```

There is no test suite. Verify changes with `npm run lint` and `npm run build`.

## Layout

- `app/` — App Router. `app/api/**` route handlers, `app/dashboard/**` pages. Routes are grouped `interview/` and `emailAssessment(s)/`, each with a nested `admin/` surface.
- `components/ui/` — shadcn primitives (generated; avoid hand-editing). `components/app_componentes/` — shared app widgets. `components/interview/`, `components/emailAssessment/` — feature components.
- `lib/interview/`, `lib/emailAssessment/` — feature business logic (AI services, scoring, rubrics, orchestration). `lib/backgroundJobs*.ts` — the job queue. `lib/utils.ts` — the `cn()` helper.
- `DB/` — `schema.ts` (auth tables + `backgroundJobs` + shared users/roles), `interviewSchema.ts`, `emailAssessmentSchema.ts`, `drizzle.ts` (pooled client).
- `hooks/`, `types/` — shared React hooks and TS types.
- Path alias: `@/*` maps to the repo root (e.g. `@/lib/utils`, `@/DB/schema`).

## Conventions

- **Server-first.** Prefer RSC and server-side data access via `@/DB/drizzle`. Mark client components with `"use client"` only when they need interactivity.
- **Imports** use the `@/` alias, not deep relative paths.
- **Buttons**: use `components/app_componentes/customButtons.tsx` (`DefaultButton`, `GreenButton`) which wrap the shadcn `Button` and add a `loading` state. Style with variants + `cn()`, not inline styles.
- **DB access** goes through the shared `db` export in [DB/drizzle.ts](DB/drizzle.ts). Never create ad-hoc pools — the singleton is cached across HMR to avoid exhausting connections. Email-assessment tables are prefixed `email_assessment_`; the shared `users` table is the source of truth for identity.
- **Background work** goes through [lib/backgroundJobs.ts](lib/backgroundJobs.ts) (MySQL-authoritative queue, no Redis). Register handlers in `lib/backgroundJobHandlers.ts`.
- **Auth & roles**: roles are resolved in [auth.config.ts](auth.config.ts) from email whitelists (`devAdmin`, `executive`) and persisted to `users.role`; the JWT callback re-syncs role/`sessionVersion` from the DB (~30s throttle). Gate admin routes/UI on `session.user.role`.
- **Validation**: validate API input with Zod (see `lib/validation/`).
- Match the surrounding file's style. Keep the explanatory comment density already present in `DB/` and `lib/` files when documenting non-obvious reliability logic.

## Environment

Copy `.env.example` to `.env.local`. Key vars: `DATABASE_URL`, `AUTH_SECRET`, `AZURE_AD_CLIENT_ID/SECRET/TENANT_ID`, `OPENAI_API_KEY`, `DEEPGRAM_API_KEY`. Never commit real secrets.

---

# ITBD Design Standards

**MANDATORY.** All UI must use only the official ITBD brand palette. Do not introduce other accent or brand colors.

| Token | Value | Usage |
|-------|-------|-------|
| ITBD Green | `#bed62f` | Primary brand accent, primary CTAs, active/success emphasis |
| ITBD Blue | `#00afdd` | Secondary accent, links, informational highlights |
| White | `#ffffff` | Backgrounds, surfaces, on-dark text |
| Black | `#000000` | Text, on-light foreground, high-contrast surfaces |

## Rules

1. **Palette is closed.** Use white, black, ITBD green (`#bed62f`), and ITBD blue (`#00afdd`) only. Neutral grays already present via shadcn tokens (`muted`, `border`, `input`) are permitted for structure, but no additional hues, gradients, or third-party brand colors.
2. **Green is primary, blue is secondary.** Lead with green for the main action on a screen; use blue for secondary/informational emphasis and links. Don't put green and blue in equal competition on the same element.
3. **Contrast.** ITBD green is a light-lime — it needs **black text on top**, never white. ITBD blue works with white or black text depending on weight; verify WCAG AA (4.5:1 for body text) before shipping.
4. **Use tokens, not hardcoded hex.** Reference colors through the theme layer, not literal `#bed62f` scattered in JSX. See "Applying the palette" below.
5. **Dark mode.** The app supports light/dark via `next-themes`. Any new color must be defined for both `:root` and `.dark` in [app/globals.css](app/globals.css) so both themes stay on-brand.
6. **Both modules share these standards.** Interview and Email Assessment UI must look like one product.

## Applying the palette

Theme colors are defined as CSS variables in [app/globals.css](app/globals.css) and exposed to Tailwind via `@theme inline`. To brand the app, set the semantic tokens to the ITBD palette rather than editing every component. Suggested mapping (add to the `:root` / `.dark` blocks):

```css
:root {
  /* ITBD brand */
  --itbd-green: #bed62f;
  --itbd-blue: #00afdd;

  --primary: var(--itbd-green);
  --primary-foreground: #000000;  /* black text on the light-lime green */
  --ring: var(--itbd-blue);
}
```

Then in components, use the semantic Tailwind classes (`bg-primary`, `text-primary-foreground`, `ring-ring`, etc.) and the `Button` variants — never inline hex. For one-off brand accents, add a dedicated token (e.g. `--color-itbd-blue`) to the `@theme inline` block and reference it as `text-itbd-blue` / `bg-itbd-blue`.

- Prefer the existing `Button` / `customButtons` variants for actions.
- New shadcn components inherit the tokens automatically — brand once at the token layer.
