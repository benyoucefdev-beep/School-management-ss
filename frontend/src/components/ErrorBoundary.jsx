import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Stops one broken page from blanking the whole app.
 *
 * React unmounts the entire tree when a render throws, which is why a single
 * bad API response (an object where an array was expected) produced a white
 * screen with nothing but a console error. This catches the throw and shows
 * what actually went wrong, so the sidebar still works and the message is
 * readable without opening DevTools.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="card" style={{ padding: 32, maxWidth: 720, margin: '32px auto', textAlign: 'center' }}>
        <AlertTriangle size={40} style={{ color: 'var(--danger)', marginBottom: 12 }} />
        <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>This page failed to load</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
          The rest of the app still works — use the sidebar to go elsewhere.
        </p>

        <pre
          style={{
            textAlign: 'left', background: 'var(--bg)', padding: 14,
            borderRadius: 'var(--radius-md)', fontSize: 12, overflowX: 'auto',
            border: '1px solid var(--border)', color: 'var(--danger)', marginBottom: 20,
          }}
        >
          {String(error?.message || error)}
        </pre>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => this.setState({ error: null })}>
            <RefreshCw size={15} /> Try again
          </button>
          <button className="btn btn-ghost" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
