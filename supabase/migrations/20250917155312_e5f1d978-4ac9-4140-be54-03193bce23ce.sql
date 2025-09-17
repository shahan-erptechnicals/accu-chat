-- Create customers table for managing customers/clients
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  company_name TEXT,
  tax_number TEXT,
  payment_terms INTEGER DEFAULT 30, -- days
  credit_limit NUMERIC DEFAULT 0,
  balance NUMERIC DEFAULT 0,
  customer_type TEXT NOT NULL DEFAULT 'customer' CHECK (customer_type IN ('customer', 'client')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vendors table for managing vendors/suppliers
CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  company_name TEXT,
  tax_number TEXT,
  payment_terms INTEGER DEFAULT 30, -- days
  credit_limit NUMERIC DEFAULT 0,
  balance NUMERIC DEFAULT 0,
  vendor_type TEXT NOT NULL DEFAULT 'vendor' CHECK (vendor_type IN ('vendor', 'supplier')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on customers table
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Enable RLS on vendors table
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for customers
CREATE POLICY "Users can manage their own customers"
ON public.customers
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for vendors
CREATE POLICY "Users can manage their own vendors"
ON public.vendors
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add customer_id and vendor_id to transactions table
ALTER TABLE public.transactions 
ADD COLUMN customer_id UUID,
ADD COLUMN vendor_id UUID;

-- Create triggers for updating timestamps
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at
BEFORE UPDATE ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for better performance
CREATE INDEX idx_customers_user_id ON public.customers(user_id);
CREATE INDEX idx_customers_active ON public.customers(user_id, is_active);
CREATE INDEX idx_vendors_user_id ON public.vendors(user_id);
CREATE INDEX idx_vendors_active ON public.vendors(user_id, is_active);
CREATE INDEX idx_transactions_customer_id ON public.transactions(customer_id);
CREATE INDEX idx_transactions_vendor_id ON public.transactions(vendor_id);

-- Enable realtime for customers and vendors tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendors;

-- Set replica identity for real-time updates
ALTER TABLE public.customers REPLICA IDENTITY FULL;
ALTER TABLE public.vendors REPLICA IDENTITY FULL;
ALTER TABLE public.budgets REPLICA IDENTITY FULL;