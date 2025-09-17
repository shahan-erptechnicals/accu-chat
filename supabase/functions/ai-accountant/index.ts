import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationId, userId, attachments } = await req.json();
    
    console.log('AI Accountant request:', { message, conversationId, userId, attachments });

    let context = '';
    let extractedData = null;

    // Process attachments if provided
    if (attachments && attachments.length > 0) {
      console.log('Processing attachments:', attachments.length);
      extractedData = await processAttachments(attachments, userId);
      if (extractedData) {
        context = `\n\nAttachment Analysis:\n${JSON.stringify(extractedData, null, 2)}`;
      }
    }

    // Get user's recent transactions and accounts for context
    const { data: accounts } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .limit(10);

    const { data: categories } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .limit(10);

    const { data: customers } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(10);

    const { data: vendors } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(10);

    const { data: recentTransactions } = await supabase
      .from('transactions')
      .select('*, accounts(name), categories(name), customers(name), vendors(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    const systemPrompt = `You are an AI Accounting Assistant with deep understanding of accounting principles. You can perform actual database operations to help users manage their finances.

Available accounts: ${JSON.stringify(accounts?.map(a => ({ id: a.id, name: a.name, type: a.account_type })))}
Available categories: ${JSON.stringify(categories?.map(c => ({ id: c.id, name: c.name, color: c.color })))}
Available customers: ${JSON.stringify(customers?.map(c => ({ id: c.id, name: c.name, type: c.customer_type })))}
Available vendors: ${JSON.stringify(vendors?.map(v => ({ id: v.id, name: v.name, type: v.vendor_type })))}
Recent transactions: ${JSON.stringify(recentTransactions?.slice(0, 3))}

${context}

CRITICAL ACCOUNTING RULES:
1. EXPENSES are money going OUT (payments, purchases, costs) - use NEGATIVE amounts and EXPENSE accounts
2. INCOME/REVENUE is money coming IN (sales, payments received) - use POSITIVE amounts and REVENUE accounts
3. When someone says "I paid $X for Y" or "I bought X for $Y" - this is an EXPENSE (negative amount)
4. When someone says "I received $X" or "I earned $X" - this is INCOME (positive amount)

Account Types:
- asset: Cash, Bank Account, Accounts Receivable
- liability: Accounts Payable, Loans
- equity: Owner Equity, Retained Earnings
- revenue: Sales, Service Revenue (for INCOME - positive amounts)
- expense: Operating Expenses, Office Supplies, Travel, etc. (for EXPENSES - negative amounts)

Customer & Vendor Management:
- Use customer_id when recording sales or customer payments
- Use vendor_id when recording purchases or vendor payments
- Create customers/vendors when mentioned but not in the available list

You can perform these actions:
1. CREATE_TRANSACTION - Record new transactions
2. CREATE_BUDGET - Set up budgets
3. CREATE_CATEGORY - Add new categories
4. CREATE_ACCOUNT - Add new accounts
5. CREATE_CUSTOMER - Add new customers/clients
6. CREATE_VENDOR - Add new vendors/suppliers
7. UPDATE_TRANSACTION - Modify existing transactions
8. ANALYZE_SPENDING - Provide financial insights

When users ask you to record transactions or perform actions, respond with a JSON object containing:
{
  "action": "ACTION_TYPE",
  "data": { /* relevant data */ },
  "response": "Human readable response"
}

For CREATE_TRANSACTION, include: amount (negative for expenses, positive for income), description, account_id (expense account for expenses, revenue account for income), category_id, customer_id (optional), vendor_id (optional), transaction_date, notes
For UPDATE_TRANSACTION, include: id, amount, description, account_id, category_id, customer_id, vendor_id, transaction_date, notes
For CREATE_BUDGET, include: name, amount, budget_type, category_id, start_date, end_date
For CREATE_CATEGORY, include: name, description, color
For CREATE_ACCOUNT, include: name, account_type, code
For CREATE_CUSTOMER, include: name, email, phone, company_name, customer_type ('customer' or 'client')
For CREATE_VENDOR, include: name, email, phone, company_name, vendor_type ('vendor' or 'supplier')

If you cannot perform an action or need more information, just provide a helpful response without the action structure.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://tgshonwmthturuxeceqr.supabase.co',
        'X-Title': 'AI Accountant',
      },
      body: JSON.stringify({
        model: 'google/gemma-3-27b-it',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    const aiData = await response.json();
    const aiResponse = aiData.choices[0].message.content;

    console.log('AI Response:', aiResponse);

    // Try to parse as JSON to see if it's an action
    let actionResult = null;
    try {
      // Clean the response by removing markdown code blocks if present
      let cleanResponse = aiResponse.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/\n?```$/g, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/g, '').replace(/\n?```$/g, '');
      }
      
      const parsedResponse = JSON.parse(cleanResponse);
      if (parsedResponse.action) {
        console.log('Performing action:', parsedResponse.action);
        actionResult = await performAction(parsedResponse, userId);
        console.log('Action result:', actionResult);
      }
    } catch (error) {
      console.log('Not a JSON action, treating as regular response:', error.message);
      // Not a JSON action, just a regular response
    }

    const finalResponse = actionResult ? actionResult.response : aiResponse;

    return new Response(JSON.stringify({ 
      response: finalResponse,
      actionPerformed: !!actionResult,
      actionType: actionResult?.action
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-accountant function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      response: "I apologize, but I encountered an error processing your request. Please try again."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processAttachments(attachments: any[], userId: string) {
  // For now, return placeholder data. In a full implementation, 
  // this would use OCR/document parsing to extract transaction data
  console.log('Processing attachments for user:', userId);
  
  // Placeholder for attachment processing
  return {
    detected_transactions: [
      {
        amount: 150.00,
        description: "Office supplies from receipt",
        vendor: "Office Depot",
        date: new Date().toISOString().split('T')[0]
      }
    ]
  };
}

async function performAction(parsedResponse: any, userId: string) {
  const { action, data } = parsedResponse;
  
  console.log('Performing action:', action, data);

  try {
    switch (action) {
      case 'CREATE_TRANSACTION':
        console.log('Creating transaction with data:', data);
        const { data: transaction, error: transactionError } = await supabase
          .from('transactions')
          .insert([{
            user_id: userId,
            amount: data.amount,
            description: data.description,
            account_id: data.account_id,
            category_id: data.category_id,
            customer_id: data.customer_id || null,
            vendor_id: data.vendor_id || null,
            transaction_date: data.transaction_date || new Date().toISOString().split('T')[0],
            notes: data.notes || '',
            status: 'cleared'
          }])
          .select()
          .single();

        if (transactionError) {
          console.error('Transaction creation error:', transactionError);
          throw transactionError;
        }
        
        console.log('Transaction created successfully:', transaction);
        
        return {
          action: 'CREATE_TRANSACTION',
          response: `✅ Transaction recorded successfully! Added ${data.amount > 0 ? 'income' : 'expense'} of $${Math.abs(data.amount)} for "${data.description}".`
        };

      case 'UPDATE_TRANSACTION':
        console.log('Updating transaction with data:', data);
        const { data: updatedTransaction, error: updateError } = await supabase
          .from('transactions')
          .update({
            amount: data.amount,
            description: data.description,
            account_id: data.account_id,
            category_id: data.category_id,
            customer_id: data.customer_id || null,
            vendor_id: data.vendor_id || null,
            transaction_date: data.transaction_date,
            notes: data.notes || ''
          })
          .eq('id', data.id)
          .eq('user_id', userId)
          .select()
          .single();

        if (updateError) {
          console.error('Transaction update error:', updateError);
          throw updateError;
        }
        
        console.log('Transaction updated successfully:', updatedTransaction);
        
        return {
          action: 'UPDATE_TRANSACTION',
          response: `✅ Transaction updated successfully! Modified ${data.amount > 0 ? 'income' : 'expense'} of $${Math.abs(data.amount)} for "${data.description}".`
        };

      case 'CREATE_BUDGET':
        const { data: budget, error: budgetError } = await supabase
          .from('budgets')
          .insert([{
            user_id: userId,
            name: data.name,
            amount: data.amount,
            budget_type: data.budget_type,
            category_id: data.category_id,
            start_date: data.start_date,
            end_date: data.end_date
          }])
          .select()
          .single();

        if (budgetError) throw budgetError;

        return {
          action: 'CREATE_BUDGET',
          response: `✅ Budget "${data.name}" created successfully! Set limit of $${data.amount} for ${data.budget_type} period.`
        };

      case 'CREATE_CATEGORY':
        const { data: category, error: categoryError } = await supabase
          .from('categories')
          .insert([{
            user_id: userId,
            name: data.name,
            description: data.description,
            color: data.color || '#6366f1'
          }])
          .select()
          .single();

        if (categoryError) throw categoryError;

        return {
          action: 'CREATE_CATEGORY',
          response: `✅ Category "${data.name}" created successfully!`
        };

      case 'CREATE_ACCOUNT':
        const { data: account, error: accountError } = await supabase
          .from('accounts')
          .insert([{
            user_id: userId,
            name: data.name,
            account_type: data.account_type,
            code: data.code
          }])
          .select()
          .single();

        if (accountError) throw accountError;

        return {
          action: 'CREATE_ACCOUNT',
          response: `✅ Account "${data.name}" created successfully!`
        };

      case 'CREATE_CUSTOMER':
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .insert([{
            user_id: userId,
            name: data.name,
            email: data.email || null,
            phone: data.phone || null,
            company_name: data.company_name || null,
            customer_type: data.customer_type || 'customer'
          }])
          .select()
          .single();

        if (customerError) throw customerError;

        return {
          action: 'CREATE_CUSTOMER',
          response: `✅ Customer "${data.name}" created successfully!`
        };

      case 'CREATE_VENDOR':
        const { data: vendor, error: vendorError } = await supabase
          .from('vendors')
          .insert([{
            user_id: userId,
            name: data.name,
            email: data.email || null,
            phone: data.phone || null,
            company_name: data.company_name || null,
            vendor_type: data.vendor_type || 'vendor'
          }])
          .select()
          .single();

        if (vendorError) throw vendorError;

        return {
          action: 'CREATE_VENDOR',
          response: `✅ Vendor "${data.name}" created successfully!`
        };

      default:
        return {
          action: action,
          response: parsedResponse.response || "Action completed successfully."
        };
    }
  } catch (error) {
    console.error('Error performing action:', error);
    return {
      action: action,
      response: `❌ Error performing action: ${error.message}`
    };
  }
}