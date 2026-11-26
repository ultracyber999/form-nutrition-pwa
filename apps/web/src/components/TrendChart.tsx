import { useMemo, useState } from 'react';
import type { DailyWeightPoint } from '@form/domain';
import { fmt, shortDateLabel } from '../utils';
import { buildTrendGeometry } from '../trendGeometry';

export function TrendChart({ points, unit, label }: { points: DailyWeightPoint[]; unit: string; label: string }) {
  const [table, setTable] = useState(false);
  const geometry = useMemo(() => buildTrendGeometry(points), [points]);

  if (points.length === 0) return <div className="empty-state">אין מספיק מדידות להצגת גרף. מוצגות רק מדידות בפועל, ללא ערכים מומצאים.</div>;
  return (
    <div>
      <div className="split" style={{ marginBlockEnd: 10 }}>
        <span className="pill">נקודות בפועל · פערים גלויים</span>
        <button className="secondary-button" type="button" onClick={() => setTable((value) => !value)}>{table ? 'הצגת גרף' : 'הצגת טבלה'}</button>
      </div>
      {table ? (
        <div className="table-wrap" tabIndex={0} aria-label={`טבלת ${label}`}>
          <table><thead><tr><th>תאריך</th><th>{label}</th><th>מקור</th></tr></thead><tbody>{points.map((point) => <tr key={point.measurementId}><td>{shortDateLabel(point.localDate)}</td><td><bdi className="num">{fmt(point.valueKg, 1)} {unit}</bdi></td><td>{point.source}</td></tr>)}</tbody></table>
        </div>
      ) : geometry ? (
        <div className="chart-wrap">
          <svg className="chart-svg" viewBox={`0 0 ${geometry.width} ${geometry.height}`} role="img" aria-label={`${label}: ${points.length} נקודות, ערך אחרון ${fmt(points.at(-1)?.valueKg ?? null, 1)} ${unit}`}>
            {[0.25, 0.5, 0.75].map((ratio) => <line key={ratio} className="chart-grid" x1={geometry.pad} x2={geometry.width - geometry.pad} y1={geometry.height * ratio} y2={geometry.height * ratio} />)}
            <defs><linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".34" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
            {geometry.areaPaths.map((path) => <path key={path} className="chart-area" d={path} />)}
            {geometry.segments.map((segment) => <path key={segment.join(' ')} className="chart-line" d={segment.join(' ')} />)}
            {points.map((point) => <circle key={point.measurementId} className="chart-point" cx={geometry.xForDate(point.localDate)} cy={geometry.y(point.valueKg)} r="4" />)}
            {points.map((point, index) => index === 0 || index === points.length - 1 ? <text key={`label-${point.measurementId}`} className="chart-label" x={geometry.xForDate(point.localDate)} y={geometry.height - 5} textAnchor="middle">{shortDateLabel(point.localDate).slice(0, 5)}</text> : null)}
            <text className="chart-label chart-last-value" x={geometry.width - geometry.pad} y={geometry.y(points.at(-1)?.valueKg ?? 0) - 10} textAnchor="end">{fmt(points.at(-1)?.valueKg ?? null, 1)} {unit}</text>
          </svg>
        </div>
      ) : null}
    </div>
  );
}
