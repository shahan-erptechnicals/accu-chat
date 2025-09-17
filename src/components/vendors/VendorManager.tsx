import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Truck, Mail, Phone, Building } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Vendor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  vendor_type: string;
  balance: number;
  payment_terms: number;
  is_active: boolean;
  created_at: string;
}

export function VendorManager() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [newVendor, setNewVendor] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    address: '',
    tax_number: '',
    vendor_type: 'vendor',
    payment_terms: '30',
    credit_limit: '',
    notes: ''
  });

  useEffect(() => {
    fetchVendors();
    
    // Set up real-time subscription for vendor updates
    const channel = supabase
      .channel('vendor-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendors' },
        () => {
          console.log('Vendor change detected, refreshing vendors...');
          fetchVendors();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast({
        title: "Error",
        description: "Failed to load vendors",
        variant: "destructive"
      });
    }
  };

  const createVendor = async () => {
    try {
      setIsLoading(true);
      
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('vendors')
        .insert([{
          user_id: userData.user.id,
          name: newVendor.name,
          email: newVendor.email || null,
          phone: newVendor.phone || null,
          company_name: newVendor.company_name || null,
          address: newVendor.address || null,
          tax_number: newVendor.tax_number || null,
          vendor_type: newVendor.vendor_type,
          payment_terms: parseInt(newVendor.payment_terms),
          credit_limit: newVendor.credit_limit ? parseFloat(newVendor.credit_limit) : 0,
          notes: newVendor.notes || null
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Vendor created successfully"
      });

      setIsCreateDialogOpen(false);
      setNewVendor({
        name: '',
        email: '',
        phone: '',
        company_name: '',
        address: '',
        tax_number: '',
        vendor_type: 'vendor',
        payment_terms: '30',
        credit_limit: '',
        notes: ''
      });
      
      fetchVendors();
    } catch (error) {
      console.error('Error creating vendor:', error);
      toast({
        title: "Error",
        description: "Failed to create vendor",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Vendor Management</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Vendor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Vendor</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              <div>
                <Label htmlFor="vendor-name">Vendor Name *</Label>
                <Input
                  id="vendor-name"
                  value={newVendor.name}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="ABC Supply Co."
                />
              </div>
              
              <div>
                <Label htmlFor="vendor-email">Email</Label>
                <Input
                  id="vendor-email"
                  type="email"
                  value={newVendor.email}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="orders@supplier.com"
                />
              </div>

              <div>
                <Label htmlFor="vendor-phone">Phone</Label>
                <Input
                  id="vendor-phone"
                  value={newVendor.phone}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1 (555) 987-6543"
                />
              </div>

              <div>
                <Label htmlFor="vendor-company-name">Company Name</Label>
                <Input
                  id="vendor-company-name"
                  value={newVendor.company_name}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, company_name: e.target.value }))}
                  placeholder="ABC Supply Corporation"
                />
              </div>

              <div>
                <Label>Vendor Type</Label>
                <Select value={newVendor.vendor_type} onValueChange={(value) => 
                  setNewVendor(prev => ({ ...prev, vendor_type: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="supplier">Supplier</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="vendor-payment-terms">Payment Terms (Days)</Label>
                <Input
                  id="vendor-payment-terms"
                  type="number"
                  value={newVendor.payment_terms}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, payment_terms: e.target.value }))}
                  placeholder="30"
                />
              </div>

              <div>
                <Label htmlFor="vendor-tax-number">Tax Number</Label>
                <Input
                  id="vendor-tax-number"
                  value={newVendor.tax_number}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, tax_number: e.target.value }))}
                  placeholder="98-7654321"
                />
              </div>

              <div>
                <Label htmlFor="vendor-credit-limit">Credit Limit</Label>
                <Input
                  id="vendor-credit-limit"
                  type="number"
                  value={newVendor.credit_limit}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, credit_limit: e.target.value }))}
                  placeholder="10000.00"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="vendor-address">Address</Label>
                <Textarea
                  id="vendor-address"
                  value={newVendor.address}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="456 Industrial Ave, Business City, State 54321"
                  rows={2}
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="vendor-notes">Notes</Label>
                <Textarea
                  id="vendor-notes"
                  value={newVendor.notes}
                  onChange={(e) => setNewVendor(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes about this vendor..."
                  rows={3}
                />
              </div>

              <div className="col-span-2">
                <Button onClick={createVendor} disabled={isLoading || !newVendor.name} className="w-full">
                  {isLoading ? 'Creating...' : 'Create Vendor'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vendors.map((vendor) => (
          <Card key={vendor.id} className={`${!vendor.is_active ? 'opacity-60' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{vendor.name}</CardTitle>
                <Badge variant={vendor.vendor_type === 'supplier' ? 'default' : 'secondary'}>
                  {vendor.vendor_type}
                </Badge>
              </div>
              {vendor.company_name && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Building className="h-3 w-3" />
                  {vendor.company_name}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {vendor.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate">{vendor.email}</span>
                </div>
              )}
              
              {vendor.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <span>{vendor.phone}</span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Balance:</span>
                <span className={vendor.balance <= 0 ? 'text-green-600' : 'text-red-600'}>
                  ${Math.abs(vendor.balance).toFixed(2)} {vendor.balance > 0 ? 'owed' : 'credit'}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment Terms:</span>
                <span>{vendor.payment_terms} days</span>
              </div>

              <div className="text-xs text-muted-foreground">
                Added: {new Date(vendor.created_at).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {vendors.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Vendors Added</h3>
            <p className="text-muted-foreground mb-4">
              Add your first vendor to start managing supplier relationships.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Vendor
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}