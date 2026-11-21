# Security review notes

Prepared ahead of the post-submission automated review (SAST / dependency / secret /
license scans), since findings are not visible before the submission phase closes.

## Attack surface

This is a **fully client-side single-page application**. There is no backend, no database,
no authentication, no session, no file upload, no user-generated content that reaches
another user, and no multi-tenancy. In its default mock mode the app makes **zero network
requests** after the initial page load.

That removes most of the categories a scanner looks for: no SQL, no ORM, no shell
execution, no deserialization of untrusted input, no SSRF sink, no path traversal, no
CORS/CSRF surface, no secrets in the repository or the bundle.

## Dependency and license posture

- `npm audit` → **0 vulnerabilities**.
- **4 runtime dependencies**: `react`, `react-dom`, `zod`, `zustand` — all on current
  majors.
- **9 dev dependencies**, on Vite 8 / Vitest 4 / TypeScript 5.9 / ESLint 9. TypeScript and
  ESLint are deliberately held one major back (see README → Assumptions); neither has a
  known CVE.
- `package-lock.json` is committed, so installs are reproducible and version-pinned.
- `package.json` declares `"private": true` and `"license": "UNLICENSED"` so license
  scanners do not report an unknown/missing license for the submission package itself.

## The one real security decision

**Optional live mode keeps an Anthropic API key in `localStorage` and calls the Anthropic
API directly from the browser** (`src/providers/live.ts`).

- It is **off by default**. No puzzle, test, criterion, or documented review step needs it.
- With no backend, there is nowhere server-side to hold a key. The alternatives were
  browser-direct with clear disclosure, or dropping live mode entirely — and the spec asks
  the README to explain how to configure an optional AI provider.
- The key is entered by the user, into a `type="password"` field, never appears in the
  built bundle, and is sent only to `https://api.anthropic.com`. It is never logged: the
  codebase contains exactly one `console` call — `console.error` in
  `src/ui/ErrorBoundary.tsx`, which logs a caught `Error` and React's component stack so a
  crash is diagnosable. It does not touch settings, run payloads, or the key.
- ⚙️ Settings shows an explicit disclosure of exactly this, and offers **Clear stored key**.
- `.gitignore` excludes `*.local`; there is no `.env` in the repository and none is needed.

If a scanner flags "sensitive data in browser storage" here, that is a **true positive in
pattern but an accepted, disclosed design decision in context** — user-supplied credential,
opt-in, single destination, no server, no other party, revocable in one click, and fully
avoidable by never enabling the feature.

## Likely automated findings, and why they are safe

| Pattern a scanner may flag | Why it is safe here |
|---|---|
| Hardcoded-secret hit on `sk-ant-…` | `src/ui/SettingsModal.tsx` sets `placeholder="sk-ant-…"` on the key input — a UI hint showing the expected format. It is a literal ellipsis, not a key: no secret material, no valid prefix length, and nothing is authenticated with it. A regex looking for the `sk-ant` prefix will match it; there are no other matches in the repository. |
| API key written to `localStorage` | User's own key, opt-in, disclosed in-app, clearable, never logged or bundled. See above. |
| `anthropic-dangerous-direct-browser-access` header | Required by Anthropic's API to permit browser-origin calls. The name describes the general practice, not a vulnerability in this call. Only sent in opt-in live mode. |
| `structuredClone` / `JSON.parse` on step output | Parsing the app's own committed mock fixtures, or text from a provider the user chose. Parse failure is caught and converted to a `{malformed, raw}` value that validators handle — it never throws into the UI. |
| Dynamic dispatch by preset id (`kit.task(id)`, `kit.tool(id)`) | Lookup in a frozen, committed object literal defined in `src/puzzles/*.ts`. Ids come from the app's own workflow model, never from user free-text. This is not `eval` and executes no user-supplied code. |
| React rendering of run output / trace payloads | All values render as text through JSX. There is **no** `dangerouslySetInnerHTML` anywhere in the codebase, so payloads cannot inject markup. |
| User-editable JSON in the human-review modal | Parsed with `JSON.parse` inside `try/catch`, then validated against the step's Zod schema before it is allowed to continue. Invalid input disables the submit button. |
| `localStorage` for puzzle progress | Non-sensitive UI state (which workflow you built, which goals you met). Wrapped in `try/catch` so private-mode browsers degrade gracefully. |
| Missing security headers | Addressed for hosted deploys: `netlify.toml` and `vercel.json` both set a strict CSP plus `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and `Permissions-Policy`. Local `npm run dev` is Vite's dev server, where headers are not applied by design. |

## Content-Security-Policy (hosted deploys)

Both deploy configs send:

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.anthropic.com;
base-uri 'self'; form-action 'none'; frame-ancestors 'none'; object-src 'none'
```

Two allowances are deliberate and worth explaining before a scanner flags them:

- **`style-src 'unsafe-inline'`** — required for React *style attributes* only (the
  reliability bar widths, the confetti colours). No inline `<script>` is allowed;
  `script-src` stays `'self'`.
- **`connect-src https://api.anthropic.com`** — used only by the opt-in live AI provider.
  In default mock mode the app issues no network requests at all after load.

This policy was verified against the real production bundle rather than assumed: the built
`dist/` was served from a plain static server with the identical policy injected as a
`<meta http-equiv>` tag, then a puzzle was played to a 100/100 completion. Zero CSP
violations and zero console errors.

## Verification commands

```bash
npm ci
npm audit
npm run verify   # typecheck + 127 tests + production build
```

A repository-wide grep for the usual risk markers returns nothing:

```bash
grep -rnE "eslint-disable|TODO|FIXME|dangerouslySetInnerHTML|innerHTML|\beval\(|new Function" src/
```

(Search for `eval(` without the word boundary and it will match `mkRetrieval(`, a step
factory in the puzzle definitions — worth knowing if a scanner reports it.)

The only intentional `console` call is the error boundary's crash log:

```bash
grep -rn "console\." src/
# src/ui/ErrorBoundary.tsx: console.error('Workflow Puzzle Lab crashed:', error, info.componentStack)
```
