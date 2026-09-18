# Synthetic portfolio demo

The demo is an independently runnable, read-only static environment. It displays ten deliberately labelled fictional prospects, three fictional leaders, two sample seasons, N/A ratings, distinct historical evaluations and illustrative activity. No fixture was copied or anonymized from private records. The banner makes this explicit on every view.

`demo/data.mjs` is its only data source. `demo/app.mjs`, `demo/style.css` and `demo/index.html` render dashboard counts, sample queues, searchable prospects, profile/evaluator comparisons and seasonal navigation. All dates use January 15, 2027 as the fixed sample day, so the story is reproducible. Activity is explicitly illustrative. The demo has no save, import, login or write endpoint.

Build and run it alone:

```sh
npm run build:demo
python3 -m http.server 3001 --directory public/demo
```

Open `http://localhost:3001`. No environment variables, Supabase project, Google account or private application server are needed. Only the generated `public/demo/` directory is required to publish the standalone demo on a static host. It contains no server artifacts or credentials.

The normal app's development/build scripts generate the same directory automatically. The existing Next.js/Vercel deployment serves it at `/demo/` after the Phase 7 PR merges. The production private workspace still uses its original server identity guard and RLS. `APP_ENV=demo` does not disable either guard. Public demo requests do not call Auth or Supabase, and no demo control can navigate to a private write action. This is isolation of data and runtime, without creating a second production database or changing the existing project.

Explore the sample dashboard, search for Demo Prospect 01, inspect its per-attribute averages and N/A values, then switch between 2027 and 2026. The previous season has its own result and ratings. Demo Prospect 10 has no evaluations; Demo Prospect 09 includes an all-N/A submission. These distinguish missing evaluations from explicit N/A without inventing numeric zeroes.

Hosted browser tests run anonymously, check real rendered counts and search, verify current/historical rating separation, mobile width, browser errors and resource requests, and confirm the private fixture provider received no Auth calls. Screenshots contain only synthetic records.
