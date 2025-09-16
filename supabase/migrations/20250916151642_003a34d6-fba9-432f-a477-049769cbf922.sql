-- Add budgets table for budget management
CREATE TABLE public.budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  account_id UUID REFERENCES public.accounts(id),
  budget_type TEXT NOT NULL CHECK (budget_type IN ('monthly', 'quarterly', 'yearly')),
  amount NUMERIC NOT NULL,
  spent_amount NUMERIC NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for budgets
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for budgets
CREATE POLICY "Users can manage their own budgets" 
ON public.budgets 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add trigger for budget updated_at
CREATE TRIGGER update_budgets_updated_at
BEFORE UPDATE ON public.budgets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to update budget spent amounts
CREATE OR REPLACE FUNCTION public.update_budget_spent_amounts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update budget spent amounts when transactions change
  UPDATE public.budgets 
  SET spent_amount = (
    SELECT COALESCE(SUM(ABS(t.amount)), 0)
    FROM public.transactions t
    WHERE t.category_id = budgets.category_id 
    AND t.user_id = budgets.user_id
    AND t.transaction_date BETWEEN budgets.start_date AND budgets.end_date
    AND t.amount < 0 -- Only expenses
  )
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
  AND category_id IS NOT NULL;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update budget amounts when transactions change
CREATE TRIGGER update_budget_amounts_on_transaction_change
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_budget_spent_amounts();