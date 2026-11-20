import { Link } from 'react-router-dom';

export function Flame({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2c1.5 4 5.5 6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.4 1.2-3.9 2.4-5 .2 1.7 1 2.8 2.1 3.3C10.4 8 11 5 12 2Z" fill="var(--accent)" />
      <path d="M12 12.5c.8 1.4 2.3 2.1 2.3 3.9a2.3 2.3 0 0 1-4.6 0c0-1.3.9-2.4 2.3-3.9Z" fill="var(--bg)" opacity=".85" />
    </svg>
  );
}

export function Wordmark({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="wordmark" aria-label="Ember home">
      <Flame />
      <span>EMBER</span>
    </Link>
  );
}
