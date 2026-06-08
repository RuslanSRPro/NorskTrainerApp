import { supabase } from '../services/supabase';

async function test() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*');

  console.log('DATA:', data);
  console.log('ERROR:', error);
}

test();