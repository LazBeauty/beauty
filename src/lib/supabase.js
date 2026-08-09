import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Недостасуваат VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Провери .env.local (за локален развој) или Environment Variables во Vercel (за продукција).'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
