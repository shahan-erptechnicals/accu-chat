-- Fix security issue: Set search_path for budget function
CREATE OR REPLACE FUNCTION public.update_budget_spent_amounts()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;