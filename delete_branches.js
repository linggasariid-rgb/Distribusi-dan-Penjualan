import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const TO_DELETE = ['GUDANG BANDUNG', 'GUDANG TASIKMALAYA', 'BANYUMAS', 'GUDANG CIBADUYUT']; // just in case

async function run() {
  await supabase.from('stock').delete().in('cabang', TO_DELETE);
  await supabase.from('penjualan_who').delete().in('cabang', TO_DELETE);
  await supabase.from('distribusi').delete().in('tujuan', TO_DELETE);
  await supabase.from('distribusi').delete().in('cabang', TO_DELETE);
  await supabase.from('distribusi').delete().in('gudang', TO_DELETE);
  await supabase.from('penerimaan').delete().in('gudang', TO_DELETE);
  await supabase.from('penerimaan').delete().in('cabang', TO_DELETE);

  const { data, error } = await supabase
    .from('branches')
    .delete()
    .in('name', TO_DELETE);

  if (error) {
    console.error('Error deleting branches:', error);
  } else {
    console.log('Successfully deleted branches.');
  }
}

run();
