import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'REDACTED_SECRET',
  'REDACTED_SECRET'
);

async function run() {
  console.log('Fetching queries or datasets...');
  const { data: ds } = await supabase.from('viq_datasets').select('*').eq('id', 11).single();
  console.log('Dataset 11 columns:', ds?.columns_meta);
  
  // Wait, let's see what rows are stored. Oh, wait! The actual rows of the datasets are stored locally in the browser's IndexedDB, or simulated.
  // Wait! Are there any rows in Supabase for viq_queries? Let's check.
  const { data: qs } = await supabase.from('viq_queries').select('*').limit(3);
  console.log('Sample Queries in DB:', qs);
}

run().catch(console.error);
