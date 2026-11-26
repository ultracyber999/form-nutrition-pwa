import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode, RefObject } from 'react';
import { todayInTimeZone } from '@form/domain';
import { useEffect, useState } from 'react';
import { useForm } from '../context';

type NavGlyph = 'today' | 'nutrition' | 'progress' | 'coach' | 'settings' | 'checkin' | 'sun' | 'moon';
function NavIcon({ name }: { name: NavGlyph }) {
  const paths: Record<NavGlyph, string> = {
    today: 'M3 10 12 3l9 7v10h-6v-6H9v6H3z',
    nutrition: 'M4 3v7c0 2 4 2 4 0V3M6 3v18M19 3c-3 2-4 5-4 9h4m0-9v18',
    progress: 'M3 19h18M4 15l6-6 4 4 6-8M16 5h4v4',
    coach: 'M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z',
    settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
    checkin: 'M5 4h14v17H5zM9 3h6v3H9zM8 13l2 2 5-5',
    sun: 'M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    moon: 'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11z'
  };
  return <svg className="nav-glyph" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

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
  const { theme, setTheme, timezone } = useForm();
  const online = useOnlineStatus();
  const today = todayInTimeZone(timezone);
  const navItems = [
    { to: '/today', label: 'היום', icon: 'today' as const },
    { to: `/nutrition/${today}`, label: 'תזונה', icon: 'nutrition' as const },
    { to: '/progress', label: 'התקדמות', icon: 'progress' as const },
    { to: '/coach', label: 'המלצות', icon: 'coach' as const },
    { to: '/settings', label: 'הגדרות', icon: 'settings' as const }
  ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">דלג לתוכן</a>
      <nav className="side-nav" aria-label="ניווט ראשי">
        <h1 className="brand">FORM<small>.</small></h1>
        <div className="side-subtitle">Personal body intelligence</div>
        <div className="side-links">
          {navItems.map((item) => <NavLink key={item.to} to={item.to} aria-label={item.label}><NavIcon name={item.icon}/>{item.label}</NavLink>)}
          <NavLink to={`/check-in/${today}`}><NavIcon name="checkin"/>צ׳ק-אין</NavLink>
        </div>
        <button className="secondary-button" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'ערכת צבעים בהירה' : 'ערכת צבעים כהה'}</button>
        <div className="side-footer">נשמר מקומית במכשיר · אין סנכרון ענן</div>
      </nav>
      <main id="content" className="main-content" tabIndex={-1}>
        <div className="topbar topbar-mobile-only">
          <h1 className="brand">FORM<small>.</small></h1>
          {!online ? <span className="pill warn" role="status">לא מחובר — נשמר מקומית</span> : null}
          <button className="icon-button" type="button" aria-label="החלפת ערכת צבעים" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><NavIcon name={theme === 'dark' ? 'sun' : 'moon'}/></button>
        </div>
        {!online ? <div className="notice warn offline-notice" role="status">אין חיבור כרגע. ניתן להמשיך לרשום; הנתונים נשארים במכשיר.</div> : null}
        {children}
      </main>
      <nav className="mobile-nav" aria-label="ניווט תחתון">
        <NavLink to="/today"><NavIcon name="today"/>היום</NavLink>
        <NavLink to="/progress"><NavIcon name="progress"/>התקדמות</NavLink>
        <button className="mobile-add" type="button" aria-label="הוספת אוכל" onClick={() => void navigate(`/nutrition/${today}?add=1`)}><span aria-hidden>+</span></button>
        <NavLink to={`/nutrition/${today}`}><NavIcon name="nutrition"/>תזונה</NavLink>
        <NavLink to="/settings"><NavIcon name="settings"/>עוד</NavLink>
      </nav>
      <span className="sr-only" ref={headingRef as RefObject<HTMLSpanElement>} tabIndex={-1} />
    </div>
  );
}
