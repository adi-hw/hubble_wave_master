import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Table2, FileCode, Wrench, ArrowRight } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

const quickLinks = [
  {
    title: 'Assets',
    description: 'Browse and manage asset records.',
    href: '/asset.list',
    icon: Layers,
  },
  {
    title: 'Modules',
    description: 'View available data models.',
    href: '/modules.list',
    icon: Table2,
  },
  {
    title: 'Forms',
    description: 'Design and publish intake forms.',
    href: '/form_definitions.list',
    icon: FileCode,
  },
  {
    title: 'Workflows',
    description: 'Track automations and runs.',
    href: '/workflow_definitions.list',
    icon: Wrench,
  },
];

export const HomePage: React.FC = () => {
  const { auth } = useAuth();
  const user = auth.user;
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col gap-3">
            <div className="text-sm font-semibold text-indigo-600 uppercase tracking-wide">Welcome</div>
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                {user?.displayName || user?.email || 'Home'}
              </h1>
              <p className="text-slate-600 text-sm sm:text-base">
                Quickly jump to key areas of the workspace or continue where you left off.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.title}
                type="button"
                onClick={() => navigate(link.href)}
                className="group text-left w-full rounded-2xl bg-white border border-slate-200 hover:border-indigo-200 hover:shadow-lg transition-all duration-150 p-5 flex items-start gap-4"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900">{link.title}</h2>
                    <ArrowRight className="h-4 w-4 text-indigo-500 opacity-0 group-hover:opacity-100 transition" />
                  </div>
                  <p className="text-sm text-slate-600">{link.description}</p>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
