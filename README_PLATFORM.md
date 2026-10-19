# CODIHA Club platform setup

Everything below is one-time setup. Order matters: **Supabase → OAuth → .env → Brevo → Netlify**.

---

## 1. Fill in `.env`

`.env` already exists in the repo root (git-ignored). Here is what each value is and where to
find it:

| Variable | Where it comes from | Notes |
| --- | --- | --- |
| `PUBLIC_SUPABASE_URL` | Supabase → Project Settings → **API** → Project URL | e.g. `https://abcd1234.supabase.co` |
| `PUBLIC_SUPABASE_ANON_KEY` | same page → Project API keys → **anon / public** | safe in the browser, RLS protects the data |
| `SUPABASE_SERVICE_ROLE_KEY` | same page → **service_role** | **SECRET.** Bypasses RLS. Server-only. |
| `PUBLIC_SITE_URL` | you | `http://localhost:5173` locally, `https://club.codiha.com` in production |
| `CHECKIN_SECRET` | you, generate one | signs the rotating QR tokens, see command below |
| `CHECKIN_WINDOW_SECONDS` | you | `30` (how often the QR rotates) |
| `BREVO_API_KEY` | Brevo → SMTP & API → **API keys** | starts with `xkeysib-` |
| `BREVO_SENDER_EMAIL` | you | `hi@team.codiha.com`, must be verified in Brevo (section 4) |
| `BREVO_SENDER_NAME` | you | `CODIHA Club` |
| `BREVO_REPLY_TO` | you | usually the same as the sender |

Generate the check-in secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> `PUBLIC_*` variables are compiled into the browser bundle. Everything else is read at runtime
> on the server only (`$env/dynamic/private`), so rotating a secret on Netlify does not need a
> rebuild.

---

## 2. Supabase

1. Create a project at [supabase.com](https://supabase.com) (region: Europe West is closest to
   Algiers).
2. Open **SQL Editor → New query**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql)
   and run it. This creates:
   - tables: `profiles`, `semesters`, `points_ledger`, `badges`, `member_badges`, `events`,
     `event_registrations`, `event_attendance`, `hackathons`, `hackathon_applications`,
     `hackathon_winners`, `certificates`, `polls`, `poll_options`, `poll_ballots`, `poll_votes`,
     `email_log`, `site_settings`
   - views: `leaderboard`, `members` (public, safe projection of profiles), `my_points`
   - functions: `is_admin()`, `is_approved()`, `semester_bounds()`, `semester_points()`,
     `cast_vote()`, `poll_results()`, `verify_certificate()`
   - triggers that award points / certificates / badges automatically
   - **Row Level Security policies on every table**
   - storage buckets `covers` (public), `avatars` (public), `attachments` (private)
   - seed badges, the scoring periods (one per academic year) and the default colour palette
3. **Auth → URL Configuration**
   - Site URL: `https://club.codiha.com`
   - Additional redirect URLs (one per line):
     ```
     https://club.codiha.com/auth/callback
     http://localhost:5173/auth/callback
     https://*--<your-netlify-site>.netlify.app/auth/callback
     ```
4. **Make yourself admin.** Sign in once through the site with Google or Discord, complete the
   onboarding form, then run in the SQL editor:

   ```sql
   update public.profiles
      set role = 'admin', status = 'approved', approved_at = now(),
          onboarded_at = coalesce(onboarded_at, now())
    where email = 'you@example.com';
   ```

   From then on you approve everyone else from `/admin/members`.

### Scoring periods

Points accumulate over a **whole academic year** (1 September to 31 August) and only reset when
the next year starts. The periods live in `public.semesters` (the table kept its original name);
rows for 2024/2025 through 2027/2028 are seeded. Add the next one before it starts:

```sql
insert into public.semesters (name, starts_on, ends_on)
values ('2028/2029', '2028-09-01', '2029-08-31');
```

If no row covers today, the leaderboard falls back to all-time totals instead of showing zeros.

### Doing all of this from the terminal instead

Steps 2 and 4 above are copy-paste into the dashboard. [`scripts/db.mjs`](scripts/db.mjs) does
the same thing over the Management API (the endpoint the dashboard SQL editor itself calls), so
no Postgres driver and no database password are involved.

