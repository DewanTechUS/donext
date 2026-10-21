import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IS_DEMO, IS_LOCAL } from '../lib/api';
import { AUTHOR_NAME, LEGAL, LEGAL_IS_DRAFT, REPO_URL, type LegalField } from '../lib/brand';

/**
 * Highlighted placeholder. Business details come from LEGAL in lib/brand.ts — fill them in there.
 */
function Ph({ children }: { children: ReactNode }) {
  return <mark className="placeholder-mark">[{children}]</mark>;
}

/** A business detail from LEGAL in lib/brand.ts, or a highlighted placeholder while it is empty. */
function V({ k, label }: { k: LegalField; label: string }) {
  const value = String(LEGAL[k] ?? '').trim();
  return value ? <>{value}</> : <Ph>{label}</Ph>;
}



/** Optional: individuals don't have to publish a home address. */
const address = LEGAL.businessAddress.trim();

function DraftNotice() {
  if (!LEGAL_IS_DRAFT) return null;
  return (
    <div role="note" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100">
      <strong>Draft.</strong> Some details on this page (<mark className="placeholder-mark">[highlighted]</mark>) are still being
      completed and will be updated before launch.
    </div>
  );
}

/**
 * The live demo has no server: nothing leaves the visitor's browser. Its policies are short,
 * complete and specific to that. The full policies (below) apply to a hosted version.
 */
function DemoLegal({ kind }: { kind: 'privacy' | 'terms' }) {
  return (
    <article className="prose-page mx-auto max-w-3xl">
      <h1 className="mb-1 text-3xl font-bold tracking-tight">{kind === 'privacy' ? 'Privacy Policy' : 'Terms of Use'}</h1>
      <p className="text-sm">
        For the DoNext app for Android and the DoNext live demo · {AUTHOR_NAME} · Effective October 20, 2026
      </p>

      {kind === 'privacy' ? (
        <>
          <h2>The short version</h2>
          <p>
            DoNext keeps your tasks on your own device. We (Dewan Mahmud, the developer) don't collect, receive, sell or share your personal data. There is no
            account to create, and the app has no ads, analytics or tracking.
          </p>
          <h2>What is stored, and where</h2>
          <ul>
            <li>
              Your name (if you enter one), tasks, sub-items, due dates, reminders and settings are saved only on your device, in the app's
              private storage (or, for the live demo, in your browser's storage).
            </li>
            <li>Nothing is uploaded to us or to any server we run.</li>
            <li>If several people use DoNext on one device, each has their own tasks, but anyone using that device can open any person’s tasks. There’s no password.</li>
            <li>
              To delete your data, use <strong>Account → Erase my data</strong>; to delete everyone’s on the device, uninstall the app (in the demo: clear this site's
              data in your browser).
            </li>
          </ul>
          <h2>Permissions the app asks for</h2>
          <ul>
            <li>
              <strong>Microphone and speech recognition</strong>, only when you tap the microphone, to turn your voice into text. Speech is
              processed by your device's speech service (on Android, usually Google's speech recognition; in a browser, the browser's
              provider), under that provider's privacy policy. DoNext receives only the resulting text and never records or stores audio.
            </li>
            <li>
              <strong>Notifications</strong> and <strong>alarms and reminders</strong>, so your reminders can ring at the right time, even
              when the app is closed. Reminders are scheduled on your device.
            </li>
            <li>
              <strong>Text-to-speech</strong>: if you turn on read-aloud, reminders and answers are spoken by your device's built-in voice.
            </li>
          </ul>
          <h2>Children</h2>
          <p>DoNext is not directed to children under 13, and we don't knowingly collect information from anyone.</p>
          <h2>Hosting of this page and the demo</h2>
          <p>
            This page and the live demo are served by GitHub Pages, which, like any web host, may log basic request information such as IP
            addresses. See GitHub's privacy statement for details.
          </p>
          <h2>Changes</h2>
          <p>If this policy changes, we'll update this page and its effective date.</p>
          <h2>Contact</h2>
          <p>
            Questions: <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>.
          </p>
        </>
      ) : (
        <>
          <h2>Free, and provided as is</h2>
          <p>
            DoNext (the Android app and the live demo) is free. It's provided <strong>as is</strong>, without warranties of any kind.
            Your data lives only on your device and can be lost, for example if you uninstall the app, erase its data or clear your
            browser. Reminders depend on your device's settings (such as notification and battery settings) and may be late or missed,
            so please don't rely on DoNext for anything critical.
          </p>
          <h2>Your data is your responsibility</h2>
          <p>
            DoNext saves your tasks <strong>only on your own device</strong>. We never receive a copy, so we{' '}
            <strong>cannot see, back up, restore or recover</strong> your tasks. You alone are responsible for keeping them and for
            keeping your own copy of anything important. Your tasks are permanently lost if you uninstall the app, erase or clear its
            data, reset, lose or replace your device, or clear your browser (for the live demo). We are not responsible for any lost
            data.
          </p>
          <h2>Acceptable use</h2>
          <p>Please don't use DoNext to break the law or to attack, overload or misuse it.</p>
          <h2>Open-source code and our name</h2>
          <p>
            DoNext's code is open source under the <a href={`${REPO_URL}/blob/main/LICENSE`}>MIT License</a>. The DoNext name and logo are not covered by that license; see the{' '}
            <a href={`${REPO_URL}/blob/main/TRADEMARKS.md`}>Trademark Policy</a>.
          </p>
          <h2>Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, {AUTHOR_NAME} is not liable for any loss arising from your use of this free
            demo.
          </p>
          <h2>Contact</h2>
          <p>
            Questions: <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>.
          </p>
        </>
      )}
      <p className="mt-8 text-sm">
        <Link to="/">Back to DoNext</Link>
      </p>
    </article>
  );
}

