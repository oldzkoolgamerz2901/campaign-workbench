# FC1 developer fixture

This isolated Angular build exercises the production layout renderer with JSON emitted by the real backend engine. It is not a product route, API mock or part of the production entry point.

From `backend`, run `./gradlew test --tests workbench.CardLayoutTest` to generate `build/card-layout/layouts.json`. Then from `frontend`, run `npx playwright test --config layout-fixture/playwright.config.ts`. Its owned Angular server uses port 4202 and needs no database/backend server. Screenshots are temporary evidence in ignored `test-results/`.

The duplicated frontend/backend TTF assets must have identical SHA-256 hashes. Font files and their SIL Open Font License notices originate in Google Fonts' `ofl/ptsans` and `ofl/ptserif` directories. See `public/fonts/README.md` for pinned hashes and source locations.
