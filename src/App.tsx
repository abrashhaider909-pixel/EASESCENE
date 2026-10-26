import { useEffect, useState } from 'react';
import { useStore, EzStore } from './lib/store';
import { useRoute, navigate } from './ui/router';
import { Toaster } from './ui/kit';
import { Landing } from './screens/Landing';
import { Login, Signup, ResetPassword, homeFor } from './screens/Auth';
import { Verify } from './screens/Verify';
import { About } from './screens/About';
import { Profile } from './screens/Profile';
import { NewApplication } from './screens/student/NewApplication';
import { FormFill } from './screens/student/FormFill';
import { ApprovalChain } from './screens/student/ApprovalChain';
import { MyRequests } from './screens/student/MyRequests';
import { ApprovedDocument } from './screens/student/ApprovedDocument';
import { Inbox } from './screens/faculty/Inbox';
import { MobileReview } from './screens/faculty/MobileReview';
import { SignatureOnboarding, ApprovalModeChooser } from './screens/faculty/Onboarding';
import { Designations } from './screens/admin/Designations';
import { Templates } from './screens/admin/Templates';
import { AuditLog } from './screens/admin/AuditLog';
import { Users } from './screens/admin/Users';
import { Requests } from './screens/admin/Requests';
import { UserProfile } from './types';

// Restore "keep me logged in" before the first render.
EzStore.restoreSession();

function useIsPhone() {
  const q = '(max-width: 767px)';
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setPhone(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return phone;
}

function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, true), [to]);
  return null;
}

const PUBLIC = new Set(['', 'login', 'signup', 'reset', 'verify', 'about']);
const ROLE_ROUTES: Record<UserProfile['role'], string[]> = {
  student: ['new', 'requests', 'profile'],
  staff: ['inbox', 'signed', 'rejected', 'review', 'onboarding', 'profile'],
  admin: ['admin']
};

function Routes() {
  const s = useStore();
  const { parts, query } = useRoute();
  const phone = useIsPhone();
  const head = parts[0] || '';
  const me = s.currentUser;

  useEffect(() => {
    const titles: Record<string, string> = { '': 'Home', login: 'Log in', signup: 'Create account', reset: 'Reset password', verify: 'Verify a document', about: 'About', new: 'New application', requests: 'My requests', profile: 'Profile & settings', inbox: 'Inbox', signed: 'Signed', rejected: 'Rejected', review: 'Review requests', onboarding: 'Set up', admin: 'Admin' };
    document.title = `EzScene — ${titles[head] || 'EzScene'}`;
  }, [head]);

  if (PUBLIC.has(head)) {
    if (head === '') return <Landing />;
    if (head === 'verify') return <Verify code={parts[1]} />;
    if (head === 'about') return <About />;
    if (s.isAuthenticated && (head === 'login' || head === 'signup')) return <Redirect to={homeFor(me)} />;
    if (head === 'login') return <Login />;
    if (head === 'signup') return <Signup />;
    return <ResetPassword />;
  }

  if (!s.isAuthenticated) return <Redirect to={`/login${head === 'requests' ? '?role=student&next=requests' : ''}`} />;
  if (!ROLE_ROUTES[me.role].includes(head)) return <Redirect to={homeFor(me)} />;

  if (me.role === 'student') {
    if (head === 'profile') return <Profile />;
    if (head === 'new') {
      if (parts[1] === 'form' && parts[2]) return <FormFill key={`${parts[2]}${query.get('draft') || ''}${query.get('resubmit') || ''}`} typeId={parts[2]} draftId={query.get('draft') || undefined} resubmitId={query.get('resubmit') || undefined} />;
      if (parts[1] === 'chain') return <ApprovalChain />;
      return <NewApplication />;
    }
    if (parts[1] && parts[2] === 'document') return <ApprovedDocument id={parts[1]} />;
    return <MyRequests selectedId={parts[1]} />;
  }

  if (me.role === 'staff') {
    if (head === 'profile') return <Profile />;
    if (head === 'onboarding') return parts[1] === 'mode' ? <ApprovalModeChooser /> : <SignatureOnboarding />;
    if (head === 'review' || (head === 'inbox' && phone)) return <MobileReview />;
    return <Inbox tab={head as 'inbox' | 'signed' | 'rejected'} selectedId={parts[1]} />;
  }

  switch (parts[1]) {
    case 'templates':
      return <Templates />;
    case 'audit':
      return <AuditLog />;
    case 'users':
      return <Users />;
    case 'requests':
      return <Requests />;
    default:
      return <Designations />;
  }
}

export default function App() {
  return (
    <>
      <Routes />
      <Toaster />
    </>
  );
}
