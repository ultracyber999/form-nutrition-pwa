import type { ReactNode } from 'react';
import { addDays } from '@form/domain';
import { fmt } from '../utils';

export function PageHeader({ kicker, title, subtitle, headingRef }: { kicker: string; title: string; subtitle?: string; headingRef?: React.RefObject<HTMLHeadingElement | null> }) {
  return (
    <div className="page-heading">
      <p className="route-kicker">{kicker}</p>
      <h2 className="page-title" ref={headingRef} tabIndex={-1}>{title}</h2>
      {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function DateNavigator({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  return (
    <div className="date-nav" aria-label="ניווט תאריך">
      <button className="icon-button" type="button" aria-label="היום הקודם" onClick={() => onChange(addDays(date, -1))}>‹</button>
      <label className="sr-only" htmlFor="selected-date">תאריך נבחר</label>
      <input id="selected-date" className="date-text input" type="date" value={date} onChange={(event) => onChange(event.target.value)} />
      <button className="icon-button" type="button" aria-label="היום הבא" onClick={() => onChange(addDays(date, 1))}>›</button>
    </div>
  );
}

export function MetricTile({ label, value, unit, context, icon, digits = 0 }: { label: string; value: number | null; unit?: string; context?: string; icon?: string; digits?: number }) {
  return (
    <Card className="metric-tile">
      <div className="metric-label"><span>{label}</span>{icon ? <span aria-hidden>{icon}</span> : null}</div>
      <div className="metric-value">{fmt(value, digits)}{unit ? <small> {unit}</small> : null}</div>
      <div className="metric-context">{context ?? ''}</div>
    </Card>
  );
}

export function MacroBar({ label, consumed, target, className, unit = 'ג׳', incomplete = false }: { label: string; consumed: number; target: number | null; className: string; unit?: string; incomplete?: boolean }) {
  const ratio = target && target > 0 ? consumed / target : 0;
  return (
    <div className="macro-row">
      <header><span>{label}</span><bdi className="num">{fmt(consumed, 1)}{incomplete ? '+' : ''} / {target === null ? '—' : fmt(target)} {unit}</bdi></header>
      <div className="progress-track" role="img" aria-label={`סיכום ${label}: ${fmt(consumed, 1)}${incomplete ? ' לפחות' : ''} מתוך ${target === null ? 'לא ידוע' : fmt(target)} גרם`}>
        <div className={`progress-fill ${className}`} style={{ inlineSize: `${Math.min(100, ratio * 100)}%` }} />
      </div>
    </div>
  );
}

export function CalorieRing({ consumed, target, incomplete }: { consumed: number; target: number; incomplete: boolean }) {
  const remaining = target - consumed;
  const ratio = target > 0 ? consumed / target : 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="ring-wrap" role="img" aria-label={remaining < 0 ? `חריגה של ${incomplete ? 'לפחות ' : ''}${fmt(Math.abs(remaining))} קלוריות מעל יעד ${fmt(target)}${incomplete ? '; הערכה חלקית' : ''}` : incomplete ? `נותרו לכל היותר ${fmt(remaining)} קלוריות מתוך יעד ${fmt(target)}; הערכה חלקית` : `נותרו ${fmt(remaining)} קלוריות מתוך יעד ${fmt(target)}`}>
      <svg viewBox="0 0 132 132" aria-hidden>
        <circle cx="66" cy="66" r={radius} fill="none" stroke="var(--ring-track)" strokeWidth="11" />
        <circle className="ring-progress" cx="66" cy="66" r={radius} fill="none" stroke={remaining < 0 ? 'var(--warning)' : 'var(--accent)'} strokeWidth="11" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - Math.min(1, ratio))} />
      </svg>
      <div className="ring-center"><small className="ring-kicker">{remaining < 0 ? (incomplete ? 'חריגה של לפחות' : 'חריגה') : incomplete ? 'נותרו לכל היותר' : 'נותרו'}</small><strong className="num">{incomplete ? (remaining >= 0 ? '≤' : '≥') : ''}{fmt(Math.abs(remaining))}</strong><small>{remaining < 0 ? 'קל׳ מעל היעד' : incomplete ? 'קל׳ · הערכה חלקית' : 'קל׳ לפי הרישום'}</small><small className="ring-target num">נצרכו {fmt(consumed)}{incomplete ? '+' : ''} מתוך {fmt(target)}</small></div>
    </div>
  );
}

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return <div className="empty-state"><p>{title}</p>{action}</div>;
}
