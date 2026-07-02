import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] caught:', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f2f5',
          fontFamily: 'sans-serif',
          padding: 40,
        }}>
          <div style={{ maxWidth: 480, background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <h2 style={{ color: '#ef476f', marginBottom: 12 }}>应用遇到问题</h2>
            <p style={{ color: '#6c757d', fontSize: 14, lineHeight: 1.6 }}>
              渲染过程中发生了异常。<br />请刷新页面（Ctrl+R / Cmd+R）重试。
            </p>
            <pre style={{
              marginTop: 16,
              padding: 12,
              background: '#f8f9fa',
              borderRadius: 6,
              fontSize: 12,
              overflow: 'auto',
              maxHeight: 200,
              color: '#333',
            }}>
              {this.state.error?.message}
              {'\n'}
              {this.state.error?.stack?.split('\n').slice(1, 4).join('\n')}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
