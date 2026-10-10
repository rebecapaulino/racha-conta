// Conexão com o Supabase (login e, na Fase 2, os rolês compartilhados).
// Só usa a chave PÚBLICA (publishable): quem protege os dados são as regras do banco.
// Sem as variáveis de ambiente, devolve null e o app segue funcionando sozinho.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key, {
    // O login é pelo botão do Google (token), não por redirecionamento.
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}
