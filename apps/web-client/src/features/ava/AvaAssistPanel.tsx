import React from 'react';
import { Sparkles } from 'lucide-react';
import { GlassCard } from '../../components/ui/glass/GlassCard';
import { AvaChat } from './AvaChat';
import { AvaContext } from './useAva';

export interface AvaAssistPanelProps {
  title?: string;
  subtitle?: string;
  context?: AvaContext;
  className?: string;
}

export const AvaAssistPanel: React.FC<AvaAssistPanelProps> = ({
  title = 'AVA Assistant',
  subtitle = 'Ask questions or take guided actions',
  context,
  className,
}) => {
  return (
    <GlassCard className={className} padding="none">
      <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-border">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">
            AVA
          </div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="h-10 w-10 rounded-2xl flex items-center justify-center border border-primary/20 bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
      </div>
      <AvaChat context={context} showHeader={false} />
    </GlassCard>
  );
};

export default AvaAssistPanel;
