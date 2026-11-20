import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { useLiveClock } from './data/useLiveData';
import Landing from './pages/Landing';

const Live = lazy(() => import('./pages/Live'));

function Loading() {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
      <span className="eyebrow">Loading live map…</span>
    </div>
  );
}

export default function App() {
  useLiveClock();
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/live" element={<Live />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </MotionConfig>
  );
}
