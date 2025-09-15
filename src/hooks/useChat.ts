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

  const generateAIResponse = async (userMessage: string, conversationId: string): Promise<string> => {
    // Simple AI-like responses based on keywords
    const message = userMessage.toLowerCase();
    
    if (message.includes('transaction') || message.includes('expense') || message.includes('income')) {
      if (message.includes('record') || message.includes('add')) {
        return `I can help you record a new transaction! Here's what I need:

1. **Amount**: How much was the transaction?
2. **Type**: Is this an income or expense?
3. **Description**: What was this transaction for?
4. **Account**: Which account should this be recorded to?
5. **Category**: How should we categorize this?
6. **Date**: When did this transaction occur?

You can provide these details, and I'll help you record it in your accounting system.`;
      }
      
      if (message.includes('show') || message.includes('list')) {
        return `I can show you your recent transactions! You can view them in the Dashboard tab, or I can help you:

- Filter transactions by date range
- Show transactions by category
- Display transactions for specific accounts
- Generate transaction reports

What specific transactions would you like to see?`;
      }
    }
    
    if (message.includes('report') || message.includes('summary')) {
      return `I can help you generate various financial reports:

📊 **Available Reports:**
- Profit & Loss Statement
- Balance Sheet
- Cash Flow Statement
- Transaction Summary by Category
- Monthly/Quarterly Financial Summary

📈 **Current Quick Summary:**
- Check your Dashboard tab for real-time financial overview
- Recent transactions are displayed with categories
- Account balances are calculated automatically

Which report would you like me to generate for you?`;
    }
    
    if (message.includes('account') || message.includes('chart')) {
      return `Your Chart of Accounts is already set up with standard categories:

💰 **Assets**: Cash, Bank Account, Accounts Receivable
💳 **Liabilities**: Accounts Payable
📈 **Equity**: Owner Equity  
💵 **Revenue**: Revenue accounts for income tracking
💸 **Expenses**: Operating Expenses for cost tracking

I can help you:
- Add new accounts
- Modify existing accounts  
- Explain account types
- Set up account hierarchies

What would you like to do with your accounts?`;
    }
    
    if (message.includes('category') || message.includes('categorize')) {
      return `Your transactions can be organized using categories for better tracking:

🏷️ **Default Categories Available:**
- Office Supplies (Red)
- Travel (Orange) 
- Marketing (Purple)
- Software (Cyan)
- Utilities (Green)
- Sales (Green)
- Services (Blue)

I can help you:
- Create new categories with custom colors
- Assign categories to transactions
- Bulk categorize similar transactions
- Generate category-based reports

What categorization do you need help with?`;
    }
    
    if (message.includes('help') || message.includes('how')) {
      return `I'm your AI Accounting Assistant! Here's how I can help:

💼 **Transaction Management:**
- Record new income/expense transactions
- Edit or delete existing transactions
- Bulk import transactions from files
- Categorize and organize transactions

📊 **Financial Reporting:**
- Generate P&L statements
- Create balance sheets
- Show cash flow analysis
- Custom date range reports

💡 **Smart Features:**
- Auto-categorize similar transactions
- Detect duplicate entries
- Calculate tax implications
- Provide financial insights

🔧 **Account Management:**  
- Set up chart of accounts
- Manage categories and tags
- Configure accounting rules
- Data backup and export

Just ask me what you'd like to do, and I'll guide you through it!`;
    }
    
    return `Thanks for your message! As your AI Accounting Assistant, I can help you with:

💰 **Recording Transactions** - Add income/expenses with proper categorization
📊 **Financial Reports** - Generate P&L, balance sheets, and summaries  
📈 **Account Management** - Organize your chart of accounts
🏷️ **Categorization** - Tag and organize transactions
💡 **Financial Insights** - Get advice on your financial data

Try asking me things like:
- "Record a new expense transaction"
- "Show me my financial summary" 
- "Generate a profit & loss report"
- "Help me categorize transactions"

What accounting task can I help you with today?`;
  };

  const selectConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId);
  };

  const newConversation = () => {
    setCurrentConversationId(undefined);
    setMessages([]);
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