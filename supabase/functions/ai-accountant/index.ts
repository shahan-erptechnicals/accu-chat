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

    const { data: recentTransactions } = await supabase
      .from('transactions')
      .select('*, accounts(name), categories(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    const systemPrompt = `You are an AI Accounting Assistant. You can perform actual database operations to help users manage their finances.

Available accounts: ${JSON.stringify(accounts?.map(a => ({ id: a.id, name: a.name, type: a.account_type })))}
Available categories: ${JSON.stringify(categories?.map(c => ({ id: c.id, name: c.name, color: c.color })))}
Recent transactions: ${JSON.stringify(recentTransactions?.slice(0, 3))}

${context}

You can perform these actions:
1. CREATE_TRANSACTION - Record new transactions
2. CREATE_BUDGET - Set up budgets
3. CREATE_CATEGORY - Add new categories
4. CREATE_ACCOUNT - Add new accounts
5. UPDATE_TRANSACTION - Modify existing transactions
6. ANALYZE_SPENDING - Provide financial insights

When users ask you to record transactions or perform actions, respond with a JSON object containing:
{
  "action": "ACTION_TYPE",
  "data": { /* relevant data */ },
  "response": "Human readable response"
}

For CREATE_TRANSACTION, include: amount, description, account_id, category_id, transaction_date, notes
For CREATE_BUDGET, include: name, amount, budget_type, category_id, start_date, end_date
For CREATE_CATEGORY, include: name, description, color
For CREATE_ACCOUNT, include: name, account_type, code

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
      const parsedResponse = JSON.parse(aiResponse);
      if (parsedResponse.action) {
        actionResult = await performAction(parsedResponse, userId);
      }
    } catch {
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
        const { data: transaction, error: transactionError } = await supabase
          .from('transactions')
          .insert([{
            user_id: userId,
            amount: data.amount,
            description: data.description,
            account_id: data.account_id,
            category_id: data.category_id,
            transaction_date: data.transaction_date || new Date().toISOString().split('T')[0],
            notes: data.notes,
            status: 'completed'
          }])
          .select()
          .single();

        if (transactionError) throw transactionError;
        
        return {
          action: 'CREATE_TRANSACTION',
          response: `✅ Transaction recorded successfully! Added ${data.amount > 0 ? 'income' : 'expense'} of $${Math.abs(data.amount)} for "${data.description}".`
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