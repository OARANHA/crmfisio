const TRACE =
  'M0 60 H110 L128 60 L140 34 L152 84 L164 60 H200 Q214 48 228 60 H330 L348 60 L360 30 L372 88 L384 60 H420 Q434 50 448 60 H550 L568 60 L580 34 L592 84 L604 60 H640 Q654 48 668 60 H770 L788 60 L800 30 L812 88 L824 60 H860 Q874 50 888 60 H1000';

export function Ecg({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true">
      <path d={TRACE} pathLength={1000} className="ecg-base" fill="none" />
      <path d={TRACE} pathLength={1000} className="ecg-run" fill="none" />
    </svg>
  );
}

export function PulseMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M14 21.5C7.5 17 4 13.3 4 9.4 4 6.6 6.1 4.5 8.7 4.5c1.7 0 3.4.9 4.3 2.3.4.6 1.6.6 2 0 .9-1.4 2.6-2.3 4.3-2.3 2.6 0 4.7 2.1 4.7 4.9 0 3.9-3.5 7.6-10 12.1Z"
        stroke="#4fd1a5" strokeWidth="1.8" strokeLinejoin="round"
      />
      <path d="M6.5 12h4l1.5-3 2.5 6 2-4.5 1 1.5h4" stroke="#f2545b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
