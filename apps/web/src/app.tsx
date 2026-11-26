import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useRef, type ReactElement } from 'react';
import { useForm } from './context';
import { AppShell } from './components/AppShell';
import { OnboardingScreen } from './screens/Onboarding';
import { TodayScreen } from './screens/Today';
import { NutritionScreen } from './screens/Nutrition';
import { ProgressScreen } from './screens/Progress';
import { CheckInScreen } from './screens/CheckIn';
import { CoachScreen } from './screens/Coach';
import { SettingsScreen } from './screens/Settings';

export function App() {
  const { ready, needsOnboarding, announce, storageError } = useForm();
  const location = useLocation();
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [location.pathname]);

  if (!ready) {
    return <main className="boot" aria-live="polite"><h1>FORM.</h1><p>טוען נתונים…</p></main>;
  }

  const shell = (element: ReactElement) => <AppShell headingRef={headingRef}>{element}</AppShell>;

  return (
    <>
      <div className="sr-only" aria-live="polite">{announce}</div>
      {storageError ? <div className="notice danger storage-error" role="alert">{storageError}</div> : null}
      <Routes>
        <Route path="/onboarding" element={<OnboardingScreen />} />
        <Route path="/today" element={needsOnboarding ? <Navigate to="/onboarding" replace /> : shell(<TodayScreen />)} />
        <Route path="/nutrition/:date" element={needsOnboarding ? <Navigate to="/onboarding" replace /> : shell(<NutritionScreen />)} />
        <Route path="/progress" element={needsOnboarding ? <Navigate to="/onboarding" replace /> : shell(<ProgressScreen />)} />
        <Route path="/check-in/:date" element={needsOnboarding ? <Navigate to="/onboarding" replace /> : shell(<CheckInScreen />)} />
        <Route path="/coach" element={needsOnboarding ? <Navigate to="/onboarding" replace /> : shell(<CoachScreen />)} />
        <Route path="/settings" element={needsOnboarding ? <Navigate to="/onboarding" replace /> : shell(<SettingsScreen />)} />
        <Route path="*" element={<Navigate to={needsOnboarding ? '/onboarding' : '/today'} replace />} />
      </Routes>
    </>
  );
}
