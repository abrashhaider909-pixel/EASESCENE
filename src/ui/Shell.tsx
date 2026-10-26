import React, { useEffect, useRef, useState } from 'react';
import { Info, Bell, LogOut, User, Users, FileText, ShieldCheck, Inbox as InboxIcon, ListChecks, Menu, X, Smartphone } from 'lucide-react';
import { useStore } from '../lib/store';
import { Avatar, Logo, cx, timeAgo } from './kit';
import { navigate } from './router';
import { Assistant } from './Assistant';

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void) {
  useEffect(() => {
    const on = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    };
    document.addEventListener('mousedown', on);
    return () => document.removeEventListener('mousedown', on);
  }, [ref, onOut]);
}

export function NotificationBell({ dark = false }: { dark?: boolean }) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const mine = s.notifications.filter(n => n.userId === s.currentUser.id).slice(0, 12);
  const unread = mine.filter(n => !n.read).length;

  const openItem = (id: string, ref?: string) => {
    s.markNotificationAsRead(id);
    setOpen(false);
    if (!ref) return;
    const app = s.applications.find(a => a.referenceNumber === ref);
    if (!app) return;
    if (s.currentUser.role === 'student') navigate(app.status === 'completed' ? `/requests/${app.id}/document` : `/requests/${app.id}`);
    else if (s.currentUser.role === 'staff') navigate(`/inbox/${app.id}`);
    else navigate(`/admin/requests?q=${encodeURIComponent(ref)}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        onClick={() => setOpen(o => !o)}
        className={cx('relative w-11 h-11 inline-flex items-center justify-center rounded-full', dark ? 'text-white hover:bg-white/10' : 'hover:bg-mist')}
      >
        <Bell size={20} />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-cyan text-ink text-[11px] font-extrabold inline-flex items-center justify-center">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(380px,calc(100vw-24px))] bg-white text-ink border border-line rounded-[14px] shadow-xl z-40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="font-extrabold">Notifications</p>
            {unread > 0 && (
              <button className="text-sm font-bold text-teal" onClick={() => s.markAllNotificationsAsRead(s.currentUser.id)}>
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] overflow-auto">
            {mine.length === 0 && <li className="px-4 py-8 text-center text-mauve">You’re all caught up.</li>}
            {mine.map(n => (
              <li key={n.id}>
                <button onClick={() => openItem(n.id, n.applicationRef)} className={cx('w-full text-left px-4 py-3 border-b border-mist hover:bg-paper flex gap-3', !n.read && 'bg-skylight/60')}>
                  <span className={cx('mt-1.5 w-2 h-2 rounded-full shrink-0', n.read ? 'bg-transparent' : 'bg-cyan')} />
                  <span className="min-w-0">
                    <span className="block font-bold text-[15px]">{n.title}</span>
                    <span className="block text-sm text-mauve">{n.message}</span>
                    <span className="block text-xs text-mauve mt-1">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const me = s.currentUser;
  const sub = me.role === 'student' ? `CMS ${me.registrationNumber}` : me.designation;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} className="flex items-center gap-3 rounded-full pl-1 pr-2 py-1 hover:bg-mist">
        <Avatar name={me.name} size={40} tone={me.role === 'student' ? 'cyan' : 'ink'} />
        <span className="hidden md:block text-left leading-tight">
          <span className="block font-bold">{me.name}</span>
          <span className="block text-sm text-mauve">{sub}</span>
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-56 bg-white border border-line rounded-[12px] shadow-xl z-40 py-1.5">
          <button role="menuitem" className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-paper font-semibold" onClick={() => { setOpen(false); navigate('/profile'); }}>
            <User size={17} /> Profile & settings
          </button>
          <button role="menuitem" className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-paper font-semibold" onClick={() => { setOpen(false); navigate('/about'); }}>
            <Info size={17} /> About EzScene
          </button>
          <button
            role="menuitem"
            className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-paper font-semibold text-bad"
            onClick={() => {
              s.logout();
              navigate('/login', true);
            }}
          >
            <LogOut size={17} /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

export function TopShell({ active, children }: { active: string; children: React.ReactNode }) {
  const s = useStore();
  const me = s.currentUser;
  const inboxCount = s.applications.filter(a => {
    const st = a.stageInstances[a.currentStageIndex];
    return me.role === 'staff' && st?.status === 'in_progress' && st.assignedStaffId === me.id && ['pending_signature', 'pending_approval', 'under_verification', 'overdue', 'submitted'].includes(a.status);
  }).length;
  const tabs =
    me.role === 'student'
      ? [
          { id: 'new', label: 'New application', to: '/new' },
          { id: 'requests', label: 'My requests', to: '/requests' },
          { id: 'profile', label: 'Profile', to: '/profile' }
        ]
      : [
          { id: 'inbox', label: 'Inbox', to: '/inbox', count: inboxCount },
          { id: 'signed', label: 'Signed', to: '/signed' },
          { id: 'rejected', label: 'Rejected', to: '/rejected' },
          { id: 'profile', label: 'Profile', to: '/profile' }
        ];
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-line sticky top-0 z-30">
        <div className="flex items-center gap-3 sm:gap-6 px-4 sm:px-10 h-[68px]">
          <Logo className="text-[26px] shrink-0" onClick={() => navigate(me.role === 'student' ? '/new' : '/inbox')} />
          <nav aria-label="Main" className="flex-1 min-w-0 overflow-x-auto">
            <ul className="flex items-center gap-1 sm:gap-2 w-max">
              {tabs.map(t => (
                <li key={t.id}>
                  <a
                    href={`#${t.to}`}
                    aria-current={active === t.id ? 'page' : undefined}
                    className={cx('inline-flex items-center gap-2 min-h-11 px-3 rounded-[6px] text-[15px] sm:text-[16px] font-bold no-underline whitespace-nowrap', active === t.id ? 'bg-ink text-cyan' : 'text-ink hover:bg-mist')}
                  >
                    {t.label}
                    {'count' in t && t.count ? <span className="min-w-6 h-6 px-1.5 rounded-full bg-cyan text-ink text-[13px] inline-flex items-center justify-center">{t.count}</span> : null}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center gap-1 shrink-0">
            {me.role === 'staff' && (
              <a href="#/review" aria-label="Phone review mode" className="md:hidden w-11 h-11 inline-flex items-center justify-center rounded-full hover:bg-mist">
                <Smartphone size={20} />
              </a>
            )}
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <Assistant />
    </div>
  );
}

