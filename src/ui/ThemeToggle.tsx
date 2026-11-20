import { Monitor, Moon, Sun } from 'lucide-react';
import { setThemePref, useThemePref, type ThemePref } from '../theme';

const OPTS: { v: ThemePref; icon: typeof Sun; label: string }[] = [
  { v: 'light', icon: Sun, label: 'Light theme' },
  { v: 'system', icon: Monitor, label: 'System theme' },
  { v: 'dark', icon: Moon, label: 'Dark theme' },
];

export function ThemeToggle() {
  const pref = useThemePref();
  return (
    <div role="radiogroup" aria-label="Theme" className="seg">
      {OPTS.map(({ v, icon: Icon, label }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={pref === v}
          aria-label={label}
          title={label}
          data-on={pref === v || undefined}
          onClick={() => setThemePref(v)}
          className="seg-btn"
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
