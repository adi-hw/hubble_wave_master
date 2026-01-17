import { useState } from 'react';
import { Mic } from 'lucide-react';
import { VoiceControlPanel } from './VoiceControlPanel';

interface VoiceControlButtonProps {
  className?: string;
}

export const VoiceControlButton: React.FC<VoiceControlButtonProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`p-2 rounded-lg transition-colors hover:bg-hover ${className}`}
        title="Voice Control"
      >
        <Mic className="h-5 w-5 text-muted-foreground" />
      </button>
      <VoiceControlPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};

export default VoiceControlButton;
