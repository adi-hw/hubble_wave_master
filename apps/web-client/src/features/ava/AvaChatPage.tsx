/**
 * AvaChatPage - Dedicated AVA Chat Page
 * HubbleWave Platform - Phase 6
 *
 * Full-page AVA chat interface with conversation history sidebar.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  MessageSquare,
  Trash2,
  Clock,
  Search,
  Settings,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassCard } from '../../components/ui/glass/GlassCard';
import { GlassButton } from '../../components/ui/glass/GlassButton';
import { GlassInput } from '../../components/ui/glass/GlassInput';
import { AvaChat } from './AvaChat';

interface Conversation {
  id: string;
  title: string;
  preview: string;
  updatedAt: Date;
  messageCount: number;
}

export const AvaChatPage: React.FC = () => {
  const navigate = useNavigate();
  const { conversationId } = useParams<{ conversationId?: string }>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);

  // Fetch conversations
  useEffect(() => {
    const fetchConversations = async () => {
      setIsLoadingConversations(true);
      try {
        const response = await fetch('/api/ava/conversations');
        if (response.ok) {
          const data = await response.json();
          setConversations(
            data.map((c: Record<string, unknown>) => ({
              ...c,
              updatedAt: new Date(c.updatedAt as string),
            }))
          );
        }
      } catch (err) {
        console.error('Failed to fetch conversations:', err);
      } finally {
        setIsLoadingConversations(false);
      }
    };

    fetchConversations();
  }, []);

  // Create new conversation
  const handleNewConversation = useCallback(() => {
    navigate('/ava/chat');
  }, [navigate]);

  // Select conversation
  const handleSelectConversation = useCallback(
    (id: string) => {
      navigate(`/ava/chat/${id}`);
    },
    [navigate]
  );

  // Delete conversation
  const handleDeleteConversation = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await fetch(`/api/ava/conversations/${id}`, { method: 'DELETE' });
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (conversationId === id) {
          navigate('/ava/chat');
        }
      } catch (err) {
        console.error('Failed to delete conversation:', err);
      }
    },
    [conversationId, navigate]
  );

  // Filter conversations by search
  const filteredConversations = conversations.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.preview.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Format date for display
  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div
        className={cn(
          'w-80 flex-shrink-0 flex flex-col',
          'border-r border-[var(--border-default)]',
          'bg-[var(--bg-surface)]',
          'transition-all duration-300',
          !showSidebar && '-ml-80'
        )}
      >
        {/* Sidebar Header */}
        <div className="p-4 flex items-center justify-between border-b border-[var(--border-subtle)]">
          <h2 className="font-semibold text-foreground">
            Conversations
          </h2>
          <GlassButton
            variant="solid"
            size="sm"
            onClick={handleNewConversation}
            aria-label="New conversation"
          >
            <Plus className="h-4 w-4 mr-1" />
            New
          </GlassButton>
        </div>

        {/* Search */}
        <div className="p-3">
          <GlassInput
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftAddon={<Search className="h-4 w-4" />}
          />
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingConversations ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-lg animate-pulse bg-muted"
                />
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center">
              <MessageSquare
                className="h-10 w-10 mx-auto mb-2 text-muted-foreground"
              />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No matching conversations' : 'No conversations yet'}
              </p>
              <p className="text-xs mt-1 text-muted-foreground">
                Start a new conversation with AVA
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => handleSelectConversation(conversation.id)}
                  className={cn(
                    'w-full p-3 rounded-lg text-left group',
                    'transition-colors',
                    conversation.id === conversationId
                      ? 'bg-[var(--bg-primary-subtle)]'
                      : 'hover:bg-[var(--bg-hover)]'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-medium text-sm truncate text-foreground"
                      >
                        {conversation.title}
                      </p>
                      <p
                        className="text-xs truncate mt-0.5 text-muted-foreground"
                      >
                        {conversation.preview}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(conversation.updatedAt)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {conversation.messageCount} messages
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteConversation(conversation.id, e)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-danger-subtle)] transition-all text-destructive"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[var(--border-subtle)]">
          <GlassButton
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => navigate('/settings/ava')}
          >
            <Settings className="h-4 w-4 mr-2" />
            AVA Settings
          </GlassButton>
        </div>
      </div>

      {/* Toggle Sidebar Button */}
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        className={cn(
          'absolute left-0 top-1/2 -translate-y-1/2 z-10',
          'p-1.5 rounded-r-lg',
          'transition-all',
          'bg-card border border-border border-l-0 text-muted-foreground',
          showSidebar ? 'ml-80' : 'ml-0'
        )}
      >
        <ChevronLeft
          className={cn('h-4 w-4 transition-transform', !showSidebar && 'rotate-180')}
        />
      </button>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <GlassCard padding="none" className="flex-1 m-4 flex flex-col overflow-hidden">
          <AvaChat
            fullPage
            showHeader
            context={{
              page: 'AVA Chat',
            }}
          />
        </GlassCard>
      </div>
    </div>
  );
};

export default AvaChatPage;
