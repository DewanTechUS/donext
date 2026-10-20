# iOS and Android apps (Capacitor)

DoNext is packaged as native iOS and Android apps with **Capacitor 8**. The native shell loads the built web files from inside the app and calls your deployed API over HTTPS.

> **Nothing has been submitted to Apple or Google.** This guide explains how *you* build, sign, and submit the apps. Every step that needs a developer account, a signing key, or a store dashboard is marked 🔑. Store approval is decided by Apple and Google and is not guaranteed.

> **Publishing on Google Play?** Follow [GOOGLE-PLAY.md](GOOGLE-PLAY.md). The Play version is the local app (`npm run build:android`): tasks stay on the phone, and no server is needed.

## What's already set up

| | Status |
| --- | --- |
| Android project (`client/android/`) | ✅ Created. Targets **API 36 (Android 16)**, as Google Play has required for new apps and updates since August 31, 2026. Minimum Android 7.0 (API 24). |
| iOS project (`client/ios/`) | ✅ Created, using CocoaPods. Minimum iOS 15. |
| App ID / bundle ID | ✅ `com.dewantech.donext`. It can still change until your first store release, but never after. |
| App name | ✅ DoNext |
| App icons and splash screens | ✅ Generated from your DoNext logo for both platforms |
| Microphone and speech permissions | ✅ iOS usage descriptions and Android `RECORD_AUDIO` added |
| iOS privacy manifest (`PrivacyInfo.xcprivacy`) | ✅ Added and registered in the Xcode project |
| Version | ✅ 1.0.0, build 1 |

These projects were generated on Windows. Neither has been compiled yet, because that needs Android Studio (Android) and a Mac with Xcode (iOS).

---

## 1. Prerequisites

| | Android | iOS |
| --- | --- | --- |
| Computer | Windows, macOS, or Linux | **macOS only** |
| Tools | **Android Studio Otter (2025.2.1) or later**, with Android SDK 36 and JDK 21 (bundled with Android Studio) | **Xcode 26 or later** and **CocoaPods** (`sudo gem install cocoapods` or `brew install cocoapods`) |
| Device for testing | Android 7.0 or later | iOS 15 or later |
| 🔑 Account to publish | Google Play Console: one-time US$25 fee | Apple Developer Program: US$99 per year |

You also need:
- Node.js 22 or later.
- Your API deployed on HTTPS (see [DEPLOYMENT.md](DEPLOYMENT.md)). Native apps can't reach `localhost` on your PC.

## 2. Point the app at your live API (once)

```bash
cd client
cp .env.mobile.example .env.mobile      # then set VITE_API_URL=https://donext.dewantech.com
```

On the server, add the native app origins to `CORS_ORIGINS`:

```ini
CORS_ORIGINS=https://donext.dewantech.com,capacitor://localhost,https://localhost
```

- `capacitor://localhost` is the iOS app's origin.
- `https://localhost` is the Android app's origin.

## 3. Build and run

From `client/`:

```bash
npm run cap:android   # builds the web app → copies it into Android → opens Android Studio
npm run cap:ios       # same for iOS → runs pod install → opens Xcode (Mac only)
```

- **Android Studio:** wait for the Gradle sync to finish, pick a device or emulator, then press ▶ Run.
- **Xcode:**
  1. Open the **App** target.
  2. Under **Signing & Capabilities**, choose your 🔑 Team. A free Apple ID is enough for testing on your own iPhone.
  3. Pick a device and press ▶.

Re-run the same command after every change to the web code.

**Useful commands:**
- `npm run cap:assets` regenerates icons and splash screens after you change `client/assets/`.
- `npm run cap:configure` re-applies permissions and the privacy manifest. It's safe to run any time.

## Microphone and speech permissions

