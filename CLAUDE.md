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

**MANDATORY.** All UI must use only the official ITBD brand palette from the *IT By Design Brand Guidelines 2026*. Do not introduce other accent or brand colors.

| Token | Value | Role (per 2026 guidelines) |
|-------|-------|-----------------------------|
| ITBD Blue | `#00ADDA` | **Primary accent** — CTAs, links, active/informational highlights |
| Black | `#000000` | **Primary background** — dark foundation, high-contrast surfaces |
| White | `#FFFFFF` | **Primary text** on dark; light surfaces |
| Light Gray | `#BFBFBF` | Secondary text, muted labels |
| Neutral Gray | `#252525` | Elevated dark surfaces, cards, dividers on the dark foundation |
| ITBD Green | `#bed62f` | Sparing use as a *solid* accent (success/active); **freely usable inside blue↔green gradient blends** |
| ITBD Orange | `#ff8b17` | **Emergency use only** — avoid in product UI unless explicitly requested |

## Rules

1. **Blue is the primary accent, on a dark foundation.** The brand foundation is black / dark-gray backgrounds with white and ITBD Blue highlights. Lead with **blue** for the main action on a screen (`"The button/CTA should be in blue and white"`). Blue also carries links and informational emphasis.
2. **Green and orange are emergency-only as *solid* accents.** Per the guidelines, green (`#bed62f`) and orange (`#ff8b17`) are "use only in an emergency." Don't use green as a primary CTA fill or general solid brand color, and avoid orange in product UI unless explicitly asked. **Exception — gradient blends:** ITBD marketing sites commonly blend blue↔green in gradients (progress bars, glows, hero washes), so a blue→green gradient is on-brand and encouraged where it reads as a single energetic accent. The restriction is on green as a *standalone solid* primary, not on green *within* a blue-led gradient.
3. **Palette is closed.** Use only the tokens above. Neutral grays via shadcn tokens (`muted`, `border`, `input`) are permitted for structure. No additional hues, no third-party brand colors. Gradients are welcome — favor blue-led blue↔green (and subtle blue light) washes; keep them purposeful, not loud rainbow fills.
4. **Contrast.** ITBD Blue `#00ADDA` works with white or black text depending on weight — verify WCAG AA (4.5:1 body). ITBD Green is a light-lime — if ever used it needs **black text on top, never white**. On the dark foundation, body text is white/`#BFBFBF`.
5. **Use tokens, not hardcoded hex.** Reference colors through the theme layer, not literal hex in JSX. See "Applying the palette."
6. **Dark is the brand foundation.** The app supports light/dark via `next-themes`; the dark theme is the on-brand default direction. Any new color must be defined for both `:root` and `.dark` in [app/globals.css](app/globals.css) so both stay on-brand. (Design new surfaces to look correct on the dark foundation first.)
7. **Both modules share these standards.** Interview and Email Assessment UI must look like one product.
8. **Typography.** Primary typeface is **Inter** (high x-height, wide weight range). Display/hero headings may use **Italian Plate No2 Expanded** where available; otherwise fall back to Inter. Don't introduce other typefaces.

## Motion & imagery (brand)

- **Subtle, purposeful motion only.** The guidelines call for motion, glowing lines, and particle depth that suggest "intelligent systems at work" — used sparingly. Avoid chaotic or gimmicky animation that distracts from clarity. Favor calm confidence: small reveals, depth, blue light accents, forward momentum.
- **No clichés / no clutter.** No robots, circuit boards, binary, "glowing brains," heavy textures, or decorative filler. Every element serves a purpose.
- Animation work should follow these standards and the `/ui-ux-animation-designer` skill, which is aligned to them.

## Applying the palette

Theme colors are defined as CSS variables in [app/globals.css](app/globals.css) and exposed to Tailwind via `@theme inline`. Brand at the token layer, not per component. Suggested mapping (add to the `:root` / `.dark` blocks):

```css
:root {
  /* ITBD brand — 2026 */
  --itbd-blue: #00ADDA;
  --itbd-green: #bed62f;   /* emergency/sparing use only */

  --primary: var(--itbd-blue);
  --primary-foreground: #ffffff; /* white on blue; verify AA per weight */
  --ring: var(--itbd-blue);
}

.dark {
  /* dark foundation: black bg, neutral-gray surfaces, white text */
  --background: #000000;
  --card: #252525;
  --foreground: #ffffff;
  --muted-foreground: #BFBFBF;
  --primary: var(--itbd-blue);
  --primary-foreground: #ffffff;
}
```

Then in components use semantic Tailwind classes (`bg-primary`, `text-primary-foreground`, `ring-ring`) and the `Button` variants — never inline hex. For a one-off blue accent, add a dedicated token (e.g. `--color-itbd-blue`) to the `@theme inline` block and reference it as `text-itbd-blue` / `bg-itbd-blue`. If you genuinely need the emergency green, add `--color-itbd-green` and use it deliberately for a single success accent.

- Prefer the existing `Button` / `customButtons` variants for actions (blue primary).
- New shadcn components inherit the tokens automatically — brand once at the token layer.
