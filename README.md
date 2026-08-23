# GEN-Z HUB
**Connect. Build. Play. Grow.**

A complete, original social networking platform for Gen-Z builders, freelancers, students and gamers — with two specialised ecosystems inside one product: **Business Hub** and **Gaming Hub**.

No marketplace. No buying/selling. No AI assistant/chatbot/generator. Every button in the UI is wired to a real backend endpoint.

---

## Run it

```bash
npm install
npm start                      # development  → http://localhost:3000
npm run prod                   # production mode (HSTS, secure cookies, static caching)
npm run docker:up              # Docker Compose (persistent volume + healthcheck)
```

Environment (see `.env.example`): `PORT`, `NODE_ENV`, `DATA_DIR`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CANONICAL_HOST`.

## Deploy it as a live website

Full instructions: [`deploy/DEPLOY.md`](deploy/DEPLOY.md). Everything is included:

| Target | Files |
|---|---|
| Docker / any VPS | `Dockerfile`, `.dockerignore`, `docker-compose.yml` |
| Ubuntu + nginx + Let's Encrypt | `deploy/nginx.conf`, `deploy/genzhub.service` |
| PM2 | `ecosystem.config.js` |
| Render.com (one-click blueprint) | `render.yaml` |
| Fly.io | `fly.toml` |

Production extras already wired in: `/api/health` health check, gzip compression, HTTP→HTTPS and canonical-host
redirects, HSTS, `Secure` session cookies, long-lived static caching with no-cache HTML, graceful SIGTERM shutdown,
and a single `DATA_DIR` volume holding the database and uploads (back up one folder, back up everything).

## Public website

Logged-out visitors get a real marketing site, not a login wall:

* `#/welcome` — landing page: hero, live platform stats, 8 feature cards, Business Hub and Gaming Hub sections, 3-step onboarding explainer, CTA
* `#/about` · `#/guidelines` · `#/privacy` · `#/terms` · `#/contact` — company, safety and legal pages with a site header and footer
* SEO: description/keywords, Open Graph + Twitter cards, canonical link, `robots.txt`, `sitemap.xml`
* PWA: `manifest.webmanifest` + SVG maskable icon → installable to a phone home screen

Protected app routes redirect guests to sign-in; public pages stay open.

### Demo accounts (created on a fresh database)
| Role | Login | Password |
|---|---|---|
| Member | `rafi@demo.genzhub.app` | `GenzDemo123` |
| Member (gamer) | `tanvir@demo.genzhub.app` | `GenzDemo123` |
| Admin | `admin@genzhub.app` | `AdminGenz2026` |

Other demo members: `nabila`, `sadia`, `imran`, `jisan` (same password). Or create your own account — signup → onboarding → feed.

---

## Stack & architecture

| Layer | Choice |
|---|---|
| Backend | Node.js + Express 5, modular routers |
| Database | SQLite (better-sqlite3), WAL, foreign keys ON, 27 tables, indexes, cascades |
| Auth | bcrypt (cost 12) + server-side sessions in httpOnly cookies |
| Frontend | Dependency-free SPA (hash router, ES2020), mobile-first CSS design system |
| Uploads | multer, MIME allowlist, 25 MB limit, randomised filenames |

```
src/
  db.js            schema + migrations (idempotent)
  util.js          auth middleware, rate limiting, CSRF guard, notifications, helpers
  feed.js          central post-visibility SQL (privacy, blocks, group/community access)
  seed.js          interests, starter communities, admin, demo content
  server.js        app wiring, security headers, uploads, static, error handler
  routes/          auth · me · posts · users · messages · misc · groups · admin
public/
  index.html · css/app.css
  js/ core · shell · components · views-auth · views-main · views-social · views-spaces · views-hubs
qa.sh              90-assertion API/security test suite
ui-test.js         headless (jsdom) walk of all 48 routes + interactions
```

---

## Feature coverage

**Auth** signup (name, username, email, password, DOB with 13+ gate, live username availability), login, logout, remember-me, forgot/reset password, change password (revokes other sessions), protected routes, suspended-account handling.

