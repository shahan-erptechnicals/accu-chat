-- Ensure the budget update trigger is properly configured
-- First, drop the existing trigger if it exists
DROP TRIGGER IF EXISTS update_budget_spent_amounts_trigger ON public.transactions;

-- Create or replace the trigger function to ensure it's up to date
CREATE OR REPLACE FUNCTION public.update_budget_spent_amounts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Update budget spent amounts when transactions change
  UPDATE public.budgets 
  SET spent_amount = (
    SELECT COALESCE(SUM(ABS(t.amount)), 0)
    FROM public.transactions t
    WHERE t.category_id = budgets.category_id 
    AND t.user_id = budgets.user_id
    AND t.transaction_date BETWEEN budgets.start_date AND budgets.end_date
    AND t.amount < 0 -- Only expenses (negative amounts)
  )
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
  AND category_id IS NOT NULL;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create the trigger to automatically update budget spent amounts
CREATE TRIGGER update_budget_spent_amounts_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_budget_spent_amounts();