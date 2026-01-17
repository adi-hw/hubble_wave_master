import React from 'react';
import { useNavigate } from 'react-router-dom';

export const Unauthorized: React.FC = () => {
  const navigate = useNavigate();

  const handleGoBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="max-w-md w-full border rounded-2xl shadow-sm p-6 space-y-4 text-center bg-card border-border">
        <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center bg-destructive/10">
          <svg className="w-6 h-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-foreground">Access denied</h1>
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to view this page.
        </p>
        <p className="text-xs text-muted-foreground/70">
          If you believe this is an error, contact your administrator.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={handleGoBack}
            className="rounded-md px-4 py-2 text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Go back
          </button>
          <button
            onClick={() => navigate('/')}
            className="rounded-md border px-4 py-2 text-sm font-medium transition-colors bg-card border-border text-muted-foreground hover:bg-muted"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
};
