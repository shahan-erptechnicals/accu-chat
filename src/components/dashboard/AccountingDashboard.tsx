import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PlusCircle,
  Calendar,
  Filter
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  transaction_date: string;
  account: { name: string; account_type: string };
  category: { name: string; color: string } | null;
  status: string;
}

interface Account {
  id: string;
  name: string;
  code: string;
  account_type: string;
  is_active: boolean;
}

interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  totalAssets: number;
}

export function AccountingDashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [summary, setSummary] = useState<FinancialSummary>({
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    totalAssets: 0
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchDashboardData();
    
    // Set up real-time subscription for transactions
    const channel = supabase
      .channel('dashboard-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => {
          console.log('Transaction change detected, refreshing dashboard...');
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch recent transactions with related data
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select(`
          *,
          account:accounts(name, account_type),
          category:categories(name, color)
        `)
        .order('transaction_date', { ascending: false })
        .limit(10);

      if (transactionsError) throw transactionsError;
      
      // Fetch accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('code');

      if (accountsError) throw accountsError;

      // Calculate financial summary
      const { data: summaryData, error: summaryError } = await supabase
        .from('transactions')
        .select('amount, account:accounts(account_type)');

      if (summaryError) throw summaryError;

      let totalRevenue = 0;
      let totalExpenses = 0;
      let totalAssets = 0;

      summaryData?.forEach((transaction: any) => {
        const amount = parseFloat(transaction.amount);
        const accountType = transaction.account?.account_type;
        
        // Expenses are negative amounts, Income/Revenue are positive amounts
        if (amount < 0) {
          // This is an expense (negative amount)
          totalExpenses += Math.abs(amount); // Convert to positive for display
        } else if (amount > 0) {
          // This is income/revenue (positive amount)
          if (accountType === 'revenue') {
            totalRevenue += amount;
          } else if (accountType === 'asset') {
            totalAssets += amount;
          }
        }
      });

      setTransactions(transactionsData || []);
      setAccounts(accountsData || []);
      setSummary({
        totalRevenue,
        totalExpenses,
        netIncome: totalRevenue - totalExpenses,
        totalAssets
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Accounting Dashboard</h1>
          <p className="text-muted-foreground">Overview of your financial data</p>
        </div>
        <Button>
          <PlusCircle className="h-4 w-4 mr-2" />
          Add Transaction
        </Button>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalRevenue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.totalExpenses)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Income</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.netIncome)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(summary.totalAssets)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
          <TabsTrigger value="accounts">Chart of Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {transactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No transactions found. Start by adding your first transaction.
                  </p>
                ) : (
                  transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{transaction.description}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(transaction.transaction_date).toLocaleDateString()}
                          <span>•</span>
                          <span>{transaction.account?.name}</span>
                          {transaction.category && (
                            <>
                              <span>•</span>
                              <Badge 
                                variant="secondary" 
                                style={{ backgroundColor: transaction.category.color + '20', color: transaction.category.color }}
                              >
                                {transaction.category.name}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${
                          transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(Math.abs(transaction.amount))}
                        </p>
                        <Badge variant={transaction.status === 'cleared' ? 'default' : 'secondary'}>
                          {transaction.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Chart of Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {['asset', 'liability', 'equity', 'revenue', 'expense'].map((type) => (
                  <div key={type} className="space-y-3">
                    <h3 className="font-semibold capitalize">{type}s</h3>
                    <div className="space-y-2">
                      {accounts
                        .filter((account) => account.account_type === type)
                        .map((account) => (
                          <div
                            key={account.id}
                            className="p-2 border rounded hover:bg-accent"
                          >
                            <p className="font-medium">{account.name}</p>
                            <p className="text-sm text-muted-foreground">{account.code}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}