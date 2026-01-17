import React from 'react';
import { MotionConfig } from 'framer-motion';

interface MotionProviderProps {
  children: React.ReactNode;
}

export const MotionProvider: React.FC<MotionProviderProps> = ({ children }) => {
  return (
    <MotionConfig
      // Global spring physics for the "2070" feel
      // High stiffness, moderate damping = snappy but smooth
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 30,
        mass: 1,
      }}
      // Respect user's reduced motion settings automatically
      reducedMotion="user"
    >
      {children}
    </MotionConfig>
  );
};
