import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, Plus, Settings, Calculator, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

interface ChatSidebarProps {
  conversations: Conversation[];
  currentConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onShowDashboard: () => void;
  showDashboard: boolean;
}

export function ChatSidebar({ 
  conversations, 
  currentConversationId, 
  onSelectConversation, 
  onNewConversation,
  onShowDashboard,
  showDashboard 
}: ChatSidebarProps) {
  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <h1 className="text-lg font-semibold text-sidebar-foreground">AI Accountant</h1>
      </div>
      
      {/* Navigation */}
      <div className="p-2 space-y-1">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-2",
            showDashboard && "bg-sidebar-accent text-sidebar-accent-foreground"
          )}
          onClick={onShowDashboard}
        >
          <TrendingUp className="h-4 w-4" />
          Dashboard
        </Button>
        
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-2",
            !showDashboard && "bg-sidebar-accent text-sidebar-accent-foreground"
          )}
          onClick={() => currentConversationId ? onSelectConversation(currentConversationId) : onNewConversation()}
        >
          <MessageSquare className="h-4 w-4" />
          Chat
        </Button>
      </div>

      <Separator />

      {/* New Chat Button */}
      <div className="p-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={onNewConversation}
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          {conversations.map((conversation) => (
            <Button
              key={conversation.id}
              variant="ghost"
              className={cn(
                "w-full justify-start text-left truncate",
                conversation.id === currentConversationId && !showDashboard && 
                "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <MessageSquare className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate">{conversation.title}</span>
            </Button>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border">
        <Button variant="ghost" className="w-full justify-start gap-2">
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </div>
    </div>
  );
}