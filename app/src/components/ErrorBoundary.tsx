import { Component } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-1">Terjadi Kesalahan</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {this.state.error?.message || 'Halaman ini mengalami error. Coba muat ulang.'}
            </p>
          </div>
          <Button onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}>
            Muat Ulang Halaman
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
