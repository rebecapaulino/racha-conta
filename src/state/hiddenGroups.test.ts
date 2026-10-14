import { beforeEach, describe, expect, it, vi } from 'vitest';

// A conta (Supabase) de mentira: guarda a lista ou falha (sem internet).
const account = { list: [] as string[], offline: false };
vi.mock('../auth/account', () => ({
  saveHiddenGroups: vi.fn(async (add: string[], remove: string[] = []) => {
    if (account.offline) throw new Error('sem internet');
    account.list = [...new Set([...account.list, ...add])].filter((g) => !remove.includes(g));
  }),
}));

const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
});

const { hideGroup, hiddenFor, loadHidden, pushHidden, unhideGroup } = await import('./hiddenGroups');
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  store.clear();
  account.list = [];
  account.offline = false;
});

describe('grupos excluídos da lista (conta + aparelho)', () => {
  it('excluir vai para a conta; no aparelho fica só até chegar lá', async () => {
    hideGroup('g1');
    expect(hiddenFor(null).has('g1')).toBe(true); // vale na hora
    await settle();
    expect(account.list).toEqual(['g1']);
    expect(loadHidden()).toEqual([]);
    expect(hiddenFor({ hiddenGroups: account.list }).has('g1')).toBe(true);
  });

  it('sem internet: vale neste aparelho e vai para a conta quando der', async () => {
    account.offline = true;
    hideGroup('g1');
    await settle();
    expect(loadHidden()).toEqual(['g1']);
    expect(account.list).toEqual([]);
    account.offline = false;
    pushHidden({ hiddenGroups: [] });
    await settle();
    expect(account.list).toEqual(['g1']);
    expect(loadHidden()).toEqual([]);
  });

  it('entrar de novo pelo convite tira da lista (e um aparelho antigo não esconde de novo)', async () => {
    hideGroup('g1');
    await settle();
    unhideGroup('g1');
    await settle();
    expect(account.list).toEqual([]);
    // Outro aparelho, que só tem a lista da conta: nada a reenviar.
    pushHidden({ hiddenGroups: [] });
    await settle();
    expect(account.list).toEqual([]);
    expect(hiddenFor({ hiddenGroups: account.list }).has('g1')).toBe(false);
  });
});
