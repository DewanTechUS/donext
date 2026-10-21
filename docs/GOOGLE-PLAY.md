# Publishing DoNext on Google Play

This guide takes the DoNext Android app from this repository to the Google Play Store, step by step.

The Play version is the **local app**: tasks are stored on the phone, with no server, no accounts and nothing sent anywhere. It's built with `npm run build:android` (`VITE_LOCAL=true`, see `client/.env.android`).

**What's ready in the repo:**

| Item | Where |
| --- | --- |
| Android project (package `com.dewanmahmud.donext`, target API 36, min API 24) | `client/android/` |
| Voice input, hands-free commands, phone notifications with a chime, read-aloud | the app |
| Store screenshots, feature graphic, 512 px icon | `docs/play-store/` |
| Privacy Policy (covers the app) | <https://dewantechus.github.io/donext/privacy> |
| Store listing text, Data safety and content-rating answers | below |

---

## Part 1: Build the app file (`.aab`)

### 1. One-time setup: Android SDK

1. Open **Android Studio** (already installed).
2. On first launch, choose **Standard** setup and accept the licences. It downloads the Android SDK (about 2–3 GB).
3. Close Android Studio when it finishes.

### 2. The signing key (already created)

An upload key was created for you in **`C:\Users\Rocky\DoNext-signing\`**:

- `donext-upload.jks` is the key itself.
- `README-PASSWORD.txt` holds its password.

**Back up this folder** to a USB stick or a private cloud drive. `client/android/keystore.properties` points the build at the key; it's in `.gitignore` and must never be committed.

### 3. Build

```bash
cd client
npm run build:android      # builds the app and copies it into android/
cd android
./gradlew bundleRelease    # on Windows: gradlew.bat bundleRelease
```

The file to upload is **`client/android/app/build/outputs/bundle/release/app-release.aab`**.

### 4. Try it on your phone first (recommended)

1. On your Android phone, turn on **Developer options** (Settings → About phone → tap **Build number** 7 times), then **USB debugging**.
2. Connect the phone with USB. In `client/android`, run `gradlew.bat installDebug`, or open the `android` folder in Android Studio and press ▶ Run.
3. Test these:
   - Tap the mic and say *"I have a job tomorrow at 9, priority high, remind me 1 hour before, add it"*.
   - Allow notifications when asked.
   - Create a task due in 2 minutes, close the app, and wait for the reminder notification and its chime.

---

## Part 2: Create your Google Play developer account

1. Go to <https://play.google.com/console/signup> and sign in with your Google account.
2. Choose **Yourself** (a personal account), pay the **$25 one-time** fee, and complete **identity verification** (government ID). Verification can take a few days.
3. **Important for new personal accounts:** before your app can go public, you must run a **closed test with at least 12 testers for 14 days in a row** (Part 5). Start collecting 12 testers now: friends or family with Android phones and a Gmail address.

---

## Part 3: Create the app

In Play Console, click **Create app** and fill in:

| Field | Value |
| --- | --- |
| App name | `DoNext: Voice To-Do List` |
| Default language | English (United States) |
| App or game | App |
| Free or paid | Free |
| Declarations | Tick both (Developer Program Policies, US export laws) |

---

## Part 4: Set up the store listing and app content

Under **Grow users → Store presence → Main store listing**:

**App name:** `DoNext: Voice To-Do List`

**Short description** (80 characters max):

```
Just say it: voice to-do list with due dates, priorities and reminders.
```

**Full description:**

```
DoNext is the to-do list you can talk to.

Tap the mic and say what you need to do — "I have a job tomorrow at 9, priority high, remind me 1 hour before" — and DoNext fills in the date, time, priority and reminder for you. Say "add it" to save it hands-free.

VOICE FIRST
• Speak your tasks; the words appear as you talk
• Dates and times in plain language: "tomorrow at 9", "Friday 3pm", "October 30", "in 2 hours"
• Priority by voice: "priority high", "urgent", "low priority"
• Reminders by voice: "remind me 30 minutes before", "remind me at 8am"
• Sub-items by voice: "pack for the trip with sub-items passport, charger and tickets"
• Ask your list: "What do I have today?", "What's due tomorrow?", "Anything overdue?"
• Finish tasks by voice: "Mark the job as done"
• Replies can be read aloud

STAY ON TOP OF IT
• Due dates and times with "3 days left" and "2 hours overdue" labels
• Reminders that ring even when the app is closed, with a chime and snooze
• Priorities, categories, search and filters
• Checklists inside each task, with a progress bar
• Smart suggestions: "milk, eggs and bread" becomes a grocery list
• Pick dates from a calendar, or type them

PRIVATE BY DESIGN
• No account, no sign-up
• Your tasks stay on your phone: nothing is sent to us
• Because tasks are stored only on your device, we can't back them up or recover them: uninstalling the app deletes them
• No ads, no tracking
• Works offline

Dark mode, large touch targets and screen-reader support included.

