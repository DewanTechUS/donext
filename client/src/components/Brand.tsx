import appLogo from '../assets/donext-logo.png';
import { AUTHOR_NAME, AUTHOR_SITE_URL } from '../lib/brand';

/** DoNext app icon. Decorative by default; pass `alt` when it is the only label. */
export function AppLogo({ size = 36, alt = '' }: { size?: number; alt?: string }) {
  return (
    <img
      src={appLogo}
      width={size}
      height={size}
      alt={alt}
      className="shrink-0 rounded-[22%] shadow-sm"
      draggable={false}
    />
  );
}

/** "DoNext" word mark next to the app icon. */
export function AppWordmark({ size = 36 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <AppLogo size={size} />
      <span className="text-xl font-extrabold tracking-tight text-brand-900 dark:text-white">
        Do<span className="text-brand-600 dark:text-brand-400">Next</span>
      </span>
    </span>
  );
}

/** Copyright line with a link to the author's website. */
export function AuthorLine({ className = '' }: { className?: string }) {
  return (
    <p className={`truncate ${className}`}>
      © {new Date().getFullYear()}{' '}
      <a href={AUTHOR_SITE_URL} rel="noopener" className="rounded underline-offset-2 hover:underline">
        {AUTHOR_NAME}
      </a>
    </p>
  );
}
