import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
  }, []);

  // Fetch messages when conversation changes
  useEffect(() => {
    if (currentConversationId) {
      fetchMessages(currentConversationId);
    } else {
      setMessages([]);
    }
  }, [currentConversationId]);

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
      
      // Set current conversation to the most recent one if none selected
      if (data && data.length > 0 && !currentConversationId) {
        setCurrentConversationId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive"
      });
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data || []) as Message[]);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive"
      });
    }
  };

  const createNewConversation = async (firstMessage?: string): Promise<string> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const title = firstMessage 
        ? firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '')
        : 'New Conversation';

      const { data, error } = await supabase
        .from('conversations')
        .insert([{
          user_id: userData.user.id,
          title
        }])
        .select()
        .single();

      if (error) throw error;
      
      // Add to local state
      setConversations(prev => [data, ...prev]);
      setCurrentConversationId(data.id);
      
      return data.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: "Error",
        description: "Failed to create new conversation",
        variant: "destructive"
      });
      throw error;
    }
  };

  const sendMessage = async (content: string) => {
    try {
      setIsLoading(true);
      
      let conversationId = currentConversationId;
      
      // Create new conversation if none exists
      if (!conversationId) {
        conversationId = await createNewConversation(content);
      }

      // Add user message
      const { data: userMessage, error: userMessageError } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          role: 'user',
          content
        }])
        .select()
        .single();

      if (userMessageError) throw userMessageError;

      // Add to local state immediately
      setMessages(prev => [...prev, userMessage as Message]);

      // Generate AI response based on message content
      const aiResponse = await generateAIResponse(content, conversationId);

      // Add AI message
      const { data: aiMessage, error: aiMessageError } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          role: 'assistant',
          content: aiResponse
        }])
        .select()
        .single();

      if (aiMessageError) throw aiMessageError;

      // Add to local state
      setMessages(prev => [...prev, aiMessage as Message]);

      // Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateAIResponse = async (userMessage: string, conversationId: string, attachments?: any[]): Promise<string> => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('ai-accountant', {
        body: {
          message: userMessage,
          conversationId: conversationId,
          userId: userData.user.id,
          attachments: attachments || []
        }
      });

      if (error) {
        console.error('AI function error:', error);
        return "I apologize, but I'm having trouble processing your request right now. Please try again.";
      }

      return data.response || "I apologize, but I couldn't generate a response. Please try again.";
    } catch (error) {
      console.error('Error calling AI function:', error);
      return "I'm currently experiencing technical difficulties. Please try again in a moment.";
    }
  };

  const selectConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId);
  };

  const newConversation = () => {
    setCurrentConversationId(undefined);
    setMessages([]);
    // Refresh conversations to ensure we have the latest data
    fetchConversations();
  };

  return {
    conversations,
    currentConversationId,
    messages,
    isLoading,
    sendMessage,
    selectConversation,
    newConversation,
    refreshConversations: fetchConversations
  };
}