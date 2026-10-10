// Conta de quem entrou com Google. O login é pelo botão oficial do Google (Google Identity
// Services): ele devolve um token, que o Supabase confere e transforma em sessão.
// Por que não o redirecionamento: no iPhone com o app instalado ele abre o Safari e a
// pessoa fica logada fora do app. Só roda no aparelho.

import { useSyncExternalStore } from 'react';
import type { Session } from '@supabase/supabase-js';
import { GOOGLE_CLIENT_ID } from './google';
import { supabase } from './supabase';

/** O login só é exigido quando tudo está configurado (no computador sem as chaves, o app abre direto). */
export const loginEnabled = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
  GOOGLE_CLIENT_ID
);

export interface Account {
  id: string;
  name: string;
  email: string;
  /** Foto do perfil Google, se houver. */
  photo: string | null;
}

export interface AccountState {
  account: Account | null;
  /** Já olhamos se havia sessão guardada no aparelho? */
  ready: boolean;
}

const SERVER: AccountState = { account: null, ready: false };
let state: AccountState = SERVER;
let started = false;
const listeners = new Set<() => void>();

function toAccount(session: Session | null): Account | null {
  const u = session?.user;
  if (!u) return null;
  const m = (u.user_metadata ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const email = u.email ?? '';
  return {
    id: u.id,
    name: text(m.full_name) ?? text(m.name) ?? (email.split('@')[0] || 'Você'),
    email,
    photo: text(m.avatar_url) ?? text(m.picture),
  };
}

/**
 * Sessão guardada no aparelho, lida direto do armazenamento. Serve para quem já entrou
 * abrir o app no bar sem internet (a renovação da sessão precisa de rede).
 */
function storedAccount(): Account | null {
  try {
    const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname.split('.')[0];
    const raw = localStorage.getItem(`sb-${ref}-auth-token`);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.user ? toAccount(parsed as Session) : null;
  } catch {
    return null;
  }
}

function set(next: AccountState) {
  state = next;
  listeners.forEach((l) => l());
}

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const sb = supabase();
  if (!sb) {
    state = { account: null, ready: true };
    return;
  }
  // Escuta entrada e saída (inclusive em outra aba) e a renovação automática da sessão.
  const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
  sb.auth.onAuthStateChange((event, session) => {
    // Sem internet a renovação falha; não tira a pessoa do app por isso.
    const account = toAccount(session) ?? (event !== 'SIGNED_OUT' && offline() ? storedAccount() : null);
    set({ account, ready: true });
  });
  sb.auth.getSession().then(
    ({ data }) => set({ account: toAccount(data.session) ?? (offline() ? storedAccount() : null), ready: true }),
    () => set({ account: storedAccount(), ready: true }),
  );
  // Rede muito lenta: não deixa a pessoa presa na abertura.
  setTimeout(() => {
    if (!state.ready) set({ account: storedAccount(), ready: true });
  }, 4000);
}

function subscribe(l: () => void) {
  start();
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAccount(): AccountState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER);
}

/** Troca o token do Google por uma sessão do Supabase. `nonce` é o valor ORIGINAL (sem hash). */
export async function signInWithGoogleToken(token: string, nonce: string): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error('Login indisponível neste momento.');
  const { error } = await sb.auth.signInWithIdToken({ provider: 'google', token, nonce });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase()?.auth.signOut();
}
