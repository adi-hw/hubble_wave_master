import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { authService } from '../services/auth';

type VerificationState = 'loading' | 'success' | 'error' | 'no-token';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<VerificationState>('loading');
  const [message, setMessage] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setState('no-token');
      setMessage('No verification token provided.');
      return;
    }

    const verifyEmail = async () => {
      try {
        const result = await authService.verifyEmail(token);
        setState('success');
        setMessage(result.message);
      } catch (error: any) {
        setState('error');
        setMessage(
          error?.response?.data?.message ||
          error?.message ||
          'Failed to verify email. The link may have expired.'
        );
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md rounded-xl p-8 text-center bg-card shadow-lg border border-border">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-primary-foreground bg-gradient-to-r from-primary to-primary/80">
            HW
          </div>
        </div>

        {state === 'loading' && (
          <>
            <Loader2 className="h-16 w-16 mx-auto mb-4 animate-spin text-primary" />
            <h1 className="text-xl font-semibold mb-2 text-foreground">
              Verifying your email...
            </h1>
            <p className="text-muted-foreground">
              Please wait while we verify your email address.
            </p>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-success" />
            <h1 className="text-xl font-semibold mb-2 text-foreground">
              Email Verified!
            </h1>
            <p className="mb-6 text-muted-foreground">
              {message}
            </p>
            <Button onClick={() => navigate('/login')} className="w-full">
              Continue to Login
            </Button>
          </>
        )}

        {state === 'error' && (
          <>
            <XCircle className="h-16 w-16 mx-auto mb-4 text-destructive" />
            <h1 className="text-xl font-semibold mb-2 text-foreground">
              Verification Failed
            </h1>
            <p className="mb-6 text-muted-foreground">
              {message}
            </p>
            <div className="space-y-3">
              <Button onClick={() => navigate('/login')} className="w-full">
                Go to Login
              </Button>
              <p className="text-sm text-muted-foreground">
                If your link has expired, you can request a new verification email after logging in.
              </p>
            </div>
          </>
        )}

        {state === 'no-token' && (
          <>
            <Mail className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h1 className="text-xl font-semibold mb-2 text-foreground">
              Invalid Link
            </h1>
            <p className="mb-6 text-muted-foreground">
              {message}
            </p>
            <Button onClick={() => navigate('/login')} className="w-full">
              Go to Login
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
