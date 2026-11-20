import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { error: Error | null }

/** Keeps a failing map from taking the whole dashboard down. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error) { console.error('[Ember] map error', error); }
  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div className="map-root" style={{ display: 'grid', placeItems: 'center' }}>
          <div className="glass" style={{ padding: 20, maxWidth: 360, textAlign: 'center' }}>
            <div className="eyebrow">Map unavailable</div>
            <p style={{ marginTop: 8, color: 'var(--text-2)', fontSize: 'var(--fs-sm)' }}>The map failed to render. KPIs and panels still update.</p>
            <button type="button" className="chip" style={{ marginTop: 12 }} onClick={() => this.setState({ error: null })}>Retry</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
