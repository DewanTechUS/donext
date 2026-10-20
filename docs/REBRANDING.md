# Rebranding guide: make DoNext your own app

You're welcome to build your own app from this code. The **DoNext** name and logo are reserved (see [TRADEMARKS.md](../TRADEMARKS.md)), so replace them before you publish. Most of the branding lives in a few places.

## 1. Names and text

Edit [`client/src/lib/brand.ts`](../client/src/lib/brand.ts):

```ts
export const APP_NAME = 'YourApp';
export const AUTHOR_NAME = 'Your Name or Company';
export const AUTHOR_SITE_URL = 'https://your-site.com';
export const AUTHOR_SITE_LABEL = 'your-site.com';
export const REPO_URL = 'https://github.com/you/yourapp';
// …and the contact emails and legal details in LEGAL
```

Then update the places outside the app code:

| File | What to change |
| --- | --- |
| `client/index.html` | `<title>`, description and `apple-mobile-web-app-title` |
| `client/vite.config.ts` | `name`, `short_name` and `description` in the app manifest |
| `client/capacitor.config.ts` | `appId` (e.g. `com.yourcompany.yourapp`) and `appName` |
| `client/src/components/Brand.tsx` | The two-colour "Do**Next**" wordmark |
| `client/src/pages/LandingPage.tsx` | The headline "Know what to do next" |
| `server/src/lib/mailer.ts` | Email subjects and signatures that mention DoNext |
| `README.md`, `TRADEMARKS.md`, `docs/` | Rewrite for your project. Keep `LICENSE` with the original copyright notice, which the MIT License requires, and add your own name to it. |

To find anything you missed, search the whole project for `DoNext` and `Dewan Mahmud`.

## 2. Logos and icons

1. Replace the image in [`branding/`](../branding):
   - `donext-logo.png`: your app icon (square, 1024 px or larger).
2. Rebuild every icon, splash screen and in-app logo:
   ```bash
   npm run icons
   ```
3. If you build the phone apps, regenerate their icons:
   ```bash
   npm run cap:assets -w client
   ```

You can rename the image files too, as long as you update the paths in `scripts/generate-icons.mjs`.

## 3. Colours (optional)

The brand colours are in [`client/tailwind.config.js`](../client/tailwind.config.js), under `colors.brand` and `colors.success`, and the theme colour is in `client/vite.config.ts` and `client/index.html`.

## 4. Check before publishing

- [ ] Searching the project for `DoNext` and `Dewan Mahmud` finds nothing you didn't intend. Mentions like *"based on the open-source DoNext project"* are fine.
- [ ] Your app shows your own name, logo and icons everywhere: the browser tab, the installed app icon and the splash screen.
- [ ] The Privacy Policy and Terms name **you** as the provider, with your contact details.
- [ ] `LICENSE` still includes the original copyright notice, plus yours.

Thanks for building with DoNext! A link back to the original project is appreciated, but not required.