export function PrivacyPage() {
  if (IS_DEMO || IS_LOCAL) return <DemoLegal kind="privacy" />;
  return (
    <article className="prose-page mx-auto max-w-3xl">
      <h1 className="mb-1 text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="text-sm">
        Effective date: <V k="effectiveDate" label="EFFECTIVE DATE" /> · Last updated: <V k="lastUpdated" label="LAST UPDATED DATE" />
      </p>
      <DraftNotice />

      {IS_DEMO && (
        <div role="note" className="mb-6 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <strong>About this live demo:</strong> it runs entirely in your browser. Accounts and tasks you create here are stored only in
          this browser’s storage and are never sent to us or any server. Clearing your browser data deletes them. The policy below
          describes the full version, which uses a server.
        </div>
      )}

      <p>
        This policy explains how {AUTHOR_NAME} (“we”, “us”){address ? `, located at ${address},` : ""}
        collects, uses and protects information when you use the DoNext web app and mobile apps (the “App”).
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account information:</strong> your name, email address, and a securely hashed version of your password (we never
          store your password in readable form).
        </li>
        <li>
          <strong>Your tasks:</strong> titles, descriptions, due dates, priorities, categories and completion status that you enter.
        </li>
        <li>
          <strong>Shared lists:</strong> if you create or join a shared list, everyone in that list can see your name and email address,
          the list’s tasks, and who added or is assigned to each task. When you invite someone, we store their email address and send
          them an invitation email on your behalf. Your personal tasks are never shared.
        </li>
        <li>
          <strong>Technical data:</strong> our servers and hosting provider may log IP addresses, request times and error
          information for security and reliability. Logs are kept for <V k="logRetention" label="LOG RETENTION PERIOD, e.g. 30 days" />.
        </li>
      </ul>
      <p>We do not use advertising trackers, sell your personal information, or share it for cross-context behavioural advertising.</p>

      <h2>Voice input and microphone</h2>
      <p>
        The microphone is used only when you tap the microphone button, to convert your speech into task text. We do not
        record, receive or store audio — only the text you choose to save. Speech recognition is performed by your browser or
        device's speech service: for example, Google Chrome may send audio to Google, and Apple devices may send audio to Apple, to
        perform recognition under their own privacy policies. You can deny or revoke microphone permission at any time in your
        browser or device settings and type tasks instead.
      </p>

      <h2>Data stored on your device</h2>
      <p>
        To work offline, the App stores a copy of your tasks and a sign-in token on your device (browser storage / IndexedDB). This
        copy is removed when you log out or delete your account.
      </p>

      <h2>How we use information</h2>
      <ul>
        <li>To provide the App: authenticate you, store and sync your tasks across your devices.</li>
        <li>To keep the service secure, prevent abuse and fix problems.</li>
        <li>
          To send account emails you ask for, such as password reset links, and to tell you about important changes to this policy.
        </li>
      </ul>
      <p>
        If you are in the European Economic Area, the United Kingdom or a similar jurisdiction, we process your information on these
        legal bases: to perform our contract with you (providing your account and the App); our legitimate interests (keeping the service
        secure, preventing abuse and fixing problems); and your consent where we ask for it (for example, microphone access, which you can
        withdraw at any time in your browser or device settings).
      </p>

      <h2>Service providers</h2>
      <p>
        We use the following providers to run the App, who process data on our behalf: hosting — <V k="hostingProvider" label="HOSTING PROVIDER" />; database —{' '}
        <V k="databaseProvider" label="DATABASE PROVIDER, e.g. MongoDB Atlas" />, region <V k="dataRegion" label="DATA STORAGE REGION" />; email delivery —{' '}
        <V k="emailProvider" label="EMAIL PROVIDER, e.g. Amazon SES or Postmark" />. Other providers: <V k="otherProviders" label="LIST ANY OTHER PROVIDERS, or none" />.
      </p>

      <h2>Where your data is processed</h2>
      <p>
        Your information is stored in the region listed above and may be processed in other countries where our service providers
        operate, including the United States. Where the law requires it, we rely on appropriate safeguards (such as our providers'
        standard contractual clauses) for these transfers.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        We keep your data while your account is active. You can permanently delete your account and all tasks at any time from{' '}
        <Link to="/account" className="underline">
          Account → Delete account
        </Link>
        . Deleted data is removed from our active database immediately and from backups within <V k="backupRetention" label="BACKUP RETENTION PERIOD" />.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit (HTTPS). Passwords are hashed with bcrypt. Access to each user's tasks is restricted to that
        user. No method of transmission or storage is completely secure, but we work to protect your information.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct, export or delete your data, and to object to or
        restrict processing. You can download a copy of your data or delete your account yourself at any time from{' '}
        <Link to="/account" className="underline">
          Account
        </Link>
        . To exercise any other right, email us at <V k="privacyEmail" label="PRIVACY CONTACT EMAIL" /> from the address linked to your
        account. We respond within 30 days, or sooner if the law requires.
      </p>
      <ul>
        <li>
          <strong>EEA and UK residents</strong> have the right to access, correct, delete, restrict or object to the processing of their
          data, to data portability, to withdraw consent at any time, and to complain to their local data protection authority.
        </li>
        <li>
          <strong>California residents</strong> have the right to know what personal information we collect and how we use it, and to
          access, correct and delete it, without being treated differently for using these rights. We do not sell or share personal
          information, as those terms are defined in the California Consumer Privacy Act.
        </li>
      </ul>

      <h2>Children</h2>
      <p>
        The App is not directed to children under <V k="minimumAge" label="MINIMUM AGE, e.g. 13 or 16" />, and we do not knowingly collect their personal
        information.
      </p>

      <h2>Changes</h2>
      <p>We will update this page and the “Last updated” date when this policy changes, and notify you of material changes.</p>

      <h2>Contact</h2>
      <p>
        {AUTHOR_NAME}{address ? `, ${address}` : ""} · Email: <V k="privacyEmail" label="PRIVACY CONTACT EMAIL" />
      </p>
    </article>
  );
}

