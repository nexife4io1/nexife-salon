# End-to-end tests (placeholder)

Playwright is not installed yet (no unnecessary dependencies in the skeleton).
Roadmap step 13 adds it with a small smoke suite:

1. `login → dashboard` (demo account `sarah`)
2. `branches → add branch → branch detail` (requires DATABASE_URL)
3. `book appointment → check out → payment appears in billing`

Setup when ready: `npm i -D @playwright/test && npx playwright install chromium`,
then add `playwright.config.ts` with `webServer: { command: "npm run dev" }`.
