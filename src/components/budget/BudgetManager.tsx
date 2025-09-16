import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Plus, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Budget {
  id: string;
  name: string;
  amount: number;
  spent_amount: number;
  budget_type: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  categories?: { name: string };
  accounts?: { name: string };
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Account {
  id: string;
  name: string;
  account_type: string;
}

export function BudgetManager() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [newBudget, setNewBudget] = useState({
    name: '',
    amount: '',
    budget_type: 'monthly',
    category_id: '',
    account_id: '',
    start_date: '',
    end_date: ''
  });

  useEffect(() => {
    fetchBudgets();
    fetchCategories();
    fetchAccounts();
  }, []);

  const fetchBudgets = async () => {
    try {
      const { data, error } = await supabase
        .from('budgets')
        .select(`
          *,
          categories(name),
          accounts(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBudgets(data || []);
    } catch (error) {
      console.error('Error fetching budgets:', error);
      toast({
        title: "Error",
        description: "Failed to load budgets",
        variant: "destructive"
      });
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('name');

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const createBudget = async () => {
    try {
      setIsLoading(true);
      
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('budgets')
        .insert([{
          user_id: userData.user.id,
          name: newBudget.name,
          amount: parseFloat(newBudget.amount),
          budget_type: newBudget.budget_type,
          category_id: newBudget.category_id || null,
          account_id: newBudget.account_id || null,
          start_date: newBudget.start_date,
          end_date: newBudget.end_date
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Budget created successfully"
      });

      setIsCreateDialogOpen(false);
      setNewBudget({
        name: '',
        amount: '',
        budget_type: 'monthly',
        category_id: '',
        account_id: '',
        start_date: '',
        end_date: ''
      });
      
      fetchBudgets();
    } catch (error) {
      console.error('Error creating budget:', error);
      toast({
        title: "Error",
        description: "Failed to create budget",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getBudgetProgress = (budget: Budget) => {
    return Math.min((budget.spent_amount / budget.amount) * 100, 100);
  };

  const getBudgetStatus = (budget: Budget) => {
    const progress = getBudgetProgress(budget);
    if (progress >= 100) return 'over';
    if (progress >= 80) return 'warning';
    return 'good';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Budget Management</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Budget
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Budget</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="budget-name">Budget Name</Label>
                <Input
                  id="budget-name"
                  value={newBudget.name}
                  onChange={(e) => setNewBudget(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Monthly Office Expenses"
                />
              </div>
              
              <div>
                <Label htmlFor="budget-amount">Budget Amount</Label>
                <Input
                  id="budget-amount"
                  type="number"
                  value={newBudget.amount}
                  onChange={(e) => setNewBudget(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="1000.00"
                />
              </div>

              <div>
                <Label>Budget Type</Label>
                <Select value={newBudget.budget_type} onValueChange={(value) => 
                  setNewBudget(prev => ({ ...prev, budget_type: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Category (Optional)</Label>
                <Select value={newBudget.category_id} onValueChange={(value) => 
                  setNewBudget(prev => ({ ...prev, category_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={newBudget.start_date}
                    onChange={(e) => setNewBudget(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={newBudget.end_date}
                    onChange={(e) => setNewBudget(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>

              <Button onClick={createBudget} disabled={isLoading} className="w-full">
                {isLoading ? 'Creating...' : 'Create Budget'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {budgets.map((budget) => {
          const progress = getBudgetProgress(budget);
          const status = getBudgetStatus(budget);
          
          return (
            <Card key={budget.id} className={`${
              status === 'over' ? 'border-destructive' : 
              status === 'warning' ? 'border-yellow-500' : 'border-border'
            }`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{budget.name}</CardTitle>
                  {status === 'over' && (
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  )}
                  {status === 'warning' && (
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {budget.categories?.name && `Category: ${budget.categories.name}`}
                  {budget.budget_type.charAt(0).toUpperCase() + budget.budget_type.slice(1)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Spent: ${budget.spent_amount.toFixed(2)}</span>
                    <span>Budget: ${budget.amount.toFixed(2)}</span>
                  </div>
                  
                  <Progress 
                    value={progress} 
                    className={`h-2 ${
                      status === 'over' ? '[&>div]:bg-destructive' : 
                      status === 'warning' ? '[&>div]:bg-yellow-500' : ''
                    }`}
                  />
                  
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{progress.toFixed(1)}% used</span>
                    <span>
                      ${(budget.amount - budget.spent_amount).toFixed(2)} remaining
                    </span>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    {new Date(budget.start_date).toLocaleDateString()} - {new Date(budget.end_date).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {budgets.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <h3 className="text-lg font-semibold mb-2">No Budgets Created</h3>
            <p className="text-muted-foreground mb-4">
              Create your first budget to track spending and stay on target.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Budget
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}