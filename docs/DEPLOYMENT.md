# Deploying DoNext to your website

> **Using Hostinger?** Follow [HOSTINGER.md](HOSTINGER.md) instead. It has the exact hPanel settings.

The app has two parts:

- **The web app:** static files built into `client/dist`.
- **The API:** a Node.js server.

The API needs a host that runs Node.js 20 or later, such as a VPS, Render, Railway, Fly.io, DigitalOcean App Platform, or cPanel's *Setup Node.js App*. A static-only host can't run it.

Choose **one** of these layouts:

| Layout | Example URL | Best for |
| --- | --- | --- |
| **A. Subdomain, single server** (recommended) | `https://donext.dewanmahmud.com` | Simplest setup: one Node process serves the API and the app, everything is same-origin, and you don't need to configure CORS |
| **B. Sub-path on your existing site + separate API** | `https://dewanmahmud.com/todo/` with the API at `https://api.dewanmahmud.com` | Your main site is on static or shared hosting and you want the app under its domain |

HTTPS is **required**. Service workers (offline support and installability), the microphone, and secure sign-in all depend on it.

---

## A. Subdomain, single server

### 1. DNS

Create an `A` record (or a `CNAME`, if your platform gives you one) for `donext.dewanmahmud.com` that points at your host. *You do this in your domain registrar's or DNS provider's dashboard, using your own account.*

### 2. Build and configure

On the server, or in your platform's build step:

```bash
npm ci
npm run build          # builds client/dist and server/dist
```

Create `server/.env` from `.env.example`:

```ini
NODE_ENV=production
PORT=4000
MONGODB_URI=mongodb+srv://...            # see README → MongoDB setup
JWT_SECRET=<64+ random hex chars>
SERVE_CLIENT=true
TRUST_PROXY=1                            # behind Nginx / a PaaS load balancer
CORS_ORIGINS=capacitor://localhost,https://localhost   # only needed for the mobile apps
APP_URL=https://donext.dewanmahmud.com     # used in password reset emails
# SMTP settings: see "Emails" below (free with Gmail)
```

Start it with `npm start`, which runs `node server/dist/index.js`.

### 3a. On a PaaS (Render, Railway, DigitalOcean App Platform, …)

- **Build command:** `npm ci && npm run build`
- **Start command:** `npm start`
- **Environment variables:** set the values above in the dashboard, not in a committed file.
- **Health check path:** `/api/health`
- **Custom domain:** add `donext.dewanmahmud.com` in the platform's dashboard; the platform issues the TLS certificate.

### 3b. On your own VPS (Ubuntu + Nginx)

Keep the process running with systemd. Create `/etc/systemd/system/donext.service`:

```ini
[Unit]
Description=DoNext
After=network.target

[Service]
WorkingDirectory=/srv/donext
ExecStart=/usr/bin/node server/dist/index.js
EnvironmentFile=/srv/donext/server/.env
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now donext
```

Nginx reverse proxy, in `/etc/nginx/sites-available/donext.dewanmahmud.com`:

```nginx
server {
    server_name donext.dewanmahmud.com;
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then get a free TLS certificate:

```bash
sudo certbot --nginx -d donext.dewanmahmud.com
```

### 3c. With Docker

```bash
docker build -t donext .
docker run -d --restart unless-stopped -p 4000:4000 --env-file server/.env donext
```

The image sets `SERVE_CLIENT=true` and includes a health check. Put Nginx or your platform's TLS termination in front of it, as in 3b.

### 4. Link it from your website

Add a menu item or button on dewanmahmud.com that links to `https://donext.dewanmahmud.com`.

---

## B. Sub-path on your existing website (`dewanmahmud.com/todo/`)

### 1. Deploy the API

Deploy the API on its own subdomain, such as `api.dewanmahmud.com`, following section A with `SERVE_CLIENT=false` and:

```ini
CORS_ORIGINS=https://dewanmahmud.com,https://www.dewanmahmud.com,capacitor://localhost,https://localhost
```

### 2. Build the web app for the sub-path

```bash
# client/.env.production
VITE_BASE_PATH=/todo/
VITE_API_URL=https://api.dewanmahmud.com
```

```bash
npm run build -w client
```

### 3. Upload the files

Upload the **contents** of `client/dist/` to the `/todo/` folder of your website, for example `public_html/todo/` on cPanel.

### 4. Add the SPA fallback

Your web server must send unknown paths under `/todo/` to `/todo/index.html`, so links like `/todo/account` work when the page is refreshed.

**Apache / cPanel:** create `public_html/todo/.htaccess`:

```apache
RewriteEngine On
RewriteBase /todo/
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /todo/index.html [L]

<FilesMatch "^(sw\.js|index\.html|manifest\.webmanifest)$">
  Header set Cache-Control "no-cache"
</FilesMatch>
<IfModule mod_headers.c>
  <If "%{REQUEST_URI} =~ m#^/todo/assets/#">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </If>
</IfModule>
```

**Nginx:**

```nginx
location /todo/ {
    try_files $uri $uri/ /todo/index.html;
}
location = /todo/sw.js { add_header Cache-Control "no-cache"; }
location /todo/assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
```

### 5. Add security headers (recommended)

In layout B, your static host serves the app, so Express's Helmet headers don't apply to it. Add a CSP on your host that allows the API origin:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.dewanmahmud.com; frame-ancestors 'none'; object-src 'none'
```

---

## Emails: password resets and shared-list invitations (SMTP)

DoNext sends these emails:

- a reset link when someone taps **Forgot password?**
- an invitation when someone is invited to a shared list
- a confirmation to the list owner when the invited person joins

To deliver them, the server needs an SMTP account. *You sign up for this with your own account.* Without one, invitations still work inside the app: the invited person sees them after logging in, and the inviter is told that email notifications are coming soon.

### Free option: Gmail

A regular Gmail account can send a few hundred emails a day for free, which is plenty for a personal or portfolio app.

1. Turn on **2-Step Verification** for the Google account (myaccount.google.com → Security).
2. Create an **App password**: myaccount.google.com/apppasswords → name it "DoNext" → copy the 16-character password.
3. Set these on the server, and never commit them:
   ```ini
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=you@gmail.com
   SMTP_PASS=the-16-character-app-password
   MAIL_FROM=DoNext <you@gmail.com>
   ```
4. Restart the server and invite yourself (another address) to a list. The app should say **"Invitation emailed to …"**.

Gmail sends from your Gmail address. To send from a dewanmahmud.com address, use one of the providers below. Brevo and Resend also have free plans.

### Other providers

- **Amazon SES:** very cheap, requires verifying your domain.
- **Postmark** or **SendGrid:** quick to set up, with free or low-cost tiers.
- **Google Workspace / Microsoft 365:** if you already use them for dewanmahmud.com email.

Add these to the server's environment:

```ini
APP_URL=https://donext.dewanmahmud.com          # where the web app lives (include a sub-path such as /todo if you use one)
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false                             # true for port 465
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
MAIL_FROM=DoNext <you@gmail.com>     # a sender address your provider has verified
```

To improve delivery, add the SPF and DKIM DNS records your provider gives you for dewanmahmud.com.

- **Without `SMTP_HOST`** (development), reset emails are printed in the server log, so you can copy the link from there.
- **In production without SMTP**, the server logs a warning at startup, and users won't receive reset emails.

**Test it:** on the login page, tap **Forgot password?**, enter your email, and open the link you receive.

## After deploying: verify

- [ ] `https://<your-url>/api/health` returns `{"ok":true,"db":"connected"}`. In layout B, check this on the API host.
- [ ] Sign up, add a task, and refresh on a deep link such as `/account`. The page should load.
- [ ] Chrome DevTools → **Application → Manifest** shows no installability errors, and the **Install** icon appears in the address bar.
- [ ] Turn on airplane mode, then reload. The app opens with your tasks. Add a task, reconnect, and confirm it syncs ("Synced" in the header).
- [ ] The microphone works over HTTPS in Chrome, Edge, or Safari.
- [ ] On a phone:
  - **Android Chrome:** ⋮ → **Install app**.
  - **iOS Safari:** Share → **Add to Home Screen**.

## Production checklist

- [ ] `JWT_SECRET` is long, random, and stored only in your host's secret settings. If it ever leaks, rotate it; this logs everyone out.
- [ ] The MongoDB Atlas network access list is restricted, the database user has the least privilege it needs, and **backups** are enabled.
- [ ] `NODE_ENV=production` and `TRUST_PROXY` match your proxy setup.
- [ ] `CORS_ORIGINS` lists only origins you control.
- [ ] `APP_URL` and the SMTP settings are set, and a test password reset email arrives.
- [ ] An uptime monitor watches `/api/health`.
- [ ] Legal page placeholders are completed and reviewed (see the README checklist).

## Updating the app

Deploy the new build the same way. The service worker uses `autoUpdate`, so installed web apps pick up the new version on the next launch after it downloads.

If you change the `Task` schema in the future, keep the sync API backward compatible. Users of the mobile apps may run older versions for a while.
