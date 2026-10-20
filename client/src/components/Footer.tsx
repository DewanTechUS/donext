import { Link } from 'react-router-dom';
import { AUTHOR_SITE_LABEL, AUTHOR_SITE_URL } from '../lib/brand';
import { AuthorLine } from './Brand';

const linkClass = 'rounded-md px-2 py-1 hover:text-slate-900 dark:hover:text-white';

export function Footer() {
  return (
    // On phones and tablets the footer lives in the header's menu instead.
    <footer className="safe-bottom mt-auto hidden border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:block">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
        <AuthorLine />
        <nav aria-label="Legal" className="flex shrink-0 items-center">
          <Link to="/support" className={linkClass}>
            Support
          </Link>
          <Link to="/privacy" className={linkClass}>
            Privacy
          </Link>
          <Link to="/terms" className={linkClass}>
            Terms
          </Link>
          <a href={AUTHOR_SITE_URL} rel="noopener" className={linkClass}>
            {AUTHOR_SITE_LABEL}
          </a>
        </nav>
      </div>
    </footer>
  );
}