**Onboarding** 4 steps: welcome → interests → choose Business Hub / Gaming Hub / both / general only → suggested people & communities. Skippable; interests editable later in Settings.

**Feed & posts** text, multi-image, video, links, hashtags, @mentions, destination (General / Business Hub / Gaming Hub / a group / a community), privacy (public / connections / private), upload progress + preview + remove, character counter, infinite scroll with cursor pagination, For you / Following scopes.

**Interactions** 4 reactions (long-press or right-click to pick), comments, threaded replies, edit/delete own content, repost with quote, save, report, copy link.

**Stories** image/video + caption, 24h expiry (expired ones deleted on read), viewer with progress bars, keyboard/tap navigation, viewer list for the owner, delete.

**Profiles** cover + avatar upload, bio, location, interests, hub badges, tabs (Posts / About / Media / Groups / Communities / Followers / Following), follow, connect (request → accept/decline/cancel/remove), message, block, report, privacy-restricted view.

**Messaging** conversation list with search + unread counts, 1:1 chat, attachments, emoji bar, read receipts, near-real-time polling, hide conversation, strict membership authorisation.

**Notifications** likes, comments, replies, mentions, follows, connection requests, messages, group activity — unread badges everywhere, mark one / mark all, deep links, per-type preferences.

**Search & Explore** people, posts, groups, communities, hashtags with tab filters, plus a Discover page (trending tags, suggested people, popular communities, business & gaming content). Real SQL queries with loading / empty / error states.

**Groups** create (name, description, category, cover, privacy, rules), public join or private request-approval, roles (owner/admin/moderator/member), member management, invites, group feed, About / Members / Rules tabs, admin Manage tab, delete.

**Communities** topic spaces (Entrepreneurs Bangladesh, Young Founders, Freelancers Guild, Web Developers, Mobile Gamers, Esports Players, Football Fans…), join/leave, community feed, members, rules, search, create.

**Business Hub** business feed with topic filters (Startups, Freelancing, Marketing, E-commerce, Technology, Business Ideas, Networking), Discover People, Communities, Events, **Collaboration board** (co-founder / developer / designer / team requests — networking only), My Network, business role on profile.

**Gaming Hub** gaming feed with topic filters, Discover Gamers, Games (favourite games, platform, gamer tag), **Teams** (teammate finding, scrims, tournaments), Communities, Events.

**Events** create (title, description, date/time, online/physical, location, cover, hub), Going / Interested / Can't go, share to feed, save, host/admin delete, upcoming lists in rails and hubs.

**Saved** saved posts and events with removal.

**Safety** report posts, comments, users, groups and communities (5 categories + details); block/unblock with mutual content hiding, message blocking and auto-removal of follows/connections.

**Settings** account (email, username, password, delete account), profile (details, interests, hubs), privacy (profile visibility, default post privacy, blocked list), notification preferences, appearance (light/dark/system), language (English / বাংলা).

**Admin panel** role-gated dashboard (users, active 24h, new 7d, suspended, posts, comments, groups, communities, events, messages, open reports), user search + suspend/reinstate + role change, post hide/delete, comment delete, group/community/event management, report queue with remove-content / resolve / dismiss.

---

## Security

- bcrypt password hashing; plaintext passwords are never stored, logged or returned — admin endpoints are asserted password-free by the test suite.
- Session tokens: 32-byte random, httpOnly + SameSite=Lax cookie, server-side expiry, revoked on password change/reset and on suspension.
- Authorization checked server-side on every mutation (ownership for edit/delete, membership for group/community posting and conversations, role checks for group admins and platform admins).
- Post visibility enforced in SQL (`feed.js`), not in the UI: privacy tiers, block relationships, private-group membership.
- Injection safe: every query is a prepared statement with bound parameters; LIKE terms are escaped.
- XSS: all user content is HTML-escaped before rendering; strict CSP (`script-src 'self'`), `nosniff`, `X-Frame-Options`, Referrer-Policy, Permissions-Policy.
- CSRF: mutating requests require the `X-GenZ-Client` header (rejected cross-site by CORS preflight rules) plus SameSite cookies.
- Uploads: MIME allowlist, 25 MB cap, max 6 files, random filenames, served with `nosniff`; only `/uploads/...` paths are accepted as media references.
- Rate limits on signup, login, password reset, posting, commenting, messaging, uploads, reports and global API traffic.
- Secrets (admin bootstrap credentials, paths, port) come from environment variables — nothing sensitive is hardcoded in frontend code.

