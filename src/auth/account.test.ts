import { beforeEach, describe, expect, it, vi } from 'vitest';

// O Supabase de mentira: sem internet, sair devolve erro e não apaga a sessão (como o de verdade).
const sb = { offline: false, leftWhenCalled: false };
vi.mock('./supabase', () => ({
  supabase: () => ({
    auth: {
      signOut: async () => {
        sb.leftWhenCalled = store.get(LEFT) === '1';
        if (sb.offline) return { error: new Error('sem internet') };
        store.delete(SESSION);
        return { error: null };
      },
      signInWithIdToken: async () => ({ error: null }),
    },
  }),
}));

const LEFT = 'racha-saiu-da-conta-v1';
const SESSION = 'sb-teste-auth-token';
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
});
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://teste.supabase.co');

const { leftOnPurpose, signInWithGoogleToken, signOut } = await import('./account');

beforeEach(() => {
  store.clear();
  store.set(SESSION, '{}');
  sb.offline = false;
  sb.leftWhenCalled = false;
});

describe('sair da conta', () => {
  it('marca a saída antes de encerrar a sessão (a tela de login abre nessa hora)', async () => {
    expect(leftOnPurpose()).toBe(false);
    await signOut();
    expect(sb.leftWhenCalled).toBe(true);
    expect(leftOnPurpose()).toBe(true);
    expect(store.has(SESSION)).toBe(false);
  });

  it('sem internet, apaga a sessão do aparelho mesmo assim', async () => {
    sb.offline = true;
    await signOut();
    expect(store.has(SESSION)).toBe(false);
    expect(leftOnPurpose()).toBe(true);
  });

  it('entrar de novo tira a marca', async () => {
    await signOut();
    await signInWithGoogleToken('token', 'nonce');
    expect(leftOnPurpose()).toBe(false);
  });
});
