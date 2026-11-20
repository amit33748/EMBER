import { useEffect, useMemo, useState } from 'react';
import { History, Play, Pause, SkipBack, SkipForward, Radio } from 'lucide-react';
import { useStore, provider } from '../store';

/** How far back the simulator can be replayed (7 days of 5-minute ticks). */
export const REPLAY_MIN_TICKS = -7 * 288;
/** Playback speeds in ticks per second; label = simulated time per real second. */
const SPEEDS = [
  { tps: 1, label: '5m/s' },
  { tps: 4, label: '20m/s' },
  { tps: 12, label: '1h/s' },
  { tps: 30, label: '2.5h/s' },
] as const;

const fmt = (ms: number, withDay = true) =>
  new Date(ms).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    ...(withDay ? { weekday: 'short', day: '2-digit', month: 'short' } : {}),
    hour: '2-digit',
    minute: '2-digit',
  });

export function TimeMachine() {
  const offset = useStore((s) => s.offset);
  const setOffset = useStore((s) => s.setOffset);
  const playing = useStore((s) => s.playing);
  const setPlaying = useStore((s) => s.setPlaying);
  const snapT = useStore((s) => s.snapshot.t);
  const [speed, setSpeed] = useState(1);
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const replay = offset < 0;

  // playback loop
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const o = useStore.getState().offset;
      if (o >= 0) { setPlaying(false); return; }
      setOffset(Math.min(0, o + 1));
    }, 1000 / SPEEDS[speed].tps);
    return () => clearInterval(id);
  }, [playing, speed, setOffset, setPlaying]);

  // debounce scrubbing so the sim isn't recomputed on every pixel
  useEffect(() => {
    if (drag === null) return;
    const id = setTimeout(() => setOffset(drag), 90);
    return () => clearTimeout(id);
  }, [drag, setOffset]);

  const liveTick = Math.floor(Date.now() / provider.tickMs);
  const dayMarks = useMemo(() => {
    const marks: { pct: number; label: string }[] = [];
    for (let d = 1; d <= 7; d++) marks.push({ pct: 100 - (d * 288 * 100) / -REPLAY_MIN_TICKS, label: `−${d}d` });
    return marks;
  }, []);
  const shown = drag ?? offset;
  const pct = 100 - (shown * 100) / REPLAY_MIN_TICKS;

  if (!open && !replay) {
    return (
      <button type="button" className="tm-open glass" onClick={() => setOpen(true)} aria-label="Open history replay">
        <History size={14} />
        <span>History</span>
      </button>
    );
  }

  return (
    <div className="tm glass" data-replay={replay || undefined} role="group" aria-label="History replay">
      <div className="tm-row">
        <span className="tm-state mono" data-replay={replay || undefined}>
          {replay ? 'REPLAY' : 'LIVE'}
        </span>
        <span className="tm-time mono" aria-live="off">{fmt(snapT)} IST</span>
        <span className="tm-ago mono">{replay ? `${formatAgo(-offset * 5)} ago` : 'now'}</span>

        <div className="tm-ctrls">
          <button type="button" className="icon-btn" aria-label="Back 1 hour" title="Back 1 hour" onClick={() => setOffset(Math.max(REPLAY_MIN_TICKS, offset - 12))}>
            <SkipBack size={14} />
          </button>
          <button
            type="button"
            className="icon-btn tm-play"
            aria-label={playing ? 'Pause' : 'Play forward'}
            title={playing ? 'Pause' : 'Play forward'}
            disabled={!replay}
            onClick={() => setPlaying(!playing)}
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button type="button" className="icon-btn" aria-label="Forward 1 hour" title="Forward 1 hour" disabled={!replay} onClick={() => setOffset(Math.min(0, offset + 12))}>
            <SkipForward size={14} />
          </button>
        </div>

        <div role="radiogroup" aria-label="Playback speed" className="seg tm-speed">
          {SPEEDS.map((s, i) => (
            <button key={s.label} type="button" role="radio" aria-checked={speed === i} data-on={speed === i || undefined} className="seg-btn mono" onClick={() => setSpeed(i)}>
              {s.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="chip tm-live"
          data-on={!replay || undefined}
          onClick={() => { setPlaying(false); setOffset(0); if (!replay) setOpen(false); }}
          title={replay ? 'Return to live' : 'Close history'}
        >
          <Radio size={13} />
          <span>{replay ? 'Go live' : 'Close'}</span>
        </button>
      </div>

      <div className="tm-track">
        <input
          type="range"
          min={REPLAY_MIN_TICKS}
          max={0}
          step={1}
          value={shown}
          onChange={(e) => { setPlaying(false); setDrag(parseInt(e.target.value, 10)); }}
          onPointerUp={() => setDrag(null)}
          onKeyUp={() => setDrag(null)}
          aria-label="Replay time"
          aria-valuetext={`${fmt((liveTick + shown) * provider.tickMs)} IST`}
          style={{ ['--pct' as string]: `${pct}%` }}
        />
        <div className="tm-marks mono" aria-hidden>
          {dayMarks.map((m) => <span key={m.label} style={{ left: `${m.pct}%` }}>{m.label}</span>)}
          <span style={{ left: '100%' }}>now</span>
        </div>
      </div>
    </div>
  );
}

function formatAgo(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  if (h < 24) return `${h}h${m ? ` ${m}m` : ''}`;
  const d = Math.floor(h / 24), hh = h % 24;
  return `${d}d${hh ? ` ${hh}h` : ''}`;
}
