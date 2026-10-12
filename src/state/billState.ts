// Estado da tela: a conta + se é a mesa de exemplo + próxima cor de pessoa,
// mais o que identifica o rolê no histórico (id, quando começou e a foto).
// Salvo no aparelho; se o armazenamento falhar, o app segue funcionando em memória.

import {
  MAX_ITEM_NAME,
  MAX_NAME,
  MAX_QTY,
  computeSplit,
  itemTotal,
  PERSON_COLORS,
  SERVICE_OPTIONS,
  removePerson,
  type Bill,
  type ServicePct,
} from '../core/bill';
import { formatBRL } from '../core/money';

/** Uma linha do registro de alterações da conta. */
export interface LogEntry {
  at: number;
  /** Quem fez. Vazio no modo solo; no compartilhado, o nome da conta Google. */
  by: string | null;
  kind: Action['type'];
  text: string;
}

const MAX_LOG = 500;

export interface AppState {
  id: string;
  startedAt: number;
  /** Chave da foto guardada no aparelho (IndexedDB), ou null sem foto. */
  photoId: string | null;
  bill: Bill;
  /** Registro de alterações, do mais antigo para o mais novo. */
  log: LogEntry[];
  example: boolean;
  nextColor: number;
}

export type Action =
  | { type: 'title'; title: string }
  | { type: 'addPerson'; name: string }
  | { type: 'removePerson'; id: string }
  | { type: 'addItem'; name: string; cents: number }
  /** Itens lidos da foto da nota: somam aos atuais ou trocam por eles; pode trazer o serviço da nota. */
  | { type: 'addItems'; items: { name: string; cents: number; qty: number }[]; replace: boolean; servicePct?: ServicePct }
  | { type: 'removeItem'; id: string }
  | { type: 'qty'; id: string; delta: 1 | -1 }
  | { type: 'toggle'; itemId: string; personId: string }
  | { type: 'toggleAll'; itemId: string }
  | { type: 'service'; pct: ServicePct }
  | { type: 'payer'; id: string | null }
  /** Marca/desmarca que a pessoa já pagou a parte dela (guarda o valor atual). */
  | { type: 'markPaid'; personId: string; paid: boolean }
  | { type: 'photo'; photoId: string | null }
  | { type: 'reset' }
  | { type: 'open'; state: AppState };

const KEY = 'racha-conta-v1';

let seq = 0;
export function newId(): string {
  seq += 1;
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + seq;
}

export function blankState(): AppState {
  return {
    id: newId(),
    startedAt: Date.now(),
    photoId: null,
    log: [],
    bill: { title: '', servicePct: 10, payerId: null, people: [], items: [] },
    example: false,
    nextColor: 0,
  };
}

export function exampleState(): AppState {
  // Ids fixos: o servidor e o aparelho precisam gerar exatamente a mesma mesa.
  const people = ['Ana', 'Bruno', 'Carla', 'Diego'].map((name, color) => ({ id: 'ex-p' + color, name, color }));
  const [a, b, c, d] = people.map((p) => p.id);
  const all = [a, b, c, d];
  return {
    id: 'exemplo',
    startedAt: Date.now(),
    photoId: null,
    log: [],
    example: true,
    nextColor: people.length,
    bill: {
      title: 'Sexta no Bar do Zé',
      servicePct: 10,
      payerId: b,
      people,
      items: [
        { id: 'ex-i0', name: 'Porção de fritas', cents: 3600, who: [...all] },
        { id: 'ex-i1', name: 'Picanha na chapa', cents: 14200, who: [...all] },
        { id: 'ex-i2', name: 'Caipirinha', cents: 2200, qty: 2, who: [a, c] },
        { id: 'ex-i3', name: 'Chopp', cents: 1450, qty: 3, who: [b, d] },
        { id: 'ex-i4', name: 'Pudim', cents: 2100, who: [a, c, d] },
      ],
    },
  };
}

