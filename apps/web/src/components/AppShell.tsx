import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode, RefObject } from 'react';
import { todayInTimeZone } from '@form/domain';
import { useEffect, useState } from 'react';
import { useForm } from '../context';

const navItems = [
  { to: '/today', label: 'היום', icon: '⌂' },
  { to: `/nutrition/${todayInTimeZone('Asia/Jerusalem')}`, label: 'תזונה', icon: '☕' },
  { to: '/progress', label: 'התקדמות', icon: '↗' },
  { to: '/coach', label: 'המלצות', icon: '✦' },
  { to: '/settings', label: 'הגדרות', icon: '⚙' }
];

function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return online;
}

export function AppShell({ children, headingRef }: { children: ReactNode; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const navigate = useNavigate();
  const { theme, setTheme } = useForm();
  const online = useOnlineStatus();
  const today = todayInTimeZone('Asia/Jerusalem');
  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">דלג לתוכן</a>
      <nav className="side-nav" aria-label="ניווט ראשי">
        <h1 className="brand">FORM<small>.</small></h1>
        <div className="side-subtitle">Personal body intelligence</div>
        <div className="side-links">
          {navItems.map((item) => <NavLink key={item.to} to={item.to} aria-label={item.label}><span aria-hidden>{item.icon}</span>{item.label}</NavLink>)}
          <NavLink to={`/check-in/${today}`}><span aria-hidden>✓</span>צ׳ק-אין</NavLink>
        </div>
        <button className="secondary-button" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'ערכת צבעים בהירה' : 'ערכת צבעים כהה'}</button>
        <div className="side-footer">נשמר מקומית במכשיר · אין סנכרון ענן ב־P0</div>
      </nav>
      <main id="content" className="main-content" tabIndex={-1}>
        <div className="topbar topbar-mobile-only">
          {!online ? <span className="pill warn" role="status">לא מחובר — נשמר מקומית</span> : null}
          <button className="icon-button" type="button" aria-label="החלפת ערכת צבעים" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀' : '☾'}</button>
          <h1 className="brand">FORM<small>.</small></h1>
        </div>
        {!online ? <div className="notice warn offline-notice" role="status">אין חיבור כרגע. ניתן להמשיך לרשום; הנתונים נשארים במכשיר.</div> : null}
        {children}
      </main>
      <nav className="mobile-nav" aria-label="ניווט תחתון">
        <NavLink to="/today"><span aria-hidden>⌂</span>היום</NavLink>
        <NavLink to="/progress"><span aria-hidden>↗</span>התקדמות</NavLink>
        <button className="mobile-add" type="button" aria-label="הוספת אוכל" onClick={() => void navigate(`/nutrition/${today}?add=1`)}><span aria-hidden>+</span></button>
        <NavLink to={`/nutrition/${today}`}><span aria-hidden>☕</span>תזונה</NavLink>
        <NavLink to="/settings"><span aria-hidden>⚙</span>עוד</NavLink>
      </nav>
      <span className="sr-only" ref={headingRef as RefObject<HTMLSpanElement>} tabIndex={-1} />
    </div>
  );
}
