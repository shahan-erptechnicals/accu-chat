import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Mail, Phone, Building } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  customer_type: string;
  balance: number;
  payment_terms: number;
  is_active: boolean;
  created_at: string;
}

export function CustomerManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    address: '',
    tax_number: '',
    customer_type: 'customer',
    payment_terms: '30',
    credit_limit: '',
    notes: ''
  });

  useEffect(() => {
    fetchCustomers();
    
    // Set up real-time subscription for customer updates
    const channel = supabase
      .channel('customer-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        () => {
          console.log('Customer change detected, refreshing customers...');
          fetchCustomers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        title: "Error",
        description: "Failed to load customers",
        variant: "destructive"
      });
    }
  };

  const createCustomer = async () => {
    try {
      setIsLoading(true);
      
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('customers')
        .insert([{
          user_id: userData.user.id,
          name: newCustomer.name,
          email: newCustomer.email || null,
          phone: newCustomer.phone || null,
          company_name: newCustomer.company_name || null,
          address: newCustomer.address || null,
          tax_number: newCustomer.tax_number || null,
          customer_type: newCustomer.customer_type,
          payment_terms: parseInt(newCustomer.payment_terms),
          credit_limit: newCustomer.credit_limit ? parseFloat(newCustomer.credit_limit) : 0,
          notes: newCustomer.notes || null
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Customer created successfully"
      });

      setIsCreateDialogOpen(false);
      setNewCustomer({
        name: '',
        email: '',
        phone: '',
        company_name: '',
        address: '',
        tax_number: '',
        customer_type: 'customer',
        payment_terms: '30',
        credit_limit: '',
        notes: ''
      });
      
      fetchCustomers();
    } catch (error) {
      console.error('Error creating customer:', error);
      toast({
        title: "Error",
        description: "Failed to create customer",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Customer Management</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Customer</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              <div>
                <Label htmlFor="customer-name">Customer Name *</Label>
                <Input
                  id="customer-name"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="John Doe"
                />
              </div>
              
              <div>
                <Label htmlFor="customer-email">Email</Label>
                <Input
                  id="customer-email"
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <Label htmlFor="customer-phone">Phone</Label>
                <Input
                  id="customer-phone"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div>
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  value={newCustomer.company_name}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, company_name: e.target.value }))}
                  placeholder="ACME Corp"
                />
              </div>

              <div>
                <Label>Customer Type</Label>
                <Select value={newCustomer.customer_type} onValueChange={(value) => 
                  setNewCustomer(prev => ({ ...prev, customer_type: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="payment-terms">Payment Terms (Days)</Label>
                <Input
                  id="payment-terms"
                  type="number"
                  value={newCustomer.payment_terms}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, payment_terms: e.target.value }))}
                  placeholder="30"
                />
              </div>

              <div>
                <Label htmlFor="tax-number">Tax Number</Label>
                <Input
                  id="tax-number"
                  value={newCustomer.tax_number}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, tax_number: e.target.value }))}
                  placeholder="123-45-6789"
                />
              </div>

              <div>
                <Label htmlFor="credit-limit">Credit Limit</Label>
                <Input
                  id="credit-limit"
                  type="number"
                  value={newCustomer.credit_limit}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, credit_limit: e.target.value }))}
                  placeholder="5000.00"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="123 Main St, City, State 12345"
                  rows={2}
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={newCustomer.notes}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes about this customer..."
                  rows={3}
                />
              </div>

              <div className="col-span-2">
                <Button onClick={createCustomer} disabled={isLoading || !newCustomer.name} className="w-full">
                  {isLoading ? 'Creating...' : 'Create Customer'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.map((customer) => (
          <Card key={customer.id} className={`${!customer.is_active ? 'opacity-60' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{customer.name}</CardTitle>
                <Badge variant={customer.customer_type === 'client' ? 'default' : 'secondary'}>
                  {customer.customer_type}
                </Badge>
              </div>
              {customer.company_name && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Building className="h-3 w-3" />
                  {customer.company_name}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {customer.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate">{customer.email}</span>
                </div>
              )}
              
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <span>{customer.phone}</span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Balance:</span>
                <span className={customer.balance >= 0 ? 'text-green-600' : 'text-red-600'}>
                  ${Math.abs(customer.balance).toFixed(2)} {customer.balance < 0 ? 'owed' : 'credit'}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment Terms:</span>
                <span>{customer.payment_terms} days</span>
              </div>

              <div className="text-xs text-muted-foreground">
                Added: {new Date(customer.created_at).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {customers.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Customers Added</h3>
            <p className="text-muted-foreground mb-4">
              Add your first customer to start managing client relationships.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Customer
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}