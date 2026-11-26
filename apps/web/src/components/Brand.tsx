export function Brand({ tagline = false }: { tagline?: boolean }) {
  return <div className="brand-lockup" dir="ltr">
    <h1 className="brand" aria-label="NIVNE"><svg className="brand-mark" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="112" fill="var(--brand-ink)"/><path d="M116 380V132H172L340 300V132H396V380H340L172 212V380Z" fill="var(--brand-lime)"/></svg><span>NIVNE<small>.</small></span></h1>
    {tagline ? <span className="brand-tagline">BUILT FROM WITHIN.</span> : null}
  </div>;
}
