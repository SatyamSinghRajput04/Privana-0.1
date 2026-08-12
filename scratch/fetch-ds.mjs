import { createClient } from '@supabase/supabase-js';

const url = 'REDACTED_SECRET';
const key = 'REDACTED_SECRET';

const supabase = createClient(url, key);

async function main() {
  console.log('Fetching datasets...');
  const { data, error } = await supabase.from('viq_datasets').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Datasets found:', JSON.stringify(data, null, 2));
  }
}

main();