export function TermsPage() {
  if (IS_DEMO || IS_LOCAL) return <DemoLegal kind="terms" />;
  return (
    <article className="prose-page mx-auto max-w-3xl">
      <h1 className="mb-1 text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="text-sm">
        Effective date: <V k="effectiveDate" label="EFFECTIVE DATE" />
      </p>
      <DraftNotice />

      <p>
        These Terms govern your use of DoNext (the “App”), provided by {AUTHOR_NAME} (“we”, “us”). By creating
        an account or using the App you agree to these Terms and our{' '}
        <Link to="/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>

      <h2>Your account</h2>
      <p>
        You must provide accurate information and keep your password secure. You are responsible for activity under your account.
        You must be at least <V k="minimumAge" label="MINIMUM AGE" /> years old to use the App.
      </p>

      <h2>Your content</h2>
      <p>
        You own the tasks and other content you create. You grant us a limited licence to store, process and transmit that
        content solely to provide the App to you.
      </p>

      <h2>Trademarks and open-source code</h2>
      <p>
        The App’s source code is available under the MIT License. That licence covers the code only. “DoNext” and the DoNext logo are trademarks of Dewan Mahmud and may not be used to name, brand or
        promote any other product or service without written permission. See the{' '}
        <a href={`${REPO_URL}/blob/main/TRADEMARKS.md`} rel="noopener" className="underline">
          Trademark Policy
        </a>
        .
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not attempt to access other users' data or interfere with the App's security or operation.</li>
        <li>Do not use the App for unlawful purposes or to store unlawful content.</li>
        <li>Do not reverse engineer or overload the service except as permitted by law.</li>
      </ul>

      <h2>Pricing</h2>
      <p>
        <V k="pricing" label="STATE WHETHER THE APP IS FREE, OR DESCRIBE PAID PLANS (in-app digital purchases on iOS/Android generally must use Apple/Google billing)" />
      </p>

      <h2>Availability and changes</h2>
      <p>
        We aim to keep the App available but do not guarantee uninterrupted service. We may modify or discontinue features, and
        will give reasonable notice of material changes where practical.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using the App and delete your account at any time. We may suspend or terminate accounts that violate these
        Terms.
      </p>

      <h2>Provided “as is”</h2>
      <p>
        The App is offered <strong>“AS IS” and “AS AVAILABLE”, without
        warranties of any kind</strong>, whether express or implied, including any warranties of merchantability, fitness for a
        particular purpose, accuracy, reliability or non-infringement. We do not promise that the App will always be available, will
        be free of errors, or will meet your needs.
      </p>

      <h2>Your data and backups</h2>
      <p>
        You are responsible for the tasks and other content you put in the App and for keeping your own copies of anything important.
        You can download a copy of your data at any time from the{' '}
        <Link to="/account" className="underline">
          Account
        </Link>{' '}
        page. <strong>We are not responsible for any loss, corruption or deletion of your data</strong>, for any reason —
        including service outages, software errors, sync conflicts, problems with your device or browser, or the deletion of your
        account.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, we and our suppliers will not be liable for any direct,
        indirect, incidental, special, consequential or punitive damages, or for any loss of data, use, profits, revenue or goodwill,
        arising out of or related to your use of (or inability to use) the App, even if we have been told such damages are possible.
      </p>
      <p>
        Our total liability for any claim relating to the App is limited to the amount you paid us for the App in the 12 months
        before the claim. While the App is free, that amount is zero. Some places do not allow certain warranties or liabilities to be
        excluded or limited; where that applies, our liability is limited to the smallest amount the law allows.
      </p>

      <h2>Governing law</h2>
      <p>
        These Terms are governed by the laws of <V k="governingLaw" label="GOVERNING JURISDICTION" />. Disputes will be resolved in{' '}
        <V k="disputeVenue" label="VENUE / DISPUTE RESOLUTION METHOD" />.
      </p>

      <h2>Contact</h2>
      <p>
        {AUTHOR_NAME}{address ? `, ${address}` : ""} · Email: <V k="supportEmail" label="SUPPORT CONTACT EMAIL" />
      </p>
    </article>
  );
}

export function NotFoundPage() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn-primary mt-6">
        Go to my tasks
      </Link>
    </div>
  );
}