---

## Quality assurance

```bash
npm run qa            # 90 API + security assertions            → 90 passed, 0 failed
npm run uitest        # jsdom walk of 54 routes + actions       → 0 problems
node guest-test.js    # logged-out website + route guards       → 0 problems
node browser-test.js  # REAL Chromium E2E + responsive suite    → 106/106 checks, 0 console errors
```

### Real-browser end-to-end suite (`browser-test.js`)

Drives an actual Chromium browser exactly like a user would, and stores screenshots in `screenshots/`:

signup through the form (with live username availability) → 4-step onboarding → publish text post → publish image
post with real file upload → react/unreact → comment → threaded reply → save → edit → delete → edit profile with
avatar + cover upload and verify persistence after reload → follow + connection request → open chat from a profile
and send a message → Business Hub join state, hub post, collaboration post, topic filter, people, communities →
Gaming Hub post, team recruitment post, favourite-games persistence → create group, post in it, members and manage
tabs → join community → create event and RSVP → explore search → dark mode → বাংলা switch → admin blocked for a
normal user → logout, protected-route bounce, log back in → admin panel with all 10 tabs.

Responsive checks assert `scrollWidth <= clientWidth` (no horizontal scrolling) on every page at **1920, 1366, 768,
390 and 375 px**, plus mobile-specific assertions: bottom tab bar visible, desktop sidebar hidden, composer modal
fits inside the viewport, chat goes full-screen, and the mobile menu sheet exposes every navigation item.

Two real bugs were found and fixed by this suite: the strict CSP was blocking the inline boot script in Chromium
(moved to `js/boot.js`), and `[hidden]` badge counters were still rendering because `.dot { display: grid }`
overrode the UA style.

`qa.sh` covers: signup validation (duplicates, age gate, weak password), login failures, CSRF, unauthorised access, post CRUD + ownership, hub gating, private-post visibility, reactions, comments/replies, reposts, saves, hashtags, mentions, follow/connect lifecycle, search (including no-results), messaging authorisation, group privacy/approval/roles, community membership gating, events + RSVP, stories validation, blocking effects, reporting, admin role protection, moderation actions, suspension behaviour, password change/reset (single-use token), settings, and static/SPA routing.

## Responsive design

Mobile-first CSS with breakpoints at 1080 / 860 / 420 px: three-column desktop shell → single column with bottom tab bar (Home, Explore, Create, Notifications, Menu), full-screen mobile chat, bottom-sheet modals, touch-sized controls, `overflow-x: hidden` guards, safe-area padding, and `prefers-reduced-motion` support. Light and dark themes plus system preference.

## Accessibility

Semantic landmarks, labelled inputs and icon buttons, `aria-modal` dialogs with Escape/backdrop close and focus handling, visible focus rings, `aria-live` toasts, alt text on all images, keyboard navigation for story viewer and chat.

## Video pipeline

Gen-Z Hub transcodes uploads with ffmpeg into an honest resolution ladder (never upscaled, never
over-compressed), generates sharp posters, serves range requests with immutable caching, and plays
them with a lazy, one-at-a-time, adaptive-quality feed player.

Full architecture, env vars and scaling path: [`deploy/VIDEO-PIPELINE.md`](deploy/VIDEO-PIPELINE.md)

```bash
node tests/video-quality-test.js /path/to/clip.mp4   # source vs. delivered quality
node tests/video-feed-test.js                        # scroll behaviour (desktop + mobile)
node tests/video-stress-test.js                      # 50-video feed + slow network
node tests/video-upload-ui-test.js /path/to/clip.mp4 # composer upload states
```
