---
AI Learning Adventure Workspace
---

# Pnpm Workspace

## Structure
- apps/learner-ui - Learner UI app
- apps/admin-ui - Admin UI app
- apps/api - Backend app
- packages - Shared stuff for the apps

## Alias
- @ai-learning-adventure/* -> packages/*

## How to run
- Start apps in background: `nohup pnpm run dev > dev.log 2>&1 < /dev/null &`; learns-ui runs at http://localhost:5173 , admin-ui runs at http://localhost:6173, api runs at http://localhost:4000
- Or start individual apps in `apps/learner-ui`, `apps/admin-ui` and `apps/api`

---

# Learner-ui app

## Styling
- Use desing tokens in `apps/learner-ui/src/styles/_token.scss` or `apps/learner-ui/src/styles/token.js`
- Add new design tokens to `apps/learner-ui/src/styles/tokens.json` and regenerate if required

---

# Admin-ui app

## Styling
- Use desing tokens in `apps/admin-ui/src/styles/_token.scss` or `apps/admin-ui/src/styles/token.js`
- Add new design tokens to `apps/admin-ui/src/styles/tokens.json` and regenerate if required

## Rules
- Do not mix with any style of `learner-ui` app
