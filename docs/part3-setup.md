# Person 3: setup and integration

Code is on `person3`, including Person 2's merged Firebase code and basic Vite skeleton. All 38 tests and the build pass in this checkout. Person 1's Customer screens and routing are pending. No live project, domain, email delivery or search verification has been claimed.

## 1. Get the first website address

Vercel hosts the website. Start with its included `*.vercel.app` address; connect a custom domain afterwards.

1. Sign in to [Vercel](https://vercel.com/) with access to the GitHub repository.
2. Choose **Add New → Project**, import `Aziz-gjh/webforge_Repo`, and select **Vite**. Keep the repository root. The checked-in configuration runs `npm run build` and serves `dist/`. The package's Node engine selects 24.x; use Node 24.12 or newer locally to satisfy the merged Firebase SDK requirements. See [Vercel's Node configuration](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
3. Use `main` as the production branch. Once pushed, `person3` should get a preview; merge through the team's usual review process. The current skeleton builds but shows the Vite starter until Person 1's screens and routes are integrated.
4. Record the actual deployed address in the README. The competition still needs a custom domain; the Vercel address is useful while DNS is being prepared.

The optional Vercel integration can help operate the project after connection. It is not connected in this session.

## 2. Integrate the Provider page

Person 1 adds this to the existing routes in `src/App.tsx`:

```tsx
import ProviderSchedule from './pages/provider/ProviderSchedule';

// Inside the existing Routes:
<Route path="/provider" element={<ProviderSchedule />} />
```

Person 2's merged code provides `useAuth`, `useIsProvider`, `watchBookingsForDate`, `cancelBooking`, `markCompleted` and `riyadhToday`. The Provider page type-checks against these actual imports. Confirm the deployed rules/indexes with Person 2. After the Provider signs in once, Person 2 creates `providers/{uid}` for that account.

The page uses local controls while Person 1's component props are unknown. Its scoped CSS reads shared theme variables and has dark/sand/teal fallbacks. Adopt Person 1's `Button`, `StatusBadge` and `ConfirmDialog` when their interfaces are agreed. The watcher has no asynchronous error callback; agree any extension with Person 2 first. The page currently provides an initial-load timeout and Retry.

The merged package includes `firebase-admin` and `resend`. Provider test dependencies `jsdom`, `@testing-library/react` and `@testing-library/user-event` are now recorded in the manifest and lockfile. Keep these additions and the Node engine requirement when integrating Person 1's package changes. The tests work with the merged React 18 / Vitest 2 setup.

## 3. Configure Vercel environment variables

Open **Project → Settings → Environment Variables** and redeploy afterwards. Keep secret values in the dashboard, out of chat and Git.

| Variable | Value / owner | Scope |
| --- | --- | --- |
| `VITE_FIREBASE_*` | Exact names/config from Person 2's `.env.example` | Production and approved previews |
| `FIREBASE_SERVICE_ACCOUNT` | Entire JSON from the correct Firebase project's **Project settings → Service accounts** | Server only; Production |
| `RESEND_API_KEY` | Resend sending key | Server only; Production |
| `CRON_SECRET` | Long random secret; at least 32 random bytes recommended | Server only; Production |
| `APP_URL` | Actual HTTPS origin, e.g. `https://your-project.vercel.app`; no path/query/fragment | Server only; Production |
| `REMINDER_FROM` | Recommended: `AlUla Site Tours <reminders@your-verified-domain>` | Server only; Production |

Without `REMINDER_FROM`, the endpoint uses `reminders@` plus the `APP_URL` hostname. Set it explicitly when the website and verified email domain differ.

Person 2 adds the actual production and tested preview hostnames under **Firebase Authentication → Settings → Authorized domains**. Enter hostnames without `https://` or paths. Add `localhost` explicitly for local development if needed; newer projects do not include it by default. See [Firebase's guidance](https://firebase.google.com/docs/auth/faq-and-troubleshooting).

The Reminder query uses `bookings` with equalities on `date` and `status`. Firestore normally merges the single-field indexes for this query. If this project's policy requires another index, give Person 2 the error's index link; they own the index configuration.

## 4. Connect the domain using Cloudflare

A domain is an address the team controls, such as `example.com`. The app can use `tours.example.com`. Cloudflare holds the DNS records. Check whether a teammate owns a suitable domain before buying anything.

1. In Vercel **Settings → Domains**, add the chosen hostname.
2. Copy the exact CNAME target Vercel shows. In Cloudflare, create a CNAME with the subdomain prefix as its name, that target as its value, and **DNS only** (grey cloud).
3. Add any ownership TXT record Vercel requests. Preserve unrelated existing DNS records.
4. Wait for valid configuration and HTTPS, then update `APP_URL` and Firebase's authorized hostname.

Use Vercel's displayed target rather than assuming the older general-purpose target in the original plan. See [Vercel's domain instructions](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

Once the address is known, replace the example below with the real origin:

```sh
python3 docs/configure-domain.py https://tours.example.com
```

Review and commit the changed metadata, robots.txt and sitemap.xml. The current `.invalid` sitemap host and missing Sitemap directive mark unfinished setup.

## 5. Enable Reminder email

1. In [Resend](https://resend.com/), add a domain the team controls.
2. Copy its exact DNS records into Cloudflare. Keep email-related CNAME records DNS only; enter TXT/MX values as supplied by Resend. Wait for domain verification.
3. Set `RESEND_API_KEY` and `REMINDER_FROM` in Vercel, then redeploy.
4. Check **Settings → Cron Jobs** for `/api/send-reminders` with `0 15 * * *`. Vercel runs cron on production and sends the configured `CRON_SECRET` as a bearer token. On Hobby it may invoke anywhere in 18:00–18:59 Riyadh. See [cron documentation](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
5. Make a Confirmed Booking for tomorrow and use the [demo trigger](demo-runbook.md). Check both the endpoint result and the actual inbox.

The endpoint accepts GET. With configuration present it returns 401 without the token, 200 with `{ sent, skipped }` on success, or 500 with failure counts for partial failures. A missing cron secret returns 503. Retry after fixing a failure: persisted sent markers skip previous sends, and Resend reuses unchanged Bookings' idempotency keys.

## 6. Search and measurements

1. In [Search Console](https://search.google.com/search-console), add a Domain property, add its TXT record to Cloudflare and verify.
2. Submit the final `/sitemap.xml`, containing the public `/` and `/book` routes, after replacing the placeholder host.
3. In [Bing Webmaster Tools](https://www.bing.com/webmasters/), import the verified property from Search Console and confirm the sitemap.
4. Run [PageSpeed Insights](https://pagespeed.web.dev/) on production for mobile and desktop. Save actual scores, screenshots, tested URL and date in `docs/evidence/`.

## Remaining delivery checks

- [x] Merge the basic skeleton and Firebase implementation; pass all 38 tests and the build.
- [ ] Integrate Person 1's Customer screens and wire `/provider`.
- [ ] Set the real production address and server environment variables.
- [ ] Deploy, verify domain/auth/email and run the production demo.
- [ ] Verify search services and collect PageSpeed and responsive evidence.