function apply(state: AppState, action: Action): AppState {
  const { bill } = state;
  const next = (b: Partial<AppState['bill']>, extra: Partial<AppState> = {}): AppState => ({
    ...state,
    ...extra,
    example: false,
    bill: { ...bill, ...b },
  });

  switch (action.type) {
    case 'title':
      return next({ title: action.title });

    case 'addPerson': {
      const name = action.name.trim().slice(0, MAX_NAME);
      if (!name) return state;
      const person = { id: newId(), name, color: state.nextColor % PERSON_COLORS };
      return next({ people: [...bill.people, person] }, { nextColor: state.nextColor + 1 });
    }

    case 'removePerson':
      return { ...state, example: false, bill: removePerson(bill, action.id) };

    case 'addItem': {
      const name = action.name.trim();
      if (!name || !(action.cents > 0)) return state;
      // Item novo começa com todo mundo marcado.
      const item = { id: newId(), name, cents: action.cents, who: bill.people.map((p) => p.id) };
      return next({ items: [...bill.items, item] });
    }

    case 'addItems': {
      const read = action.items
        .map((i) => ({ name: i.name.trim().slice(0, MAX_ITEM_NAME), cents: i.cents, qty: Math.min(MAX_QTY, Math.max(1, Math.round(i.qty))) }))
        .filter((i) => i.name && Number.isSafeInteger(i.cents) && i.cents > 0);
      if (!read.length) return state;
      // A mesa de exemplo é de mentira: a nota de verdade começa uma conta nova.
      const base = state.example ? blankState() : state;
      const everyone = base.bill.people.map((p) => p.id);
      const items = read.map((i) => ({ id: newId(), name: i.name, cents: i.cents, ...(i.qty > 1 ? { qty: i.qty } : {}), who: [...everyone] }));
      return {
        ...base,
        example: false,
        bill: {
          ...base.bill,
          items: action.replace ? items : [...base.bill.items, ...items],
          servicePct: action.servicePct ?? base.bill.servicePct,
        },
      };
    }

    case 'removeItem':
      return next({ items: bill.items.filter((i) => i.id !== action.id) });

    case 'qty': {
      const it = bill.items.find((i) => i.id === action.id);
      if (!it) return state;
      const qty = Math.min(MAX_QTY, Math.max(1, (it.qty ?? 1) + action.delta));
      if (qty === (it.qty ?? 1)) return state;
      return next({ items: bill.items.map((i) => (i.id === it.id ? { ...i, qty } : i)) });
    }

    case 'toggle':
      return next({
        items: bill.items.map((it) =>
          it.id !== action.itemId
            ? it
            : {
                ...it,
                who: it.who.includes(action.personId)
                  ? it.who.filter((id) => id !== action.personId)
                  : [...it.who, action.personId],
              },
        ),
      });

    case 'toggleAll':
      return next({
        items: bill.items.map((it) => {
          if (it.id !== action.itemId) return it;
          const everyone = bill.people.map((p) => p.id);
          const full = everyone.every((id) => it.who.includes(id));
          return { ...it, who: full ? [] : everyone };
        }),
      });

    case 'service':
      return next({ servicePct: action.pct });

    case 'payer':
      return next({ payerId: action.id });

    case 'markPaid': {
      const share = computeSplit(bill).shares.find((s) => s.person.id === action.personId);
      if (!share) return state;
      const paid = { ...bill.paid };
      if (action.paid) paid[action.personId] = share.total;
      else if (action.personId in paid) delete paid[action.personId];
      else return state;
      return next({ paid });
    }

    case 'photo':
      return { ...state, example: false, photoId: action.photoId };

    case 'reset':
      return blankState();

    case 'open':
      return action.state;
  }
}

const qtyName = (name: string, qty = 1) => (qty > 1 ? `${qty}× ${name}` : name);

