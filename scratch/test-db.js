import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'REDACTED_SECRET',
  'REDACTED_SECRET'
);

async function run() {
  console.log('Fetching workspaces...');
  const { data: ws } = await supabase.from('viq_workspaces').select('*');
  console.log('Workspaces:', JSON.stringify(ws, null, 2));

  console.log('Fetching datasets...');
  const { data: ds } = await supabase.from('viq_datasets').select('*');
  console.log('Datasets:', JSON.stringify(ds, null, 2));

  console.log('Fetching queries...');
  const { data: qs } = await supabase.from('viq_queries').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('Recent Queries:', JSON.stringify(qs, null, 2));
}

run().catch(console.error);
