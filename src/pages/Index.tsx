import { useState, useEffect } from 'react';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { AccountingDashboard } from '@/components/dashboard/AccountingDashboard';
import { useChat } from '@/hooks/useChat';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const [showDashboard, setShowDashboard] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const {
    conversations,
    currentConversationId,
    messages,
    isLoading: chatLoading,
    sendMessage,
    selectConversation,
    newConversation
  } = useChat();

  useEffect(() => {
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        setUser(session?.user || null);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      
      if (error) throw error;
    } catch (error) {
      console.error('Sign in failed:', error);
      toast({
        title: "Sign In Failed",
        description: "Please try again or contact support if the problem persists.",
        variant: "destructive"
      });
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out."
      });
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4">AI Accountant</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Your intelligent accounting assistant powered by AI
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">Smart Chat</h3>
                <p className="text-sm text-muted-foreground">
                  Chat with AI to record transactions and get insights
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">Auto Categorization</h3>
                <p className="text-sm text-muted-foreground">
                  Automatically categorize and organize your transactions
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">Financial Reports</h3>
                <p className="text-sm text-muted-foreground">
                  Generate P&L, balance sheets, and custom reports
                </p>
              </div>
            </div>
            
            <button
              onClick={signInWithGoogle}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-3 px-6 rounded-lg font-medium transition-colors"
            >
              Sign in with Google to Get Started
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSelectConversation = (conversationId: string) => {
    selectConversation(conversationId);
    setShowDashboard(false);
  };

  const handleShowDashboard = () => {
    setShowDashboard(true);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0">
        <ChatSidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={newConversation}
          onShowDashboard={handleShowDashboard}
          showDashboard={showDashboard}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {showDashboard ? (
          <AccountingDashboard />
        ) : (
          <ChatInterface
            messages={messages}
            onSendMessage={sendMessage}
            isLoading={chatLoading}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
