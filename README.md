# DoNext

**The to-do list you can talk to.** DoNext is a mobile-friendly, offline-first, open-source task app by Dewan Mahmud. It has voice input, shared lists and offline sync, and is packaged for iOS and Android.

**▶ [Try the live demo](https://dewantechus.github.io/donext/)**: no sign-up, nothing to install. Tap **"Try it instantly"**.

Built by **[Dewan Mahmud](https://dewanmahmud.com)**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Dewan%20Mahmud-0a66c2?logo=linkedin)](https://www.linkedin.com/in/dewan-mahmud-a579a0265/)
[![Website](https://img.shields.io/badge/Website-dewanmahmud.com-012360)](https://dewanmahmud.com)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Tests](https://img.shields.io/badge/tests-155%20passing-22c55e)
![PWA](https://img.shields.io/badge/PWA-offline%20ready-5a0fc8)

<p>
  <img src="docs/screenshots/phone-tasks.png" alt="Task list with due dates, time left, priorities and a sub-item checklist" width="24%">
  <img src="docs/screenshots/phone-suggest.png" alt="Smart suggestions filling in category, due date and sub-items from “milk eggs and bread tomorrow 6pm”" width="24%">
  <img src="docs/screenshots/phone-picker.png" alt="Due date picker with quick picks, a month calendar and times" width="24%">
  <img src="docs/screenshots/phone-dark-reminder.png" alt="Dark mode with a reminder card offering Mark done and Snooze" width="24%">
</p>

<img src="docs/screenshots/desktop.png" alt="DoNext on a desktop browser" width="100%">

## Highlights

- **Offline-first sync engine:** every change is saved to IndexedDB and queued in an outbox, then synced with last-write-wins conflict resolution and deletion tombstones. The app works fully without a connection.
- **Understands plain language, on the device:** type or say *"milk eggs and bread tomorrow 6pm"* and it suggests *Buy groceries*, the Groceries category, a due date and time, and Milk, Eggs and Bread as sub-items. It's rule-based, with no AI service or API costs.
- **Voice input and spoken reminders:** speech-to-text with permission handling, and reminders that play a synthesised sound (Web Audio) and can be read aloud (Speech Synthesis).
- **Collaboration:** shared lists with email invitations and assignees. Access rules are enforced on the server and covered by tests.
- **Security:** bcrypt, revocable JWTs, strict Zod schemas that block NoSQL injection, Helmet CSP and rate limiting.
- **Polish:** accessible (labelled controls, focus-trapped dialogs, `aria-live`), dark mode, installable PWA, and Capacitor iOS and Android projects.
- **Quality:** 137 automated tests (Vitest, Supertest, Testing Library). GitHub Actions tests and deploys the live demo on every push.

## Tech stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, Vite, installable PWA
- **Backend:** Node.js, Express 5, TypeScript, Zod validation
- **Database:** MongoDB with Mongoose
- **Mobile:** Capacitor 8 native projects for iOS and Android (targets Android API 36, iOS 15+)

| Guide | What it covers |
| --- | --- |
| This README | Features, MongoDB setup, local development, tests, configuration, architecture |
| [docs/HOSTINGER.md](docs/HOSTINGER.md) | **Step-by-step deployment on Hostinger** (Node.js Web App, settings and environment variables) |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deploying to your own domain (subdomain or sub-path), free email setup, Docker, production checklist |
| [docs/GOOGLE-PLAY.md](docs/GOOGLE-PLAY.md) | **Publishing the Android app on Google Play**: build, signing, store listing text, Data safety answers, closed test |
| [docs/MOBILE.md](docs/MOBILE.md) | iOS/Android builds, microphone permissions, signing, App Store and Google Play submission requirements |

## Two ways to run DoNext

| | **Demo mode** (no server) | **Full mode** (with your server) |
| --- | --- | --- |
| Cost | Free: static files only | Free tiers work (MongoDB Atlas plus any Node.js host) |
| Where data lives | In the visitor's browser (localStorage) | In your MongoDB database |
| Accounts, voice, offline, shared lists | ✅ (shared lists between accounts in the same browser) | ✅ across all devices |
| Email for invitations and password reset | Shown on screen instead | ✅ via SMTP |
| Command | `npm run build:demo` | `npm run build`, then `npm start` |

The **live demo** is built automatically from `main` by [.github/workflows/demo.yml](.github/workflows/demo.yml) and published to GitHub Pages. To publish your own copy, fork the repo and go to **Settings → Pages → Source: GitHub Actions**.

To **run your own server** for real accounts and sync across devices, follow [MongoDB setup](#mongodb-setup) and [Local development](#local-development) below, then [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Features

- **Accounts:** sign up, log in, log out, log out of all devices, forgot/reset password by email, edit your name, change your password, download all your data as JSON, and delete your account (asks for your password again).
- **Public pages:** a landing page for visitors, Help & Support (FAQ and contact), Privacy Policy and Terms.
- **Reliability:** if something crashes, a friendly recovery screen appears instead of a blank page.
- **Tasks:** create, edit, complete, and delete tasks. Each task has a title, description, due date and optional time, priority (low/medium/high), category, and a checklist of **sub-items** you can tick off right on the card.
- **Smart suggestions:** as you type or speak a new task, DoNext suggests the details, and **Apply** fills them in:
  - "milk eggs and bread" → *Buy groceries*, category Groceries, with sub-items Milk, Eggs and Bread.
  - "pay electricity bill tomorrow 5pm urgent" → *Pay electricity bill*, category Bills, priority High, due tomorrow at 5:00 PM.
  - It also offers ready-made checklists for trips, cleaning, parties and more, and reuses your own category names. It runs on your device with built-in rules: no AI service, no API key, no cost, and nothing you type leaves the device. It works offline too. The rules are in [`client/src/lib/smartSuggest.ts`](client/src/lib/smartSuggest.ts) and are easy to extend.
- **Hands-free voice commands:**
  - *"Hey DoNext, I have a job tomorrow at 9, priority high, remind me 1 hour before. Add it."* creates the task with its date, time, priority and reminder, and saves it without a tap.
  - It also understands *"due date / end date / deadline Friday"*, *"remind me at 8am"*, *"no reminder"*, *"category work"*, *"with sub-items A, B and C"* and *"with a note …"*.
  - Ask *"What do I have today?"*, *"What's due tomorrow?"* or *"Anything overdue?"*, and DoNext answers on screen and out loud.
  - *"Mark the job as done"* or *"I finished the report"* completes a task.
  - Each task can have its own reminder: at the due time, or 10 or 30 minutes, 1 hour or 1 day before, or none.
- **Android app (Google Play):** a private, no-account build (`npm run build:android`) that stores tasks on the phone. Reminders ring as real notifications with a chime, even when the app is closed, and read-aloud uses the phone's text-to-speech. See [docs/GOOGLE-PLAY.md](docs/GOOGLE-PLAY.md).
- **Finding tasks:** search across title, description, category, and sub-items. Filter by status, priority, or category, and sort by due date, priority, or newest. Overdue tasks are highlighted.
- **Shared lists (collaboration):**
  - Create a list such as "Family" or "Team" and invite people by email. They get an email, and see the invitation when they log in or after they sign up with that address.
  - Everyone in a list sees and edits its tasks on all their devices, and tasks can be assigned to a list member.
  - The owner can rename the list, invite or remove people, or delete it; members can leave.
  - Tabs: Personal, each shared list, and All. A red badge shows pending invitations.
- **Privacy:** personal tasks are visible only to their creator; shared-list tasks only to that list's members. Nobody else can read or change them (covered by tests). Each account also gets its own offline database on the device, and that database is erased when you log out.
- **Sound and read-aloud reminders:** while DoNext is open (a background tab is fine), a task's reminder plays a sound (Chime, Bell or Beep, generated in the browser with no audio files) and can read the task aloud with the device's voice ("Reminder. Pay rent is due now."). A card offers **Mark done** and **Snooze 10 min**, and a system notification can appear when the tab is in the background. Choose the timing (at the due time, or 10, 30 or 60 minutes before), the sound and read-aloud in **Account → Reminders**, which also has a **Test reminder** button. These settings are saved per device.
- **Calendar reminders:** the 📅 button on a task adds it to **Google Calendar** (opens pre-filled) or to **Apple Calendar or Outlook** (a standard .ics file with the reminder built in). You pick the date, time and when to be reminded, and the calendar app sends the notification. The dialog **detects the device** and offers its calendar first: Apple Calendar on iPhone, iPad and Mac, Google Calendar on Android, and Outlook or Windows Calendar on Windows. The other options stay available. It works on iPhone, Android and desktop with no server or push setup.
- **Voice input:**
  - A microphone button turns speech into text.
  - Before the first permission prompt, a short note explains why the app needs the microphone.
  - You can edit what was heard in a preview before it's used.
  - Denied permission, no microphone, and no speech heard each get their own message.
  - Where voice isn't supported, the app falls back to typing.
- **Offline and sync:** the app keeps working with no connection. Changes are saved on the device and synced automatically when you're back online.
  - Conflicts are resolved by last write wins.
  - Deletions reach your other devices.
  - Edits made while a sync is in progress are never lost.
- **PWA:** installable, with an app shell that loads offline and updates itself.
- **User experience:**
  - Dark, light, or system theme.
  - Touch targets of at least 44 px.
  - Accessibility: skip link, labelled controls, focus-trapped dialogs, `aria-live` status updates, and reduced-motion support.
  - Loading indicators and plain-language error messages.
- **Security:**
  - Passwords hashed with bcrypt (12 rounds).
  - JWTs (HS256) that can be revoked by bumping a per-user token version.
  - Helmet with a strict CSP, an allow-list for CORS, and rate-limited auth endpoints.
  - Strict Zod schemas that reject unknown fields and NoSQL operator injection.
  - Secrets only in environment variables, and the server won't start if `JWT_SECRET` is weak or still the placeholder.
- **Legal pages:** Privacy Policy and Terms templates, with every detail you need to supply shown as a highlighted placeholder.

## Project structure

```
dt_to_do/
├─ package.json            npm workspaces + root scripts
├─ .env.example            sample server environment
├─ .github/workflows/      CI: test, build and deploy the live demo to GitHub Pages
├─ docs/                   deployment, mobile, rebranding guides; README screenshots
├─ Dockerfile              single-container production image
├─ branding/              source logo: donext-logo.png (app icon)
├─ scripts/generate-icons.mjs   builds all icons, splash screens and in-app logos from branding/
├─ server/
│  ├─ src/
│  │  ├─ index.ts          entry: env → MongoDB → HTTP server
│  │  ├─ app.ts            Express app (security middleware, routes, optional static client)
│  │  ├─ config.ts         validated environment variables
│  │  ├─ models/           User, Task, List (Mongoose)
│  │  ├─ routes/           auth.ts, tasks.ts (CRUD + /sync), lists.ts (shared lists, invites)
│  │  ├─ middleware/       auth (JWT), error handler, zod parsing
│  │  └─ lib/              validation (all request schemas), access rules, mailer
│  ├─ scripts/dev-memory.ts  run the API with a disposable local MongoDB
│  └─ test/                auth, tasks/privacy/CORS, sync conflicts, shared lists and invites
└─ client/
   ├─ capacitor.config.ts  native app id/name
   ├─ android/, ios/       native projects (open in Android Studio / Xcode)
   ├─ native/ios/          iOS privacy manifest template
   ├─ vite.config.ts       PWA manifest + service worker
   ├─ scripts/configure-native.mjs  adds mic/speech permissions to native projects
   ├─ assets/              icon/splash sources for @capacitor/assets
   ├─ public/              icons, link-preview image, theme bootstrap script
   └─ src/
      ├─ lib/              api, demo API, IndexedDB store, sync engine, filters, smart suggestions
      │                    and date parsing, reminders, sound, speech, calendar export
      ├─ context/          Auth, Tasks, Theme providers
      ├─ hooks/            dialogs (focus trap, stacking), online status, clock
      ├─ components/       TaskItem, TaskForm, VoiceInput, SmartSuggestions, DueDatePicker,
      │                    SubtaskEditor, ReminderCenter, CalendarDialog, Modal, Header…
      └─ pages/            Landing, Tasks, Shared lists, Login/Signup, Account, Support, Privacy, Terms
```

## Prerequisites

- **Node.js 22 or later**, with npm 10 or later.
- **MongoDB:** one of the three options below.
- **Mobile builds only:**
  - Android: Android Studio.
  - iOS: a Mac with Xcode.
  - Details are in [docs/MOBILE.md](docs/MOBILE.md).

## MongoDB setup

Pick one option.

### Option A: MongoDB Atlas (recommended for production)

1. Create a free account at <https://www.mongodb.com/cloud/atlas>. *(You need your own account for this.)*
2. Create a cluster. The free M0 tier is fine to start with; choose a region close to your users and your API host.
3. Under **Database Access**, add a database user with a strong password and the *Read and write to any database* role. Scoping it to the `donext` database is better.
4. Under **Network Access**, add your API server's outbound IP address. During development you can add your own IP. Avoid `0.0.0.0/0` in production unless your host has no static IP.
5. Click **Connect → Drivers** and copy the connection string. Put it in `server/.env`, adding the database name:
   ```
   MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/donext?retryWrites=true&w=majority
   ```
   If the password contains special characters such as `@ : / ? #`, URL-encode them.

### Option B: Local MongoDB Community Server

- **Windows:** install the MSI from <https://www.mongodb.com/try/download/community> and leave "Install as a Service" ticked. If `mongod` exits immediately, install the [Microsoft Visual C++ Redistributable (x64)](https://learn.microsoft.com/cpp/windows/latest-supported-vc-redist).
- **macOS:** run `brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community`.
- **Linux:** follow the official package instructions for your distribution.
- **Docker:** run `docker run -d -p 27017:27017 --name mongo -v mongo-data:/data/db mongo:7`.

Then set `MONGODB_URI=mongodb://127.0.0.1:27017/donext`.

### Option C: Try it with no install

```bash
npm run dev:memory
```

This downloads a MongoDB binary on first run, then starts it on port 27018 with data kept in `server/.data/`, and runs the API and the web app.

- It's for development only.
- Delete `server/.data/` to reset.
- On Windows it needs the same Visual C++ Redistributable as Option B.

## Local development

```bash
# 1. Install everything (both workspaces)
npm install

# 2. Configure the server
cp .env.example server/.env        # Windows PowerShell: Copy-Item .env.example server/.env
#    then edit server/.env: set MONGODB_URI and a real JWT_SECRET:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Start the API (port 4000) and the web app (port 5173) together
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` to the API, so you don't need to change CORS for local web development.

Other useful commands:

| Command | Purpose |
| --- | --- |
| `npm test` | Run all server and client tests |
| `npm run typecheck` | Type-check both workspaces |
| `npm run build` | Production build (`client/dist` and `server/dist`) |
| `npm start` | Run the built server (`server/dist/index.js`) |
| `npm run icons` | Rebuild every icon, splash screen and in-app logo from the files in `branding/` |

**Testing on your phone over Wi-Fi:** run `npm run dev -w client -- --host` and open `http://<your-PC-IP>:5173` on the phone. Browsers only allow the microphone on HTTPS or `localhost`, so voice input won't work over plain LAN HTTP. Use a tunnel such as `ngrok http 5173`, or a deployed HTTPS build, to test voice on a phone.

## Tests

```bash
npm test
```

There are 155 tests.

**Server: 43 tests.** Supertest against a real in-memory MongoDB.
- Shared lists: email invitations (including people who sign up later), accept or decline, and invitation checks. Members see and edit list tasks, outsiders don't, and personal tasks stay private. Only the creator or list owner can delete a task. Assignees must be list members.
- Sync with lists: a member who joins late gets the existing tasks. Removed members stop syncing. Tasks moved out of a list disappear for its other members. Deleting a list, leaving a list, and account deletion with shared lists are covered too.
- Signup and login, including identical errors for a wrong email or wrong password so accounts can't be discovered.
- Password hashing, tampered tokens, log out everywhere, and account deletion (requires the password, removes all tasks).
- Task CRUD and validation, including the 200-character limit, impossible dates, unknown fields, and `$`-operator injection.
- Privacy between users, search with regex characters escaped, and filters.
- Sync: idempotent retries, last-write-wins conflicts, clamping of future clock times, deletions reaching other devices and staying deleted, partial rejection, cross-user overwrite attempts, and batch limits.
- CORS allow-list and security headers.
- Password reset: emailed single-use links, only a hash stored, expiry, the same answer for unknown emails, and other devices signed out afterwards.
- Changing name and password, and exporting only your own data.

**Client: 62 tests.** Vitest, Testing Library, and fake IndexedDB.
- Calendar reminders: the Google Calendar link, and a standards-compliant .ics file (escaping, line folding, reminder), plus the dialog.
- Shared lists are kept for offline use, and tasks from lists you've left are removed.
- The task form's List and Assign to fields.
- Offline queueing and later push.
- Combining several edits to the same task into one change.
- An edit made during an in-flight sync isn't lost.
- Pulling changes from other devices.
- 401 and network-failure handling.
- Data persists across restarts and stays separate for each user.
- Filtering and sorting.
- The voice flow: explainer, editable preview, denied permission, nothing heard, and the unsupported-browser fallback.
- Form validation and accessibility.
- The mobile menu, forgot/reset password pages, landing page and support page.

The first server test run downloads a MongoDB binary of about 70 MB. On Windows, that binary needs the Visual C++ Redistributable.

## Environment variables

**Server** (`server/.env`; template: [.env.example](.env.example))

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | 32+ random characters; the server won't start with the placeholder in production |
| `JWT_EXPIRES_IN` | no | Session length (default `7d`) |
| `PORT` | no | Default `4000` |
| `CORS_ORIGINS` | no | Comma-separated origins allowed to call the API. Add `capacitor://localhost,https://localhost` for the native apps |
| `SERVE_CLIENT` | no | `true` makes Express serve `client/dist` as well (single-server deploy) |
| `TRUST_PROXY` | no | Number of reverse proxies in front of Express (needed for correct rate limiting behind Nginx or a PaaS) |
| `APP_URL` | production | Public URL of the web app, including any sub-path. Used in password reset links |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | production | Outgoing email for password resets. If `SMTP_HOST` is empty, emails are printed in the server log instead (development only) |
| `MAIL_FROM` | no | Sender shown on emails (default `DoNext <you@gmail.com>`) |
| `NODE_ENV` | no | `production` in production |

**Client** (`client/.env`, `client/.env.mobile`; templates: [client/.env.example](client/.env.example), [client/.env.mobile.example](client/.env.mobile.example)). These values are embedded in public JavaScript, so never put secrets here.

| Variable | Description |
| --- | --- |
| `VITE_API_URL` | API origin. Leave empty when the API is on the same origin. **Required for native builds.** |
| `VITE_BASE_PATH` | Sub-path the web app is served from, e.g. `/todo/` (default `/`) |

## How it works

### Authentication

- Login returns a JWT, which the client stores and sends as `Authorization: Bearer …`. Bearer tokens work the same way in browsers and in Capacitor's native WebViews, where third-party cookies are unreliable.
- Each token carries the user's `tokenVersion`. *Log out of all devices* increments that version, which immediately invalidates every token already issued.
- Storing the token in `localStorage` means an XSS bug could read it. The strict CSP (no inline or third-party scripts) and React's escaping reduce that risk. If you need to, you can move to httpOnly cookies for web-only deployments.

### Offline sync

The full design is commented in [client/src/lib/taskStore.ts](client/src/lib/taskStore.ts) and [server/src/routes/tasks.ts](server/src/routes/tasks.ts).

1. Task ids are UUIDs generated on the device, so tasks can be created offline.
2. Every edit is written to IndexedDB along with an **outbox** entry, in the same transaction. The outbox keeps one entry per task, so the latest edit wins locally.
3. `POST /api/tasks/sync` pushes the outbox and pulls everything that changed since the last cursor.
   - The server keeps the edit with the newest `updatedAt` and ignores older ones.
   - Times from client clocks are capped at the server's current time.
   - Deletions are tombstones, so they reach other devices, and they're sticky: an edit can't bring a deleted task back.
   - The pull cursor is the server's own write time (`serverUpdatedAt`) minus a 5-second safety window, so a write that lands during a sync isn't missed.
4. Sync runs a moment after each edit, when the connection comes back, when the app regains focus, and every 60 seconds.
5. The service worker precaches the app shell, so the app opens offline. API responses are **never** cached by the service worker; the per-user IndexedDB copy is the only offline copy.

### Voice input

| Platform | Engine | Notes |
| --- | --- | --- |
| Chrome and Edge (desktop and Android) | Web Speech API | Chrome sends audio to Google for recognition (disclosed in the UI and the privacy policy). Needs HTTPS. |
| Safari on macOS and iOS | Web Speech API | Uses Apple's speech service. Support inside home-screen (standalone) web apps varies by iOS version; when it's unavailable, the typing fallback is shown. |
| Firefox | Not supported | Typing fallback is shown. |
| iOS and Android apps | `@capacitor-community/speech-recognition` | Uses the operating system's speech recognizer, with native permission prompts. See [docs/MOBILE.md](docs/MOBILE.md#microphone-and-speech-permissions). |

**Permission flow:**

1. Before the first permission prompt, an explainer appears offering **Continue** or **Type instead**.
2. While listening, you see a live transcript.
3. Once you stop, you get an editable preview with **Use this text**, **Try again**, or **Discard**.
4. The text you confirm goes into the title field, which you can still edit before saving.
5. If something goes wrong, the message explains how to re-enable access, for example through the browser's lock icon or the device's Settings app.

## Before going public: placeholders checklist

Everything you need to fill in lives in one file: [client/src/lib/brand.ts](client/src/lib/brand.ts).

- [ ] **`LEGAL`** in brand.ts: support and privacy email, business address, dates, hosting/email providers, data region, retention periods, minimum age, governing law and pricing. Empty values show as highlighted placeholders on the Privacy, Terms and Support pages.
- [ ] Read the Privacy Policy and Terms yourself to check they're accurate, then set `finalized: true` in brand.ts. The "Draft" banner disappears automatically. A lawyer review is a good idea once you can afford one, but the stores don't require it.
- [x] `AUTHOR_NAME` and `AUTHOR_SITE_URL` in brand.ts (Dewan Mahmud, dewanmahmud.com).
- [ ] Server: set `APP_URL` and SMTP settings so password reset emails are delivered.
- [x] [client/capacitor.config.ts](client/capacitor.config.ts): `appId` is `com.dewanmahmud.donext` (permanent after the first store release).
- [x] Icons and splash screens are generated from the logo in `branding/`. To change them, replace those files (square, 1024 px or larger) and run `npm run icons`.
- [ ] `server/.env`: a real `JWT_SECRET`, production `MONGODB_URI`, and `CORS_ORIGINS`.

## About the author

DoNext was designed and built by **Dewan Mahmud**, a full-stack software engineer.

- 💼 LinkedIn: [linkedin.com/in/dewan-mahmud-a579a0265](https://www.linkedin.com/in/dewan-mahmud-a579a0265/)
- 🌐 Portfolio: [dewanmahmud.com](https://dewanmahmud.com)
- ✉️ Email: [dewan.swe@gmail.com](mailto:dewan.swe@gmail.com)

Feedback, ideas and opportunities are welcome.

## License

**MIT** © 2026 Dewan Mahmud. See [LICENSE](LICENSE).

You're free to use, copy, modify and share this code, including in your own projects, as long as you keep the copyright notice. Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).

### Name and brand: not included in the MIT License

The **DoNext** name and logo are trademarks of Dewan Mahmud and are **not** licensed for reuse.

- ✅ You may build and publish your own app from this code, **under your own name and logo**.
- ❌ You may not use the DoNext name, logo or branding for your version, or suggest it's the official DoNext.

See the [Trademark Policy](TRADEMARKS.md), and the [Rebranding guide](docs/REBRANDING.md) for switching to your own brand in a few minutes.