The voice button uses [`@capacitor-community/speech-recognition`](https://github.com/capacitor-community/speech-recognition), which uses the operating system's speech recognizer. `npm run cap:configure` ([client/scripts/configure-native.mjs](../client/scripts/configure-native.mjs)) adds:

| Platform | What gets added | Why |
| --- | --- | --- |
| iOS `Info.plist` | `NSMicrophoneUsageDescription` | Text in the microphone permission prompt. Required: without it the app crashes, and Apple rejects vague wording. |
| iOS `Info.plist` | `NSSpeechRecognitionUsageDescription` | Text in the speech recognition prompt. Also required. |
| iOS | `PrivacyInfo.xcprivacy` (from `client/native/ios/`) | Apple's privacy manifest. It declares the data the app collects and its UserDefaults use. |
| Android `AndroidManifest.xml` | `android.permission.RECORD_AUDIO` | Runtime microphone permission |
| Android `AndroidManifest.xml` | `<queries>` for `android.speech.RecognitionService` | Lets Android 11+ find the system speech service |

**What the user sees:**

1. They tap the mic, and an in-app explainer appears.
2. They tap **Continue**, and the OS permission prompts appear. iOS asks twice: microphone, then speech recognition.
3. Words appear in the box as they speak. They tap the arrow to add the task.
4. If they deny permission, the app explains how to turn it back on:
   - **iOS:** Settings → DoNext → Microphone / Speech Recognition.
   - **Android:** Settings → Apps → DoNext → Permissions → Microphone.
5. Typing always works.

**Testing:** test voice on **real devices**. The iOS Simulator and many Android emulators have limited or no speech recognition. Android devices need a speech service, usually provided by the Google app.

## 4. Release builds

### Android: signed App Bundle (.aab)

1. For each new upload, increase `versionCode` (1, 2, 3, …) in `client/android/app/build.gradle`, and update `versionName` (for example `1.0.1`).
2. 🔑 Create an **upload key**, once:
   ```bash
   keytool -genkey -v -keystore donext-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
   Keep it, and its password, somewhere safe and **never commit it**. If you lose it, you have to ask Google support to reset it.
3. In Android Studio, choose **Build → Generate Signed App Bundle or APK → Android App Bundle**, select your keystore, and pick the *release* variant. The output is `app-release.aab`.
4. Turn on **Play App Signing** when you create the app in Play Console.

### iOS: archive and upload

1. 🔑 In the [Apple Developer portal](https://developer.apple.com/account), register the App ID `com.dewantech.donext`.
2. In Xcode, go to **App target → General** and set the *Version* (1.0.0) and *Build* number. The build number must increase with every upload.
3. Under **Signing & Capabilities**, choose your 🔑 team and keep *Automatically manage signing* on.
4. Choose **Product → Archive**, then in **Organizer** choose **Distribute App → App Store Connect → Upload**.
5. Test the uploaded build with **TestFlight** before you submit it for review.

---

## 5. Store submission checklist

✅ done in the app · 📝 you provide · 🔑 needs your developer account

### Both stores

- ✅ **In-app account deletion** (Account → Delete account). Both stores require it.
- ✅ **Password reset**, **change password**, and **download my data** (Account page).
- ✅ **Support page** at `/support`, for the store's *Support URL*.
- ✅ **Privacy Policy** at `/privacy` and **Terms** at `/terms`.
- 📝 **Business details.** Fill in `LEGAL` in [client/src/lib/brand.ts](../client/src/lib/brand.ts): support email, address, dates, providers and so on. Read both pages to check they're accurate, then set `finalized: true`; the "Draft" banner then disappears. The stores require an accurate privacy policy, not a lawyer's review.
- 📝 **Email sending (SMTP)** configured on the server, so password reset emails arrive (see [DEPLOYMENT.md](DEPLOYMENT.md)).
- 📝 **Demo account for reviewers.** Create an account with a few tasks and give the email and password in the review notes (Apple: *App Review Information*; Google: *App access*).
- 📝 **Screenshots:**
  - iPhone 6.9" (and iPad, if you keep iPad support).
  - Android phone, plus 7" and 10" tablet if you list tablet support.
- 📝 **Store listing:** name, short and full description, keywords (Apple), and category (Productivity).
  - Apple's 1024×1024 icon: `client/assets/icon-only.png`.
  - Google's 512×512 icon: `client/public/icons/icon-512.png`, plus a 1024×500 feature graphic that you design.
- 📝 **Content rating / age rating questionnaires.**

### Apple App Store (🔑 App Store Connect)

- **App Privacy answers.** These must match the bundled privacy manifest:
  - Collected: Name, Email Address, and Other User Content (tasks).
  - All linked to the user, used for App Functionality, and not used for tracking.
  - Audio is converted to text by Apple's speech service and isn't collected by DoNext.
- **Export compliance.** The app only uses standard HTTPS. Answer the encryption questions in App Store Connect.
- **Minimum functionality (Guideline 4.2).** In your review notes, mention the native voice input, offline storage and sync.
- **Sign in with Apple** isn't required, because the app only has its own email and password login.
- **Terms.** Use Apple's standard EULA, or make sure your Terms include Apple's minimum terms.

### Google Play (🔑 Play Console)

- **Data safety form:**
  - Declare name, email and tasks as collected.
  - Data is encrypted in transit, and users can delete it.
  - Answer the audio questions according to how the device's speech service handles audio.
- **Account deletion link.** Use `https://<your-domain>/account`; users sign in there and delete their account.
- **Closed testing.** New *personal* developer accounts must first run a closed test with at least 12 testers for 14 continuous days. Check the current rule in Play Console.
- **Target API.** ✅ API 36.

### Suggested release path

1. Test on your own devices: a TestFlight internal group, and Play's *Internal testing* track.
2. Run a closed or external test with real users.
3. Fix the reported issues, then submit for review. Approval and timelines are decided by Apple and Google.