DoNext is free and open source (MIT). Made by Dewan Mahmud.
```

**Graphics** (from `docs/play-store/`):

| Asset | File |
| --- | --- |
| App icon (512 × 512) | `icon-512.png` |
| Feature graphic (1024 × 500) | `feature-graphic-1024x500.jpg` |
| Phone screenshots (upload all 6, in order) | `screenshot-1-voice.jpg` … `screenshot-6-date.jpg` |

**Store settings** (under **Store presence → Store settings**):

| Field | Value |
| --- | --- |
| App category | Productivity |
| Tags | To-do list, Productivity, Reminders (pick the closest available) |
| Email | dewan.swe@gmail.com (shown publicly) |
| Website | https://dewantechus.github.io/donext/ |

### App content (under **Policy → App content**)

Answer each section like this:

| Section | Answer |
| --- | --- |
| **Privacy policy** | `https://dewantechus.github.io/donext/privacy` |
| **Ads** | No, my app does not contain ads |
| **App access** | All functionality is available without special access |
| **Content rating** | Start the questionnaire. Category: **Utility, Productivity, Communication or Other**. Answer **No** to everything: no violence, sexual content, profanity, drugs or gambling. There are no user-to-user chats or sharing, and no location sharing. The expected rating is **Everyone / PEGI 3**. |
| **Target audience** | **18 and over** (the simplest choice; DoNext isn't designed for children) |
| **News app** | No |
| **COVID-19 apps** | Not a COVID-19 app |
| **Data safety** | See below |
| **Government apps** | No |
| **Financial features** | None |
| **Health** | No health features |
| **Advertising ID** | No, the app doesn't use the advertising ID |

### Data safety answers

- **Does your app collect or share any of the required user data types?** → **No.**
  - Tasks, names and reminders are stored only on the phone. DoNext has no server and sends nothing.
  - Voice input uses Android's built-in speech recognition service (the system's, not DoNext's), and DoNext receives only the text.
- That's the whole form. With "No", the remaining questions are skipped. The Privacy Policy states the same.

---

## Part 5: Closed test, then production

### 1. Closed testing (required for new personal accounts)

1. Go to **Test and release → Testing → Closed testing → Create track** (or use the default "Closed testing - Alpha").
2. **Testers:** create an email list with at least **12** Gmail addresses (yours plus friends and family).
3. **Create new release:**
   - Choose **Use Google-generated key** for Play App Signing (recommended), which signs the app for users.
   - Upload `app-release.aab`.
   - **Release name:** `1.0.0`
   - **Release notes:**
     ```
     First release of DoNext: the to-do list you can talk to.
     • Add tasks by voice with dates, priorities and reminders
     • Hands-free: say "add it" to save, "what do I have today?" to hear your list
     • Reminders that ring even when the app is closed
     • Private: everything stays on your phone
     ```
4. **Review release → Start rollout to Closed testing.** Google reviews it, usually within a few days.
5. Copy the **opt-in link** (Closed testing → Testers) and send it to your testers. Each tester must accept, install the app, and **stay opted in for 14 days**. Ask them to open the app now and then.

### 2. Apply for production

After 14 days with 12+ opted-in testers:

1. Go to **Dashboard → Apply for production**.
2. Answer the short questions about your test, for example: "Testers used voice input, reminders and notifications; we fixed feedback on …". Be specific and honest.
3. Once approved, go to **Production → Create new release**, choose **Promote release** from closed testing (or upload the same `.aab`), and **Start rollout to Production**.

---

## Updating the app later

1. Make your changes, then raise the version in `client/android/app/build.gradle`:
   ```groovy
   versionCode 2          // must go up by at least 1 every upload
   versionName "1.0.1"
   ```
2. Run `npm run build:android`, then `gradlew.bat bundleRelease`, and upload the new `.aab` as a new release.

## If something goes wrong

| Problem | Fix |
| --- | --- |
| `Unsupported class file major version 69` | Android Studio's bundled Java 25 is too new for Gradle 8.14. Build with Java 21: set `JAVA_HOME` to a JDK 21 folder (on this PC: `C:\Users\Rocky\.donext-build\jdk-21.0.12.1+1`). |
| `PKIX path building failed` while downloading | Antivirus HTTPS scanning (for example Norton). Use a trust store that includes the antivirus certificate: set `JAVA_TOOL_OPTIONS=-Djavax.net.ssl.trustStore=C:/Users/Rocky/.donext-build/cacerts -Djavax.net.ssl.trustStorePassword=changeit` before running Gradle. |
| `The filename, directory name, or volume label syntax is incorrect` | In `client/android/local.properties`, write the SDK path with forward slashes: `sdk.dir=C:/Users/Rocky/AppData/Local/Android/Sdk`. |
| `SDK location not found` | Open Android Studio once (Part 1, step 1). If it still fails, create `client/android/local.properties` with `sdk.dir=C\:\\Users\\Rocky\\AppData\\Local\\Android\\Sdk`. |
| `Keystore was tampered with, or password was incorrect` | Check `client/android/keystore.properties` against `README-PASSWORD.txt`. |
| Reminders arrive a few minutes late | In the app: **Account → Reminders → Exact times → Allow**. |
| No sound on reminders | Phone settings → Apps → DoNext → Notifications → Reminders → Sound on. |
| Voice says "not available" | Install or update the **Google** app, which provides Android's speech recognition. |