const ADMIN_NAV = [
  { id: 'designations', label: 'Designations', to: '/admin/designations', icon: Users },
  { id: 'templates', label: 'Templates', to: '/admin/templates', icon: FileText },
  { id: 'audit', label: 'Audit log', to: '/admin/audit', icon: ShieldCheck },
  { id: 'users', label: 'User accounts', to: '/admin/users', icon: User },
  { id: 'requests', label: 'All requests', to: '/admin/requests', icon: ListChecks },
  { id: 'about', label: 'About & demo reset', to: '/about', icon: Info }
];

export function AdminShell({ active, children }: { active: string; children: React.ReactNode }) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const nav = (
    <ul className="flex flex-col gap-1.5">
      {ADMIN_NAV.map(n => (
        <li key={n.id}>
          <a
            href={`#${n.to}`}
            onClick={() => setOpen(false)}
            aria-current={active === n.id ? 'page' : undefined}
            className={cx('flex items-center gap-3 min-h-11 px-3 rounded-[8px] text-[16px] font-bold no-underline', active === n.id ? 'bg-cyan text-ink' : 'text-white hover:bg-white/10')}
          >
            <n.icon size={19} /> {n.label}
          </a>
        </li>
      ))}
    </ul>
  );
  const footer = (
    <div className="rounded-[10px] bg-[#1f1f1f] p-3 flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm truncate">{s.currentUser.name}</p>
        <p className="text-white/60 text-xs">Administrator</p>
      </div>
      <NotificationBell dark />
      <button
        aria-label="Log out"
        className="w-10 h-10 inline-flex items-center justify-center rounded-full text-white hover:bg-white/10"
        onClick={() => {
          s.logout();
          navigate('/login', true);
        }}
      >
        <LogOut size={18} />
      </button>
    </div>
  );
  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden lg:flex flex-col justify-between w-[221px] shrink-0 bg-ink px-4 py-6 sticky top-0 h-screen">
        <div>
          <div className="px-2 mb-6">
            <Logo light className="text-[28px] block" onClick={() => navigate('/admin/designations')} />
            <p className="text-[12px] font-extrabold tracking-[0.12em] text-white/70">ADMIN CONSOLE</p>
          </div>
          {nav}
        </div>
        {footer}
      </aside>
      <header className="lg:hidden bg-ink flex items-center justify-between px-4 h-16 sticky top-0 z-30">
        <div className="flex items-baseline gap-2">
          <Logo light className="text-[24px]" onClick={() => navigate('/admin/designations')} />
          <span className="text-[11px] font-extrabold tracking-[0.12em] text-white/70">ADMIN</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell dark />
          <button aria-label="Menu" onClick={() => setOpen(o => !o)} className="w-11 h-11 inline-flex items-center justify-center text-white rounded-full hover:bg-white/10">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>
      {open && (
        <div className="lg:hidden bg-ink px-4 pb-4 sticky top-16 z-30 flex flex-col gap-4">
          {nav}
          {footer}
        </div>
      )}
      <main className="flex-1 min-w-0 px-4 sm:px-10 py-8 sm:py-9">{children}</main>
    </div>
  );
}

export { InboxIcon };