One-time: create a personal access token at
<https://supabase.com/dashboard/account/tokens> and put it in `.env`:

```
SUPABASE_ACCESS_TOKEN="sbp_...."
```

> That token is **account-wide**, far broader than the service-role key. It belongs in `.env`
> (git-ignored) only. Never add it to Netlify: the deployed site needs nothing but the anon and
> service-role keys.

Then:

```bash
npm run db:status                   # what exists, who is admin
npm run db:apply                    # applies supabase/schema.sql
node scripts/db.mjs apply supabase/migrations/0002_settings_and_year.sql
node scripts/db.mjs admin you@example.com
node scripts/db.mjs sql "select count(*) from public.profiles"
```

`db:status` on an empty project tells you so and points at `db:apply`. `admin` refuses with a
clear message if no profile row exists yet, since you have to sign in through `/login` once
before there is anything to promote.

### Migrations

`supabase/schema.sql` is the full, idempotent schema for a fresh project. If you already ran it
once, apply the incremental files in `supabase/migrations/` in order instead:

| File | What it does |
| --- | --- |
| `0002_settings_and_year.sql` | adds `site_settings` (the colour palette), widens the scoring period to a full academic year, and makes `semester_bounds()` return the period name |

---

## 3. OAuth providers

Both providers follow the same shape. Supabase owns **one** callback URL, and that is the only
URL the provider ever needs to know about:

```
https://<project-ref>.supabase.co/auth/v1/callback
```

`<project-ref>` is the subdomain in your `PUBLIC_SUPABASE_URL`. Your own site URLs
(`https://club.codiha.com/auth/callback`, `http://localhost:5173/auth/callback`) go in
**Supabase → Authentication → URL Configuration**, *not* at Google or Discord.

```
browser  →  /login  →  Supabase  →  Google / Discord  →  Supabase callback
                                                              ↓
                                             club.codiha.com/auth/callback
                                                              ↓
                                          /onboarding → /pending → /dashboard
```

### Google

