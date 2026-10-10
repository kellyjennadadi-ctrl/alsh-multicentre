import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from '@/lib/auth';
import './index.css';

class RootErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('RootErrorBoundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F1F5F9] flex flex-col items-center justify-center px-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-rose-100 flex items-center justify-center mb-4 text-2xl">
            !
          </div>
          <p className="text-sm font-bold text-[#1E293B] mb-1">L'application a rencontré un problème</p>
          <p className="text-xs text-gray-400 mb-4">Veuillez rafraîchir la page.</p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            className="px-5 py-2.5 bg-[#2563EB] text-white text-sm font-bold rounded-2xl active:scale-95 transition"
          >
            Rafraîchir
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </RootErrorBoundary>
  </StrictMode>
);