/** Frase do registro para a ação, olhando o estado de antes (para ter os nomes). */
function describe(before: AppState, after: AppState, action: Action): string | null {
  const { bill } = before;
  const person = (id: string | null) => bill.people.find((p) => p.id === id)?.name ?? 'alguém';
  const item = (id: string) => bill.items.find((i) => i.id === id);

  switch (action.type) {
    case 'title':
      return action.title.trim() ? `Mudou o nome do lugar para "${action.title.trim()}"` : 'Apagou o nome do lugar';
    case 'addPerson':
      return `Adicionou ${after.bill.people.at(-1)!.name} à mesa`;
    case 'removePerson':
      return `Tirou ${person(action.id)} da mesa`;
    case 'addItem': {
      const it = after.bill.items.at(-1)!;
      return `Adicionou ${it.name} · ${formatBRL(it.cents)}`;
    }
    case 'addItems': {
      const added = action.replace ? after.bill.items : after.bill.items.slice(before.example ? 0 : bill.items.length);
      const n = added.length;
      const sum = added.reduce((t, i) => t + itemTotal(i), 0);
      const parts = [`Leu a nota fiscal: ${n} ${n === 1 ? 'item' : 'itens'} · ${formatBRL(sum)}`];
      if (action.replace && !before.example && bill.items.length) parts.push('no lugar dos itens anteriores');
      if (action.servicePct !== undefined && action.servicePct !== bill.servicePct) parts.push(`serviço em ${action.servicePct}%`);
      return parts.join(' · ');
    }
    case 'removeItem': {
      const it = item(action.id)!;
      return `Removeu ${qtyName(it.name, it.qty)} · ${formatBRL(itemTotal(it))}`;
    }
    case 'qty': {
      const it = item(action.id)!;
      const q = after.bill.items.find((i) => i.id === action.id)!.qty ?? 1;
      return `${action.delta > 0 ? 'Mais um' : 'Um a menos'}: ${it.name} (agora ${q}×)`;
    }
    case 'toggle': {
      const it = item(action.itemId)!;
      const had = it.who.includes(action.personId);
      return had ? `Desmarcou ${person(action.personId)} de ${it.name}` : `Marcou ${person(action.personId)} em ${it.name}`;
    }
    case 'toggleAll': {
      const it = after.bill.items.find((i) => i.id === action.itemId)!;
      return it.who.length ? `Marcou todos em ${it.name}` : `Desmarcou todos de ${it.name}`;
    }
    case 'service':
      return action.pct ? `Serviço em ${action.pct}%` : 'Tirou o serviço';
    case 'payer':
      return action.id ? `${person(action.id)} pagou a conta` : 'Tirou quem pagou';
    case 'markPaid':
      return action.paid
        ? `${person(action.personId)} pagou ${formatBRL(after.bill.paid?.[action.personId] ?? 0)}`
        : `Desmarcou o pagamento de ${person(action.personId)}`;
    case 'photo':
      return !action.photoId ? 'Removeu a foto' : before.photoId ? 'Trocou a foto' : 'Adicionou a foto';
    default:
      return null;
  }
}

const TITLE_MERGE_MS = 2 * 60 * 1000;

export function reducer(state: AppState, action: Action): AppState {
  const after = apply(state, action);
  if (after === state || action.type === 'reset' || action.type === 'open') return after;
  const text = describe(state, after, action);
  if (!text) return after;

  const entry: LogEntry = { at: Date.now(), by: null, kind: action.type, text };
  let log = state.log;
  // Digitar o nome gera uma linha por letra: junta numa só enquanto a pessoa digita.
  const last = log.at(-1);
  if (action.type === 'title' && last?.kind === 'title' && entry.at - last.at < TITLE_MERGE_MS) log = log.slice(0, -1);
  log = [...log, entry].slice(-MAX_LOG);
  return { ...after, log };
}

export function isValidBill(b: unknown): b is Bill {
  const x = b as Bill;
  return (
    !!x &&
    typeof x.title === 'string' &&
    Array.isArray(x.people) &&
    Array.isArray(x.items) &&
    (SERVICE_OPTIONS as readonly number[]).includes(x.servicePct) &&
    x.people.every((p) => typeof p.id === 'string' && typeof p.name === 'string') &&
    x.items.every(
      (i) =>
        typeof i.id === 'string' &&
        Number.isSafeInteger(i.cents) &&
        i.cents > 0 &&
        Array.isArray(i.who) &&
        (i.qty === undefined || (Number.isSafeInteger(i.qty) && i.qty >= 1 && i.qty <= MAX_QTY)),
    ) &&
    (x.paid === undefined ||
      (typeof x.paid === 'object' && x.paid !== null && Object.values(x.paid).every((v) => Number.isSafeInteger(v))))
  );
}

/** Completa o que versões antigas não salvavam (id, data e foto). */
function upgrade(x: Partial<AppState> & { bill: Bill }): AppState {
  return {
    id: typeof x.id === 'string' ? x.id : newId(),
    startedAt: typeof x.startedAt === 'number' ? x.startedAt : Date.now(),
    photoId: typeof x.photoId === 'string' ? x.photoId : null,
    bill: x.bill,
    log: validLog(x.log),
    example: !!x.example,
    nextColor: typeof x.nextColor === 'number' ? x.nextColor : x.bill.people.length,
  };
}

export function validLog(log: unknown): LogEntry[] {
  if (!Array.isArray(log)) return [];
  return log.filter((e) => !!e && typeof e.at === 'number' && typeof e.text === 'string');
}

/** A conta tem algo que vale guardar no histórico? (o exemplo intocado não conta) */
export function worthKeeping(s: AppState): boolean {
  return !s.example && (s.bill.people.length > 0 || s.bill.items.length > 0 || s.photoId !== null);
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && isValidBill(parsed.bill)) return upgrade(parsed);
    }
  } catch {
    /* armazenamento indisponível ou dado corrompido: começa com o exemplo */
  }
  return exampleState();
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* modo privado ou cota cheia: segue só em memória */
  }
}