1. **Create a project.** [Google Cloud Console](https://console.cloud.google.com) → project
   dropdown (top bar) → **New project** → name it `CODIHA Club` → **Create**, then make sure it
   is the selected project.
2. **Configure the consent screen.** *APIs & Services → OAuth consent screen*:
   - User type: **External** → **Create**
   - App name `CODIHA Club`, user support email, app logo (optional)
   - App domain: `https://club.codiha.com`
   - Authorised domains: add **`<project-ref>.supabase.co`** (the full host, e.g.
     `ytxgebknavqixnifmxxw.supabase.co`) and **`codiha.com`**.

     Do *not* enter a bare `supabase.co`: it is on the
     [Public Suffix List](https://publicsuffix.org), so Google treats it like `co.uk` and
     rejects it with *"Invalid domain: must be a top private domain"*. The registrable domain
     is your project ref plus the suffix.
   - Developer contact email → **Save and continue**
   - Scopes: **Add or remove scopes** → tick `.../auth/userinfo.email`,
     `.../auth/userinfo.profile`, `openid` → **Update** → **Save and continue**
   - Test users: while the app is in *Testing* only listed emails can sign in. Add your own, or
     skip ahead and publish.
   - **Publish app** (back on the consent screen). Those three scopes are non-sensitive, so
     Google does **not** require a verification review.
3. **Create the credentials.** *APIs & Services → Credentials → Create credentials →
   OAuth client ID*:
   - Application type: **Web application**
   - Name: `CODIHA Club web`
   - **Authorised redirect URIs → Add URI**:
     ```
     https://<project-ref>.supabase.co/auth/v1/callback
     ```
     (copy the exact string from Supabase → Authentication → Providers → Google, it is shown
     there as *Callback URL*)
   - **Create** → copy the **Client ID** and **Client secret**.
4. **Enable it in Supabase.** *Authentication → Providers → Google* → toggle **Enable Sign in
   with Google** → paste the Client ID and Client Secret → **Save**.

### Discord

1. [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**
   → name it `CODIHA Club` → accept the terms → **Create**.
2. *(optional)* **General Information** → upload the club icon and a description. This is what
   members see on the authorisation screen.
3. **OAuth2** in the left sidebar:
   - **Redirects → Add Redirect** → paste the same
     `https://<project-ref>.supabase.co/auth/v1/callback` → **Save Changes**
   - **Client information** → copy the **Client ID**, then **Reset Secret** → copy the
     **Client Secret** (it is only shown once)
4. **Enable it in Supabase.** *Authentication → Providers → Discord* → toggle on → paste both
   values → **Save**. Supabase requests the `identify email` scopes for you.
5. Discord only returns an email address if the member's Discord account has a **verified**
   email. If it does not, the profile is created with a null email and the member is asked for
   one during onboarding.

### Supabase redirect URLs (do this once, for both providers)

*Authentication → URL Configuration*:

- **Site URL**: `https://club.codiha.com`
- **Redirect URLs** (one per line):
  ```
  https://club.codiha.com/auth/callback
  http://localhost:5173/auth/callback
  https://*--<your-netlify-site>.netlify.app/auth/callback
  ```

The third line keeps Netlify deploy previews working. Without these, Supabase bounces the
login back to the Site URL and the `?next=` destination is lost.

### Checking it works

1. `npm run dev`, open `http://localhost:5173/login`, click **Continue with Google**.
2. You should land on `/onboarding`, then `/pending`.
3. Run the `update public.profiles … set role = 'admin'` statement from section 2.
4. Reload: the nav shows **Admin** and `/dashboard` opens.

---

## 4. Email: `team.codiha.com`

### Why a separate subdomain

`codiha.com` belongs to the parent company and the club must not touch its mail. Two names are
off limits and one is impossible:

| Name | Why not |
| --- | --- |
| `codiha.com` (apex) | holds the company's `MX` (ImprovMX) and its SPF record. Authenticating it in Brevo rewrites that SPF and can break company mail. |
| `club.codiha.com` | **technically impossible.** It is a `CNAME` to `codiha.netlify.app`, and DNS forbids any other record at a name that has a CNAME (RFC 1034 §3.6.2). The DKIM and SPF `TXT` records cannot coexist with it. Brevo's wizard offers to *replace* the CNAME, which takes the website offline. |
| `*.club.codiha.com` | records underneath a CNAME are ill-defined, and most DNS providers refuse to create them. |

So club mail lives on a **sibling** name, `team.codiha.com`. Everything below sits under that
label only: the apex `MX`, the apex SPF and the `club` CNAME are never touched.

The subdomain is deliberately role-neutral, because the role is carried by the part before the
`@`: `president@team.codiha.com`, `treasurer@team.codiha.com`, `hi@team.codiha.com`.

> In the Brevo wizard, authenticate **`team.codiha.com`**. Never `club`.
>
> Step 2 asks for a **branded subdomain**: enter `send`, giving `send.team.codiha.com`. It
> brands the tracked links inside your emails instead of showing a Brevo domain. Do not accept
> the suggested `mail` — it reads as a third meaning of "mail" in a zone that already has
> `mail._domainkey.team` (DKIM) and ImprovMX on `team` itself, which is how the wrong record
> gets deleted later.
>
> If it offers **Delegate**, use that to send the record list to whoever administers
> `codiha.com` DNS; they can add them without Brevo account access.

### DNS records (Namecheap → Advanced DNS)

Namecheap appends `.codiha.com` automatically, so enter the Host column exactly as written.

| Type | Host | Value | Why |
| --- | --- | --- | --- |
| TXT | `brevo-code.team` | the code Brevo shows | domain ownership |
| TXT | `mail._domainkey.team` | the DKIM key Brevo shows | signs outgoing mail |
| TXT | `team` | `v=spf1 include:spf.brevo.com include:spf.improvmx.com ~all` | authorises both senders |
| MX | `team` (priority 10) | `mx1.improvmx.com` | receiving |
| MX | `team` (priority 20) | `mx2.improvmx.com` | receiving |
| TXT | `_dmarc.team` | `v=DMARC1; p=none; rua=mailto:hi@team.codiha.com` | reports, no enforcement yet |
| CNAME | `send.team` | the target Brevo shows | brands tracked links |

⚠️ **Only one SPF record per name.** Brevo's and ImprovMX's includes must be merged into the
single `team` TXT record shown above. Two separate SPF records at the same host is a permanent
error and sends everything to spam.

`_dmarc.codiha.com` does not currently exist, so there is no parent policy for the subdomain to
inherit and nothing here changes that. Start at `p=none`, read the reports for a few weeks, then
consider `p=quarantine`.

### Mailboxes for the board and aliases for members

The `MX` rows point `team.codiha.com` at **ImprovMX**, the same free forwarder the parent domain
already uses. In the ImprovMX dashboard add `team.codiha.com`, then create one alias per person:

```
hi@team.codiha.com         → the club's shared inbox
president@team.codiha.com  → the president's personal address
treasurer@team.codiha.com  → ...
```

Unlimited aliases, free, no mailboxes to administer. Members **receive** at their club address
and reply from their personal one.

If the board needs to *send* from those addresses as well, forwarding is not enough:

| Option | Cost | Notes |
| --- | --- | --- |
| Zoho Mail free | free, max 5 users | real mailboxes, webmail and mobile app. Replaces the ImprovMX `MX` rows with Zoho's; keep the Brevo `TXT` rows and swap `include:spf.improvmx.com` for `include:zoho.com`. |
| ImprovMX paid | ~$9/month | adds SMTP so existing aliases can send. Keeps one provider. |
| Google Workspace | ~$6/user/month | only worth it if the club has a budget; 50 members is ~$300/month. |

Sending *to* every member is already handled by the platform and needs none of the above: see
the next section.

### Brevo account setup

1. Create a free account at [brevo.com](https://www.brevo.com) (300 emails/day on the free tier).
2. **Senders, Domains & IPs → Domains → Add a domain** → `team.codiha.com`, then add the
   records from the table above.
3. **Senders → Add a sender**: `CODIHA Club <hi@team.codiha.com>`.
4. **SMTP & API → API Keys → Generate a new API key (v3)** → paste into `BREVO_API_KEY`.

Until the domain verifies, use a sender address Brevo has already validated, or mail will be
rejected. Verification is usually minutes but DNS can take up to an hour to propagate.

### How the mail system works

- `/admin/mail` composes one message and sends it through Brevo's `messageVersions` API, in
  batches of 500, one HTTP request per batch, so it never times out in a Netlify function and
  **recipients never see each other's addresses**.
- Audiences: approved members, everyone, pending members, admins, registrants of a given event,
  applicants of a given hackathon (optionally filtered by accepted/pending/rejected),
  hand-picked members, or a custom email list.
- **Attachments are supported**, multiple files, 10 MB total (Brevo's limit).
- Plain text is auto-converted to HTML; tick *"my message is already HTML"* to send raw HTML.
- Every message is wrapped in the CODIHA branded template and logged to `email_log`
  (subject, audience, recipient count, attachment names, provider status, errors).
- Approval emails and hackathon accept/reject emails are sent automatically and are
  **non-fatal**, if Brevo is down the approval still goes through.

---

## 4b. Colour palette (`/admin/appearance`)

The whole site is driven by **two** colours stored in `site_settings.theme`:

| Picker | Drives |
| --- | --- |
| **Primary** | body gradient, nav, side menu, footer, admin chrome, scrollbar |
| **Accent** | buttons, links, active tabs, eyebrows, podium highlights, email buttons |

Everything else is derived in [`src/lib/theme.js`](src/lib/theme.js) by shifting the primary's
lightness: `+11%` for the top of the gradient, `-7%` for the bottom and the translucent nav
surfaces, `-14%` for the deepest background. Text on an accent button flips between the dark
brand shade and white depending on the accent's luminance, so a light accent stays readable.

The CSS variables are injected into `<head>` by `hooks.server.ts` **before first paint**, so
there is no flash of the old colours. Six presets are included; the preview panel next to the
pickers shows the result live before you save.

Only hex colours are ever written into the stylesheet (`normalizeHex()` rejects anything else),
so a malformed settings row cannot inject CSS.

> The palette is cached in memory for 60 seconds per server instance. After saving, a visitor on
> another Netlify lambda may see the old colours for up to a minute.

---

## 5. Netlify

1. Connect the repo. Build settings are in [`netlify.toml`](netlify.toml):
   - build command `npm run build`
   - publish directory `build`
   - Node 20
2. **Site configuration → Environment variables**, add every variable from `.env`:
   ```
   PUBLIC_SUPABASE_URL
   PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   PUBLIC_SITE_URL          = https://club.codiha.com
   CHECKIN_SECRET
   CHECKIN_WINDOW_SECONDS   = 30
   BREVO_API_KEY
   BREVO_SENDER_EMAIL       = hi@team.codiha.com
   BREVO_SENDER_NAME        = CODIHA Club
   BREVO_REPLY_TO           = hi@team.codiha.com
   ```
   `PUBLIC_*` are needed at **build** time, the rest at runtime.
3. Point `club.codiha.com` at the Netlify site (Domain management → Add custom domain).
   This creates the `club` CNAME to `codiha.netlify.app`. **Never let another service replace
   it** — Brevo offers to do exactly that if you point it at `club.codiha.com` (see section 4).
4. Redeploy after changing any `PUBLIC_*` variable.

---

## 6. Local development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # check-in token + timezone self-check
npm run build    # production build
```

Set `PUBLIC_SITE_URL=http://localhost:5173` and add
`http://localhost:5173/auth/callback` to the Supabase redirect allowlist.

---

## 7. How the platform works

### Membership

```
Google/Discord login → /onboarding (name, university, field, year)
                    → status = 'pending'  → /pending
                    → admin approves in /admin/members → /dashboard unlocked
```

- A Postgres trigger on `auth.users` creates the `profiles` row as `pending`.
- Another trigger (`profiles_protect`) silently reverts any attempt by a member to change their
  own `role`, `status`, `approved_at` or `email`, so even a crafted API call can't self-promote.
- `is_admin()` / `is_approved()` are `SECURITY DEFINER` helpers used inside the RLS policies,
  which is what keeps the policies from recursing on `profiles`.
- Roles: `member`, `admin`. **Every rule is enforced in RLS**, not just in the UI; the SvelteKit
  guards in `src/hooks.server.ts` are only there to send people to the right page.

#### Why `profiles` is not publicly readable

`profiles` holds emails, phone numbers and Discord handles, so its read policy is
*own row or admin*, nothing more. Anything public (leaderboard, hackathon winners) reads the
`public.members` view and the `public.leaderboard` view instead, which expose only name,
university, field, year, avatar, bio and socials for **approved** members.

Those two views plus `semester_points()`, `poll_results()` and `verify_certificate()` run with
owner rights on purpose, that is what lets anonymous visitors see aggregates without being able
to read the underlying private rows. Supabase's security advisor will flag them as
"SECURITY DEFINER view / function"; that is expected here, not a misconfiguration.

### Points

- `points_ledger` is append-only: `(member_id, amount, reason, source, source_id, created_by)`.
  There is no mutable total anywhere.
- Rank = sum of the ledger inside `semester_bounds()` (the current academic year), exposed by
  the `leaderboard` view.
- A partial unique index on `(member_id, source, source_id)` makes event check-in points
  **exactly once per event**, even if two scans race.
- Admin adjustments always require a reason (enforced by a `CHECK` constraint *and* the form).

### Event check-in

1. Admin opens `/admin/events/<id>/present` on the room projector.
2. The page shows a QR that encodes `https://club.codiha.com/checkin/<token>` where
   `token = <eventId>.<slot>.<HMAC-SHA256>`; `slot` advances every 30 s. Nothing is stored -
   the signature is the proof.
3. A member scans it, signs in if needed, and `/checkin/[token]` verifies the HMAC
   **server-side**, checks the event is live (1 h before → 1 h after), then writes attendance
   with the service-role client (members cannot insert attendance themselves).
4. Triggers award the points, issue the participation certificate and unlock badges.
5. The previous slot is still accepted, so scanning exactly as the code flips still works.

Logic lives in `src/lib/server/checkin-core.js` and is covered by `npm test`.

### Certificates

- Auto-issued by triggers: event check-in → participation; hackathon application accepted →
  participation; winner selected → winner certificate (with the place).
- Each has a UUID and a human code like `CODIHA-2026-AB12CD34`.
- `GET /certificates/<uuid>/download` renders an A4 landscape PDF (pdf-lib) with a QR pointing at
  `/verify/<uuid>`.
- `/verify/<uuid>` is public and reads through the `verify_certificate()` definer function, so
  anonymous visitors can confirm authenticity without being able to list the table.
- Reverting a check-in or removing a winner also removes the points and the certificate.

### Hackathons

CRUD with cover, theme, dates, application window, capacity, team size and per-place points.
Applications can be accepted/rejected one at a time, in bulk by selection, or *"accept all
pending"*. Winners are picked from accepted participants.

### Votes

- `poll_ballots` records **who** voted; `poll_votes` records **what** was voted for and has no
  voter column at all. The `cast_vote()` function writes both in one transaction, so double
  voting is impossible while the ballot stays genuinely anonymous, admins included.
- Results come from `poll_results()`, visible to members only after the close date (and only if
  *publish results* is on), and to admins at any time.

### Storage

| Bucket | Public | Used for |
| --- | --- | --- |
| `covers` | yes | event + hackathon cover images (admin write only) |
| `avatars` | yes | member avatars (owner write only) |
| `attachments` | no | reserved for admin mail attachments (admin only) |

Cover uploads are validated server-side: PNG/JPEG/WebP/AVIF/GIF, max 5 MB.

---

## 8. Routes

| Route | Access | What |
| --- | --- | --- |
| `/` | public | hero, live leaderboard, upcoming events, open hackathons, join CTA |
| `/events`, `/events/[slug]` | public | browse + register |
| `/hackathons`, `/hackathons/[slug]` | public | browse + apply, winners |
| `/leaderboard` | public | full standings for the academic year |
| `/articles/about`, `/articles/story`, `/articles/gallery` | public | existing content pages |
| `/login` | public | Google / Discord |
| `/onboarding` | signed in | name, university, field, year |
| `/pending` | signed in | waiting room / rejection notice |
| `/dashboard` | approved member | points, rank, badges, events, hackathons, certificates, history |
| `/vote` | approved member | anonymous club votes |
| `/checkin/[token]` | approved member | QR check-in landing |
| `/verify/[id]` | public | certificate authenticity |
| `/certificates/[id]/download` | public by UUID | PDF |
| `/register` | public | 308 → `/login` (old link kept alive) |
| `/admin` | admin | overview |
| `/admin/members` | admin | approve / reject / points / roles |
| `/admin/events`, `/admin/events/[id]` | admin | CRUD, registrations, manual check-in, mail registrants |
| `/admin/events/[id]/present` | admin | rotating check-in QR, fullscreen |
| `/admin/hackathons`, `/admin/hackathons/[id]` | admin | CRUD, applications, winners |
| `/admin/polls`, `/admin/polls/[id]` | admin | create votes, results, turnout |
| `/admin/mail` | admin | Brevo campaigns with attachments |
| `/admin/appearance` | admin | site colour palette (primary + accent) |

---

## 9. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Google: *"Invalid domain: must be a top private domain"* | You typed `supabase.co` as an authorised domain. Use the full `<project-ref>.supabase.co`. |
| `CHECKIN_SECRET is missing or too short` | set it (16+ chars) in `.env` **and** on Netlify |
| Login bounces back to `/login` with an error | the callback URL isn't in the Supabase redirect allowlist |
| QR check-in says "Invalid check-in code" | `CHECKIN_SECRET` differs between the machine that rendered the QR and the one verifying it |
| QR says "Check-in is closed" | you're outside the 1 h window around the event, or the event is cancelled |
| Leaderboard shows everyone at 0 | no `semesters` row covers today, or no points awarded yet |
| Emails not arriving | `BREVO_API_KEY` missing, or the sender domain isn't authenticated, check `/admin/mail` → *Recent sends* for the provider error |
| Admin pages 403 | your profile isn't `role='admin'` **and** `status='approved'` |
