import { useEffect, useRef, useState, type ComponentType, type ReactNode, type SVGProps } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTasks } from '../context/TasksContext';
import { useDialog } from '../hooks/useDialog';
import { APP_NAME, AUTHOR_SITE_LABEL, AUTHOR_SITE_URL } from '../lib/brand';
import { AppWordmark, AuthorLine } from './Brand';
import {
  ChevronRightIcon,
  CloseIcon,
  CloudIcon,
  CloudOffIcon,
  ExternalIcon,
  FileTextIcon,
  GlobeIcon,
  HelpIcon,
  ListIcon,
  LogoutIcon,
  MenuIcon,
  RefreshIcon,
  ShieldIcon,
  UserIcon,
  UsersIcon,
} from './Icons';
import { Spinner } from './Spinner';
import { SyncIndicator } from './SyncIndicator';
import { IS_LOCAL } from '../lib/api';
import { ThemeToggle } from './ThemeToggle';

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

interface NavItem {
  to: string;
  label: string;
  end: boolean;
  Icon: IconType;
  badge?: number;
}

const desktopNavClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-touch items-center rounded-xl px-3 font-medium transition-colors ${
    isActive
      ? 'bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-white'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;

export function Header() {
  const { status } = useAuth();
  const { invites } = useTasks();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  // The menu is for phones and tablets; close it if the window grows to desktop width.
  useEffect(() => {
    const mq = window.matchMedia?.('(min-width: 1024px)');
    if (!mq) return;
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const links: NavItem[] =
    status === 'authenticated'
      ? [
          { to: '/', label: 'My tasks', end: true, Icon: ListIcon },
          ...(IS_LOCAL
            ? [{ to: '/profiles', label: 'Switch person', end: false, Icon: UsersIcon }]
            : [{ to: '/lists', label: 'Shared lists', end: false, Icon: UsersIcon, badge: invites.length }]),
          { to: '/account', label: 'Account', end: false, Icon: UserIcon },
        ]
      : [];

  return (
    <header className="safe-top sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2">
        <Link to="/" className="mr-auto flex min-h-touch items-center rounded-xl pr-2" aria-label={`${APP_NAME} home`}>
          <AppWordmark />
        </Link>

        {status === 'authenticated' && !IS_LOCAL && (
          <div className="hidden lg:block">
            <SyncIndicator />
          </div>
        )}

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {status === 'authenticated' ? (
            links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={desktopNavClass}>
                {l.label}
                {l.badge ? <Badge count={l.badge} /> : null}
              </NavLink>
            ))
          ) : (
            <>
              <NavLink to="/login" className={desktopNavClass}>
                Log in
              </NavLink>
              <Link to="/signup" className="btn-primary">
                Sign up
              </Link>
            </>
          )}
        </nav>
        <div className="hidden lg:block">
          <ThemeToggle />
        </div>

        <button
          type="button"
          className="btn-ghost lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
        >
          <MenuIcon width={24} height={24} />
        </button>
      </div>

      {/* Portal: the header's backdrop blur would otherwise trap the fixed-position drawer inside it. */}
      {open && createPortal(<MobileMenu links={links} onClose={() => setOpen(false)} />, document.body)}
    </header>
  );
}

const rowClass =
  'flex min-h-touch items-center gap-3 px-3 text-[15px] font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800';
const activeRowClass = 'flex min-h-touch items-center gap-3 bg-brand-50 px-3 text-[15px] font-medium text-brand-700 dark:bg-slate-800 dark:text-white';

/** A group of rows in one rounded card. */
function MenuGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
      {children}
    </ul>
  );
}

function MenuLink({ to, end, label, Icon, badge }: { to: string; end?: boolean; label: string; Icon: IconType; badge?: number }) {
  return (
    <li>
      <NavLink to={to} end={end} className={({ isActive }) => (isActive ? activeRowClass : rowClass)}>
        <Icon className="shrink-0 text-slate-400" width={18} height={18} />
        <span className="flex-1">{label}</span>
        {badge ? <Badge count={badge} /> : null}
        <ChevronRightIcon className="text-slate-300 dark:text-slate-600" width={16} height={16} />
      </NavLink>
    </li>
  );
}

/** Small red counter (e.g. pending invitations). */
function Badge({ count }: { count: number }) {
  return (
    <span className="ml-1 inline-flex min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold leading-5 text-white">
      {count}
      <span className="sr-only"> new</span>
    </span>
  );
}

