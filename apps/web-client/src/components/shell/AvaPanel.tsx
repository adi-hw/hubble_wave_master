/**
 * AvaPanel - AVA Chat Panel (⌘J)
 *
 * Controller component that manages state and orchestration for the AI assistant.
 * Delegates UI rendering to @hubblewave/ui components.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  HelpCircle,
  Zap,
  MessageSquare,
  Settings,
} from 'lucide-react';
import { 
  AvaPanel as UIAvaPanel, 
  AvaChat, 
  AvaMessage,
  QuickAction 
} from '@hubblewave/ui';
import { avaService } from '../../services/ava.service';
import { useAuth } from '../../auth/AuthContext';
import { useProfile } from '../../auth/useProfile';

interface AvaPanelProps {
  open: boolean;
  onClose: () => void;
  /** Optional context from the current page */
  context?: {
    page?: string;
    recordType?: string;
    recordId?: string;
    selectedCount?: number;
  };
}

// Quick action suggestions
const quickActions: QuickAction[] = [
  { id: 'help', label: 'How can you help me?', icon: HelpCircle },
  { id: 'workorder', label: 'Create a work order', icon: Zap },
  { id: 'search', label: 'Search for assets', icon: MessageSquare },
  { id: 'report', label: 'Generate a report', icon: Settings },
];

export const AvaPanel: React.FC<AvaPanelProps> = ({ open, onClose, context }) => {
  const { auth } = useAuth();
  const { profile } = useProfile();

  // Get user display name for avatar
  const userDisplayName = profile?.displayName || auth.user?.displayName || auth.user?.email || 'User';

  const [messages, setMessages] = useState<AvaMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // Scroll to bottom on open
  useEffect(() => {
    if (open) {
      // Small delay to allow animation to start
      setTimeout(() => {
        // UI component handles its own scrolling on mount/update
      }, 100);
    }
  }, [open]);

  // Simulate sending a message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMessage: AvaMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setIsOffline(false);

      const assistantMessage: AvaMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        const data = await avaService.sendMessage({
          message: content.trim(),
          context,
        });
        const reply = (data?.message || '').trim();

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? {
                  ...msg,
                  isStreaming: false,
                  content:
                    reply ||
                    "I'm here, but I couldn't get a full response right now. Try again in a moment.",
                }
              : msg
          )
        );
      } catch (err) {
        console.error('AVA send failed', err);
        setIsOffline(true);
        // Fallback demo response
        const responses = [
          "I'm having trouble reaching AVA right now. ",
          'Here are offline tips:\n\n',
          '1. Check your network connection\n',
          '2. Try refreshing the page\n',
          '3. Use the command palette (⌘/Ctrl + K) to navigate manually\n',
        ];
        
        // Simulating stream for offline message
        let fullContent = '';
        for (const chunk of responses) {
          await new Promise((resolve) => setTimeout(resolve, 80));
          fullContent += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id ? { ...msg, content: fullContent } : msg
            )
          );
        }
        
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id ? { ...msg, isStreaming: false } : msg
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [context, isLoading]
  );

  const handleQuickAction = (action: QuickAction) => {
    sendMessage(action.label);
  };

  const clearConversation = () => {
    setMessages([]);
  };

  return (
    <UIAvaPanel
      isOpen={open}
      onClose={onClose}
      onClear={messages.length > 0 ? clearConversation : undefined}
      title="AVA"
      subtitle={context?.page ? `Context: ${context.page}` : "AI Assistant"}
    >
      <AvaChat
        messages={messages}
        onSendMessage={sendMessage}
        isLoading={isLoading}
        isOffline={isOffline}
        userDisplayName={userDisplayName}
        quickActions={quickActions}
        onQuickAction={handleQuickAction}
      />
    </UIAvaPanel>
  );
};

export default AvaPanel;
