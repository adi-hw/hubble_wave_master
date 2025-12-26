import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

const quickLinks: Array<{
  title: string;
  description: string;
  href: string;
  icon: React.FC<{ className?: string }>;
}> = [];

export const HomePage: React.FC = () => {
  const { auth } = useAuth();
  const user = auth.user;
  const navigate = useNavigate();

  return (
    <div className="min-h-full p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div
          className="rounded-2xl border shadow-sm p-6 sm:p-8"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-default)',
          }}
        >
          <div className="flex flex-col gap-3">
            <div
              className="text-sm font-semibold uppercase tracking-wide"
              style={{ color: 'var(--text-brand)' }}
            >
              Welcome
            </div>
            <div className="flex flex-col gap-2">
              <h1
                className="text-2xl sm:text-3xl font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                {user?.displayName || user?.email || 'Home'}
              </h1>
              <p className="text-sm sm:text-base" style={{ color: 'var(--text-muted)' }}>
                Quickly jump to key areas of the workspace or continue where you left off.
              </p>
            </div>
          </div>
        </div>

        {quickLinks.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <button
                  key={link.title}
                  type="button"
                  onClick={() => navigate(link.href)}
                  className="group text-left w-full rounded-2xl border hover:shadow-lg transition-all duration-150 p-5 flex items-start gap-4"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-default)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                  }}
                >
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl border"
                    style={{
                      backgroundColor: 'var(--bg-primary-subtle)',
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-brand)',
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h2
                        className="text-base font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {link.title}
                      </h2>
                      <ArrowRight
                        className="h-4 w-4 opacity-0 group-hover:opacity-100 transition"
                        style={{ color: 'var(--text-brand)' }}
                      />
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {link.description}
                    </p>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
