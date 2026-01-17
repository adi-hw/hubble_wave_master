import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ArrowLeft, Search, HelpCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';

export function NotFoundPage() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-lg w-full text-center">
        {/* 404 Icon/Illustration */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-6 bg-muted">
            <Search className="w-12 h-12 text-muted-foreground" />
          </div>
          <h1 className="text-6xl font-bold mb-2 text-foreground">
            404
          </h1>
          <h2 className="text-2xl font-semibold mb-4 text-muted-foreground">
            Page Not Found
          </h2>
        </div>

        {/* Description */}
        <p className="text-base mb-2 text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <p className="text-sm mb-8 font-mono px-4 py-2 rounded-lg inline-block bg-muted text-muted-foreground">
          {location.pathname}
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => navigate(-1)}
            variant="secondary"
            className="inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
          <Button
            onClick={() => navigate('/')}
            variant="primary"
            className="inline-flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            Return Home
          </Button>
        </div>

        {/* Help Link */}
        <div className="mt-8 pt-8 border-t border-border">
          <a
            href="/help"
            className="inline-flex items-center gap-2 text-sm transition-colors hover:underline text-primary"
          >
            <HelpCircle className="w-4 h-4" />
            Need help? Visit our support center
          </a>
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;