/** Phone/tablet menu: profile, pages, theme, help & legal, then a one-line company credit. */
function MobileMenu({ links, onClose }: { links: NavItem[]; onClose: () => void }) {
  const { user, logout } = useAuth();
  const { sync } = useTasks();
  const navigate = useNavigate();
  const panel = useRef<HTMLDivElement>(null);
  useDialog(panel, onClose, 'button[data-close]');

  const onLogout = async () => {
    if (
      sync.pending > 0 &&
      !window.confirm(`You have ${sync.pending} change(s) that haven't synced yet. Log out anyway and lose them?`)
    ) {
      return;
    }
    onClose();
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        tabIndex={-1}
        className="safe-top safe-bottom absolute inset-y-0 right-0 flex w-[84%] max-w-xs flex-col bg-slate-50 shadow-2xl dark:bg-slate-950"
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-white py-1.5 pl-4 pr-2 dark:border-slate-800 dark:bg-slate-900">
          <AppWordmark size={28} />
          <button type="button" data-close className="btn-ghost" aria-label="Close menu" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3 [&>*]:shrink-0">
          {user ? (
            <ProfileCard name={user.name} email={user.email} />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link to="/signup" className="btn-primary px-2 text-sm">
                Sign up free
              </Link>
              <Link to="/login" className="btn-secondary px-2 text-sm">
                Log in
              </Link>
            </div>
          )}

          {links.length > 0 && (
            <MenuGroup label="Pages">
              {links.map((l) => (
                <MenuLink key={l.to} {...l} />
              ))}
            </MenuGroup>
          )}

          <div className="card flex items-center justify-between gap-2 py-1 pl-3 pr-1">
            <span className="text-[15px] font-medium text-slate-700 dark:text-slate-200">Theme</span>
            <ThemeToggle />
          </div>

          <MenuGroup label="Help and legal">
            <MenuLink to="/support" label="Help & Support" Icon={HelpIcon} />
            <MenuLink to="/privacy" label="Privacy Policy" Icon={ShieldIcon} />
            <MenuLink to="/terms" label="Terms of Service" Icon={FileTextIcon} />
            <li>
              <a href={AUTHOR_SITE_URL} target="_blank" rel="noopener noreferrer" className={rowClass}>
                <GlobeIcon className="shrink-0 text-slate-400" width={18} height={18} />
                <span className="flex-1">{AUTHOR_SITE_LABEL}</span>
                <ExternalIcon className="text-slate-300 dark:text-slate-600" width={16} height={16} />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
            {user && !IS_LOCAL && (
              <li>
                <button
                  type="button"
                  onClick={() => void onLogout()}
                  className="flex min-h-touch w-full items-center gap-3 px-3 text-[15px] font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  <LogoutIcon className="shrink-0" width={18} height={18} />
                  Log out
                </button>
              </li>
            )}
          </MenuGroup>

          <div className="mt-auto pt-2 text-center text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
            <AuthorLine />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact profile: avatar, name, email and a one-line sync status with a sync button. */
function ProfileCard({ name, email }: { name: string; email: string }) {
  const { store, sync } = useTasks();
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || '?';

  const busy = sync.status === 'syncing';
  const plural = (n: number) => `${n} change${n > 1 ? 's' : ''}`;
  const label =
    sync.status === 'syncing'
      ? 'Syncing…'
      : sync.status === 'offline'
        ? sync.pending
          ? `Offline · ${plural(sync.pending)} waiting`
          : 'Offline'
        : sync.status === 'error'
          ? 'Sync problem'
          : sync.pending
            ? `${plural(sync.pending)} to sync`
            : 'All synced';
  const tone =
    sync.status === 'offline'
      ? 'text-amber-700 dark:text-amber-400'
      : sync.status === 'error'
        ? 'text-red-600 dark:text-red-400'
        : 'text-success-600 dark:text-success-500';

  return (
    <div className="card flex items-center gap-3 py-2.5 pl-3 pr-1">
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-900 text-sm font-bold text-white"
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[15px] font-semibold">{name}</p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{IS_LOCAL ? 'Saved on this device' : email}</p>
        {store && !IS_LOCAL && (
          <p
            className={`mt-0.5 flex items-center gap-1 text-xs font-medium ${tone}`}
            aria-live="polite"
            title={sync.lastSyncedAt ? `Last synced ${new Date(sync.lastSyncedAt).toLocaleString()}` : undefined}
          >
            {sync.status === 'offline' || sync.status === 'error' ? (
              <CloudOffIcon width={13} height={13} />
            ) : (
              <CloudIcon width={13} height={13} />
            )}
            {label}
          </p>
        )}
      </div>
      {store && !IS_LOCAL && (
        <button
          type="button"
          className="btn-ghost min-h-touch min-w-touch shrink-0"
          disabled={busy}
          onClick={() => void store.syncNow()}
          aria-label="Sync now"
          title="Sync now"
        >
          {busy ? <Spinner className="h-4 w-4" label="Syncing" /> : <RefreshIcon width={18} height={18} />}
        </button>
      )}
    </div>
  );
}
