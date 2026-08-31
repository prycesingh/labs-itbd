# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Internal ITBD staff — the app is gated entirely by `@itbd.net` email whitelists over Microsoft Entra ID SSO, with no external/candidate-facing signup. Primary users are staff being assessed and trained: they complete spoken interview-practice modules, written email-response assessments, and hands-on technical Labs content (glossary, quizzes, simulators, checklists). Admins (`devAdmin`, `executive`) manage modules, question/scenario banks, and review or override results.

Note: `candidate`/`candidateId`/`assessor` naming throughout the interview and email-assessment schemas is inherited role vocabulary from the ported source systems (see Brand Commitments), not evidence of an external job-applicant audience — "candidate" resolves to any authenticated non-admin internal user.

## Product Purpose

Labs ITBD is a unified hands-on skills platform for internal staff development. It combines:

- **Interview** — spoken-answer practice, transcribed (Deepgram, falling back to Whisper) and evaluated by OpenAI against structured rubrics, with acoustic delivery scoring (pitch/pace analysis via meyda/pitchfinder/pitchy).
- **Email Assessments** — written email-scenario responses scored against weighted rubrics (professional tone, grammar, clarity/empathy, structure, completeness) with AI-generated-content detection and manual assessor override.
- **Labs** — a large library of reference/training content and hands-on simulators (Azure, M365, networking gear, KQL, DevOps, etc.), quizzes, glossary, and certification roadmaps.

Success means staff can practice and get consistent, rubric-based feedback on interview and written-communication skills, and build/verify hands-on technical skills, all from one dashboard — without relying on scattered spreadsheets, ad hoc grading, or disconnected LMS tools.

## Positioning

The differentiator is breadth and integration, not any single mechanism: one dashboard unifying AI-graded interview practice, AI-graded email-response scoring, and a deep library of hands-on technical simulators/reference content that would otherwise live in separate, disconnected tools. A competing product would need to replicate all three pillars under one roof, with one auth/role system and one admin surface, to truthfully claim the same position.

## Operating Context

- Auth is exclusively Microsoft Entra ID (Azure AD) SSO against the org's own tenant, plus a credentials-based "break-glass" admin bypass for accounts with a provisioned bcrypt hash.
- Roles (`devAdmin`, `executive`, `adminTeam`, `sales`, `taTeam`, `qateam`, `hrTeam`, `serviceDelivery`, `user`) are resolved via hardcoded/env-extendable email whitelists, not domain-wide rules; only `devAdmin` and `executive` are admin roles, `devAdmin` alone is superadmin.
- Forced dark theme (`forcedTheme="dark"`) is the current fixed visual state despite `next-themes` being present.
- App is explicitly non-public (`robots: noindex, nofollow`) — internal tool, not marketed externally.
- Background AI evaluation work runs through a MySQL-authoritative job queue (no Redis).
- **Labs ITBD is live in production** with real users — treat any redesign/refinement work as changes to a shipped surface, not a pre-launch build; preserve working flows and avoid disruptive changes without cause.

## Capabilities and Constraints

- Interview and Email Assessment modules were ported into Labs ITBD from prior standalone systems and had their role vocabularies remapped onto Labs ITBD's shared `users`/role model; admins/assessors retain the ability to manually override AI-generated scores in both modules.
- Real, substantial seed content already exists for the Labs module (glossary, quizzes, articles, checklists, cloud comparisons, KQL playground, cert roadmap — each a large authored dataset under `lib/labs/seedData/`).
- Interview question banks and Email Assessment scenarios are admin-authored/entered at runtime via admin forms, not shipped as static seed data — do not assume a populated question/scenario bank exists without checking.
- No accessibility-specific tooling or documented a11y standard exists; current accessibility support comes from the underlying Radix/shadcn primitives only, not from explicit product requirements.
- No confirmed deployment target (no Dockerfile, no vercel.json, no CI config found) — treat deployment environment as unconfirmed rather than assuming serverless or containerized hosting.

## Brand Commitments

- Product name: **Labs ITBD**. Tagline: "Real-world labs ✦ Real skills ✦ Real impact." Secondary copy: "Track, analyze, and improve your skills."
- The Interview and Email Assessment modules were ported from prior/sibling systems; internal schema comments refer to the shared source-of-truth system as **WMS**. This provenance is a real, load-bearing fact — preserve it as historical context, but do not expand "WMS" or invent details about it beyond what's recorded here.
- Existing brand assets: `public/itbd_logo_img.png`, plus `public/labs-logos/` and `public/login-images/`.
- Visual/brand rules are governed by the **IT By Design Brand Guidelines 2026** (parent-company brand system, confidential, internal/partner use only), enforced in this repo via the ITBD Design Standards section of CLAUDE.md (closed palette: black/white/ITBD Blue `#00ADDA` primary, Light Gray `#BFBFBF`, Neutral Gray `#252525`, Green `#bed62f` and Orange `#ff8b17` emergency-only; Inter primary typeface, Italian Plate No2 Expanded for display; dark foundation is the brand default). Every ITBD app, including Labs ITBD, must follow these guidelines — durable product truth here does not restate the token values, but treats compliance with them as a non-negotiable constraint on all future design work.
- Brand motion/imagery voice (from the same guidelines, applies to any imagery or animation work): visuals should read as **Confident, Intelligent, Human** — calm precision, subtle motion/light/depth suggesting "intelligent systems at work," people shown in authentic collaboration (not staged/stock), technology shown supporting people rather than dominating. Explicitly avoid: robots, circuit boards, binary code, "glowing brains," literal AI iconography, cartoon/flat-vector illustration, stiff corporate stock photography, cluttered or chaotic layouts, gimmicky animation.
- Logo usage is strict: the master lock-up is used unaltered (no recoloring, distortion, rotation, outline, drop shadow, gradient fill, or single-color-only version); only the provided app-icon/sticker/badge variants substitute for the full lock-up.

## Evidence on Hand

- Real, substantial content: Labs module seed data (glossary, quizzes, articles, checklists, cloud comparisons, gotchas, services catalog, KQL playground, cert roadmap) under `lib/labs/seedData/`.
- No confirmed real interview question bank or email-assessment scenario dataset — these are admin-entered at runtime; do not fabricate sample questions/scenarios as if they were shipped content.
- No testimonials, case studies, press, or external marketing assets exist or should be assumed — this is an internal, non-indexed tool.

## Product Principles

1. One dashboard, one identity, one role system — interview practice, email assessment, and Labs training content should feel like a single product, not three stitched-together tools.
2. AI evaluation is the workhorse, not the whole story — rubric-based AI scoring (interview, email) always supports, and can be overridden by, human admin/assessor judgment.
3. Internal-only by design — every product and access decision assumes an `@itbd.net`-whitelisted internal audience, never an external/public one.
4. Preserve ported provenance — the interview and email-assessment modules carry real history (from WMS-style prior systems); treat that as context to respect, not debt to silently erase.
5. Don't invent content — question banks, scenarios, and evaluation data are real operational content owned by admins; design and copy work must not fabricate sample data that looks shipped.

## Accessibility & Inclusion

No product-specific accessibility requirement has been established; current accessibility behavior is inherited from Radix/shadcn primitives only.
