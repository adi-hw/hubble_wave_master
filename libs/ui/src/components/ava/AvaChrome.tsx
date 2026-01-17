import React from 'react';
import { Sparkles } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface AvaChromeProps {
  onClick: () => void;
  isOpen?: boolean;
}

export const AvaChrome: React.FC<AvaChromeProps> = ({ onClick, isOpen = false }) => {
  if (isOpen) return null; // Hide FAB when panel is open

  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed bottom-6 right-6 z-40 group",
        "flex items-center justify-center w-14 h-14 rounded-full",
        "bg-background/80 backdrop-blur-md border border-primary/20",
        "shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgba(var(--primary-rgb),0.25)]",
        "transition-all duration-300 ease-out hover:scale-105 active:scale-95",
        "ring-1 ring-primary/10"
      )}
      aria-label="Open Ava AI Assistant"
    >
      <div className={cn(
        "absolute inset-0 rounded-full bg-gradient-to-tr from-primary/10 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      )} />
      
      <Sparkles 
        className={cn(
          "w-6 h-6 text-primary",
          "transition-transform duration-500 group-hover:rotate-12"
        )} 
      />
      
      {/* Pulse effect */}
      <div className="absolute inset-0 -z-10 rounded-full animate-ping opacity-75 bg-primary/10 [animation-duration:3s]" />
    </button>
  );
};
