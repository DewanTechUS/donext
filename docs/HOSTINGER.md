# Deploying DoNext on Hostinger

DoNext runs as a **Node.js Web App** in Hostinger's hPanel. One Node process serves both the website and the API, at an address such as `https://donext.dewanmahmud.com`.

> **Plan requirement:** Node.js apps are available on Hostinger **Business Web Hosting** and the **Cloud** plans (Startup, Professional, Enterprise, Enterprise Plus). The Premium and Single plans can't run DoNext; upgrade in hPanel, or use a Hostinger VPS (see the end of this guide).

---

## Before you start

You need:

1. **MongoDB Atlas.** Your cluster is already set up. In Atlas:
   - Go to **Network Access → Add IP Address** and allow your Hostinger app to connect. Hostinger's shared/cloud servers don't have a fixed outgoing IP you control, so the simplest option is `0.0.0.0/0` (allow from anywhere). This is acceptable because the connection still needs your database username and strong password. Use a long, random database password.
   - Turn on **Backups** for the cluster. Paid tiers include them; on the free M0 tier, download a copy regularly instead.
2. **Email sending (SMTP)** for password reset emails. Options:
   - The email service that comes with your Hostinger plan, if you use Hostinger email for dewanmahmud.com: `smtp.hostinger.com`, port `465`, secure.
   - Amazon SES, Postmark, SendGrid and so on.
3. **The GitHub repo**, `DewanTechUS/donext` (or your own fork).

---

## Step 1: Create the subdomain

In hPanel, go to **Domains → Subdomains** and create `donext.dewanmahmud.com`. You can also attach it directly when creating the app in step 2.

## Step 2: Create the Node.js app

In hPanel, go to **Websites → Add website → Node.js Web App**. The menu names may differ slightly. Then:

1. Choose **Import from GitHub** and authorise Hostinger's GitHub App for the **DewanTechUS/donext** repository (or your fork).
2. Pick branch **main**.
3. Enter these **build settings**:

| Field | Value |
| --- | --- |
| Framework preset | **Express.js**, or **Other** |
| Root directory | the repository root (leave empty / `/`). Don't pick `client` or `server`. |
| Node.js version | **22** |
| Package manager | **npm** |
| Build command | **`build`**, which runs the root `npm run build` and builds both the website and the server |
| Output directory | leave empty (or `server/dist` if the field is required) |
| Entry file | **`server/dist/index.js`** |

## Step 3: Environment variables

Add these in the app's **Environment Variables** section. Never put them in GitHub.

| Name | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | your Atlas connection string, including your password, e.g. `mongodb+srv://USER:PASSWORD@your-cluster.xxxxx.mongodb.net/donext?retryWrites=true&w=majority` |
| `JWT_SECRET` | a new long random value (see below) |
| `JWT_EXPIRES_IN` | `7d` |
| `SERVE_CLIENT` | `true` |
| `APP_URL` | `https://donext.dewanmahmud.com` |
| `TRUST_PROXY` | `1` |
| `CORS_ORIGINS` | `https://donext.dewanmahmud.com` |
| `SMTP_HOST` | e.g. `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | e.g. `you@gmail.com` (an email account you create in hPanel → Emails) |
| `SMTP_PASS` | that email account's password |
| `MAIL_FROM` | `DoNext <you@gmail.com>` |
| `MONGOMS_DISABLE_POSTINSTALL` | `1`. This skips downloading a test database that only the test suite needs, which makes builds faster. |

Hostinger normally provides `PORT` itself, and DoNext uses it automatically. Don't set `PORT` unless Hostinger's docs or support tell you to.

To generate `JWT_SECRET`, run this on your PC and paste the output:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Use a different secret than the one in your local `server/.env`.**

## Step 4: Deploy

Click **Deploy**. Hostinger installs the dependencies, runs the build and starts `server/dist/index.js`.

- Build output is under **Deployments**, and app output under **Runtime logs**. A successful start shows:
  ```
  Connected to MongoDB
  DoNext API listening on http://localhost:<port>
  ```
- In hPanel, make sure **SSL** is active for `donext.dewanmahmud.com`. It's usually issued automatically.

From then on, every `git push` to `main` redeploys automatically.

## Step 5: Check that it works

Open `https://donext.dewanmahmud.com` and confirm:
- [ ] `https://donext.dewanmahmud.com/api/health` shows `{"ok":true,"db":"connected"}`.
- [ ] You can sign up, add a task (typed and by voice), and see it after a refresh.
- [ ] Opening `https://donext.dewanmahmud.com/support` directly works.
- [ ] **Forgot password?** sends you an email, and the link works.
- [ ] On your phone, **Add to Home Screen** works, and the app opens offline with your tasks.

## Step 6: Link it from dewanmahmud.com

On your main website, add a menu item or button such as "DoNext — To-Do app" that links to `https://donext.dewanmahmud.com`.

---

## Troubleshooting

| What you see | Fix |
| --- | --- |
| `Invalid environment configuration … JWT_SECRET` | `JWT_SECRET` is missing or shorter than 32 characters |
| `MongoServerSelectionError` / timeout | Atlas **Network Access** doesn't allow Hostinger. Add `0.0.0.0/0`, or check the URI and password. |
| `bad auth` | Wrong database password in `MONGODB_URI`. URL-encode special characters such as `@` → `%40`. |
| App starts but the site shows "Not found" | `SERVE_CLIENT` isn't `true`, or the build didn't create `client/dist`. Check the build log. |
| Reset emails don't arrive | Check the SMTP values. "Email not sent (SMTP not configured)" in the runtime log means `SMTP_HOST` is empty. Also check the spam folder. |
| Build fails during `npm install` | Make sure the Node.js version is **22** and `MONGOMS_DISABLE_POSTINSTALL=1` is set |

## Alternative: Hostinger VPS

If you'd rather not upgrade your web hosting plan, a Hostinger **KVM VPS** works too. Follow section **A → 3b (Ubuntu + Nginx)** or **3c (Docker)** in [DEPLOYMENT.md](DEPLOYMENT.md).
