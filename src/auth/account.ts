// Conta de quem entrou com Google. O login é pelo botão oficial do Google (Google Identity
// Services): ele devolve um token, que o Supabase confere e transforma em sessão.
// Por que não o redirecionamento: no iPhone com o app instalado ele abre o Safari e a
// pessoa fica logada fora do app. Só roda no aparelho.

import { useSyncExternalStore } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

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
  sb.auth.onAuthStateChange((_event, session) => set({ account: toAccount(session), ready: true }));
  sb.auth.getSession().then(
    ({ data }) => set({ account: toAccount(data.session), ready: true }),
    () => set({ account: null, ready: true }),
  );
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
