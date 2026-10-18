# Criterion Real Estate LLC — recruiting

A static, ad-free page for newer agents considering Criterion Real Estate LLC, licensed in Connecticut and New York. It introduces the turnkey support package, company-generated leads, and a fair payout model, then collects an interest form.

There is no backend in this repo. The form is wired to one placeholder in [`public/config.js`](public/config.js). While `FORM_ENDPOINT` is empty, submit shows the success state, writes the payload to the browser console, and does not contact any server.

## Run locally

```bash
npm install
npm test
npm run dev
```

The dev server listens on [http://127.0.0.1:43123](http://127.0.0.1:43123).

Production build:

```bash
npm run build
npm run preview
```

Preview serves the `dist/` folder at [http://127.0.0.1:43129](http://127.0.0.1:43129).

Desktop and mobile screenshots are in `docs/screenshots/`. After a production build, regenerate them with `node scripts/verify.mjs` (system Chrome). That script also opens the built site under a `/criterion-recruits/` subpath and checks validation, the empty-endpoint success path, and a failed request.

## Deploy

The build is a static `dist/` folder. Asset URLs are relative (`base: './'` in `vite.config.js`), so the same output works at a domain root and at a GitHub Pages project subpath such as `/criterion-recruits/`.

### GitHub Pages

1. Push this repo to the CriterionRecruits account.
2. In the repo settings, set Pages to deploy with GitHub Actions.
3. The workflow in `.github/workflows/pages.yml` runs tests, builds `dist/`, and publishes it on every push to `main`.

### Netlify or Vercel

- Build command: `npm run build`
- Publish directory: `dist`
- No environment variables are required.

Change the form endpoint in `public/config.js` before you build. A rebuild is required after that edit, because `config.js` is copied into `dist/` as a plain file.

## Form endpoint

`public/config.js`:

```js
window.CRITERION_CONFIG = {
  FORM_ENDPOINT: "",
  FORM_HEADERS: {},
};
```

| `FORM_ENDPOINT` | What submit does |
| --- | --- |
| `""` (default) | Success state. Payload is logged with `console.log`. No network request. |
| `"https://…"` | `POST` JSON to that URL. Success on any 2xx response. The form stays filled and shows an error if the request fails. |

Only `http:` and `https:` URLs, or a relative path such as `/api/interest`, are sent. Other values are rejected in the page and nothing is transmitted.

The page does not load ads, analytics, trackers, or third-party badges. The typeface is self-hosted. Pointing `FORM_ENDPOINT` at a service is the first time lead data leaves the browser, and it goes only to the URL you set.

### Payload

```json
{
  "name": "Avery Cole",
  "email": "avery@example.com",
  "phone": "(203) 555-0100",
  "license_status": "Licensed",
  "years_licensed": "<1",
  "message": "",
  "consent": true,
  "utm_source": "",
  "utm_medium": "",
  "utm_campaign": "",
  "utm_term": "",
  "utm_content": "",
  "src": ""
}
```

`license_status` is one of `Licensed`, `In pre-licensing course`, `Not yet started`.

`years_licensed` is one of `Not yet`, `<1`, `1-2`, `3-5`, `5+`.

`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, and `src` are read from the page URL at submit time. A link such as `/?utm_source=instagram&utm_medium=bio&src=story` stores those values. Other query parameters are ignored. Missing values are empty strings.

### Supabase

Create a table that matches the payload, and allow anonymous inserts only. Do not put the service-role key in `config.js`. The anon key is public in a static site, so row level security has to reject reads and updates from `anon`.

```sql
create table public.recruiting_interest (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text not null,
  license_status text not null,
  years_licensed text not null,
  message text,
  consent boolean not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  src text
);

alter table public.recruiting_interest enable row level security;

create policy "anon can insert interest"
  on public.recruiting_interest
  for insert
  to anon
  with check (consent is true);
```

Then set:

```js
window.CRITERION_CONFIG = {
  FORM_ENDPOINT: "https://YOUR_PROJECT.supabase.co/rest/v1/recruiting_interest",
  FORM_HEADERS: {
    apikey: "YOUR_SUPABASE_ANON_KEY",
    Authorization: "Bearer YOUR_SUPABASE_ANON_KEY",
    Prefer: "return=minimal",
  },
};
```

The Supabase API must allow the page origin in CORS, which the REST endpoint does for requests that send the anon key.

### Any JSON form service

Use an endpoint that accepts `POST` with `Content-Type: application/json` and the body above. Put its URL in `FORM_ENDPOINT`. Add headers only if that service requires them. If a service expects form-encoded fields instead of JSON, it will not match this page without an adapter on that service.

While the endpoint is empty, the success panel says the note was not sent. After you connect an endpoint, a successful response says the note was sent and that the team may follow up.

## What this page does not claim

Copy stays qualitative. It does not state payout percentages, splits, fees, lead counts, or testimonials, and it does not name individual people or a street address.

## Extending the page

Each section is a block in `index.html`. Styles are in `src/style.css`. Validation, attribution, and submit behavior are in `src/validate.js`, `src/attribution.js`, and `src/submit.js`, covered by `npm test`. Add a new HTML file beside `index.html` if a separate view is needed later. Keep new behavior in `src/` rather than inline scripts.
