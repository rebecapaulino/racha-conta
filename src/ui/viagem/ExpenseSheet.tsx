import { useEffect, useRef, useState, type Dispatch, type FormEvent } from 'react';
import { formatBRL, parseBRL } from '../../core/money';
import {
  accountOf,
  categoryLabel,
  expensePhotos,
  findDuplicate,
  installmentInfo,
  installmentsOf,
  joinSchedule,
  MAX_DESCRIPTION,
  partsOf,
  startOf,
  startSchedule,
  MAX_INSTALLMENTS,
  photoFields,
  splitExpense,
  splitLike,
  TRIP_CATEGORIES,
  tripDrift,
  tripSummary,
  type Expense,
  type ExpenseInput,
  type JoinMode,
  type SplitMode,
  type Trip,
  type TripCategory,
} from '../../core/trip';
import { newId } from '../../state/billState';
import { todayISO, type TripAction } from '../../state/tripState';
import { Avatar, personStyle } from '../Avatar';
import { IconAlert, IconCheck, IconMinus, IconPlus, IconTrash } from '../icons';
import { CategoryIcon } from './CategoryIcon';
import { ReceiptField, totalText } from './ReceiptField';
import { Sheet } from './Sheet';
import { dayLabel } from './tripDates';

export type ExpenseMode =
  | { kind: 'new'; payerId?: string; /** Foto da nota tirada no "Ler nota fiscal" (já guardada). */ scan?: { id: string; blob: Blob } }
  | { kind: 'edit'; expense: Expense };

interface Props {
  trip: Trip;
  meId: string | null;
  mode: ExpenseMode | null;
  dispatch: Dispatch<TripAction>;
  toast: (msg: string, undo?: () => void) => void;
  onClose: () => void;
  /** Depois de lançar ou salvar (para mostrar a caderneta). */
  onSaved?: () => void;
  /** Grupo da viagem compartilhada (para ver a foto da nota que outra pessoa tirou). */
  groupId?: string | null;
}

/** Lançar ou editar uma despesa, em etapas: valor, categoria, quem pagou e quem participa. */
export function ExpenseSheet({ mode, onClose, ...rest }: Props) {
  return (
    <Sheet open={!!mode} onClose={onClose} labelledBy="h-expense" className="expense-sheet" focus={mode?.kind === 'new' ? '#exp-amount' : 'h2'}>
      {mode && <ExpenseForm key={mode.kind === 'edit' ? mode.expense.id : 'new'} mode={mode} onClose={onClose} {...rest} />}
    </Sheet>
  );
}

type StepKey = 'valor' | 'categoria' | 'pagamento' | 'conta' | 'quem' | 'divisao';

/** As etapas, na ordem: o nome vai no rótulo da barra do alto, a pergunta é o título da etapa. */
const ALL_STEPS: { key: StepKey; name: string; title: string }[] = [
  { key: 'valor', name: 'Valor', title: 'Quanto foi?' },
  { key: 'categoria', name: 'Categoria', title: 'Qual a categoria?' },
  { key: 'pagamento', name: 'Pagamento', title: 'Quem pagou?' },
  { key: 'conta', name: 'Conta', title: 'Alguém paga junto?' },
  { key: 'quem', name: 'Pessoas', title: 'Quem participa?' },
  { key: 'divisao', name: 'Divisão', title: 'Como dividir?' },
];

/** "1.072,48": centavos no formato de digitar (sem o "R$"). */
const typed = (cents: number) => formatBRL(cents).replace(/^R\$\s?/, '');

function ExpenseForm({ trip, meId, mode, dispatch, toast, onClose, onSaved, groupId = null }: Props & { mode: ExpenseMode }) {
  const editing = mode.kind === 'edit' ? mode.expense : null;
  const people = trip.people;
  const amountRef = useRef<HTMLInputElement>(null);
  const dupRef = useRef<HTMLParagraphElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Categoria nova começa na última usada: quem está no mercado costuma lançar mercado de novo.
  const lastCategory = [...trip.expenses].reverse().find((e) => !e.deleted)?.category ?? 'alimentacao';
  const defaultPayer =
    (mode.kind === 'new' && mode.payerId) || (meId && people.some((p) => p.id === meId) ? meId : people[0]?.id ?? '');

  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState(editing ? typed(editing.cents) : '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const scan = mode.kind === 'new' ? mode.scan ?? null : null;
  // Fotos da despesa (nota, print da compra, comprovante): anexar soma, cada uma sai no X dela.
  const [photos, setPhotos] = useState<string[]>(() => (editing ? expensePhotos(editing) : scan ? [scan.id] : []));
  // Total lido na foto da nota: preenche o valor (se vazio) ou oferece "Usar".
  const [readTotal, setReadTotal] = useState<{ cents: number | null } | null>(null);
  const [category, setCategory] = useState<TripCategory>(editing?.category ?? lastCategory);
  const [payerId, setPayerId] = useState(editing?.payerId ?? defaultPayer);
  const [who, setWho] = useState<string[]>(editing?.people ?? people.map((p) => p.id));
  const [split, setSplit] = useState<SplitMode>(editing?.split ?? 'equal');
  const [exact, setExact] = useState<Record<string, string>>(() =>
    editing?.split === 'exact' ? Object.fromEntries(Object.entries(editing.shares).map(([id, c]) => [id, typed(c)])) : {},
  );
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [parts, setParts] = useState(editing ? installmentsOf(editing) : 1);
  // Parcela em que a despesa começa a ser dividida (ex.: os cachorros, que a Deise assumiu na 2ª).
  const [startAt, setStartAt] = useState(editing ? startOf(editing) : 1);
  const from = parts > 1 ? Math.min(startAt, parts) : 1;
  const count = parts - from + 1;
  // À vista cobrada junto com a parcela de outra despesa do mesmo pagador (os cachorros na 2ª do Airbnb).
  const [along, setAlong] = useState<{ expenseId: string; installment: number } | null>(editing?.alongWith ?? null);
  const [dupOk, setDupOk] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Alguém entrou numa despesa parcelada já em andamento: quantas parcelas passaram (null: ainda não perguntou).
  const [elapsed, setElapsed] = useState<number | null>(null);
  // "Alguém entrou depois?": quem já está na despesa, mas só entrou numa parcela (null: não perguntou).
  const [late, setLate] = useState<string[] | null>(null);
  const joinRef = useRef<HTMLDivElement>(null);

  // Quem pagou também paga a parte de alguém? Vale só nesta despesa (padrão) ou na viagem toda,
  // como a pessoa escolher. Quem já está na conta de quem pagou na viagem toda não aparece.
  // Só é gravado ao lançar. Sem ninguém para escolher, a etapa nem aparece.
  const payerAccount = accountOf(trip, payerId);
  // Quem já está na conta de quem pagou na viagem toda: aparece marcado, e dá para desativar
  // (a pessoa volta a pagar a própria parte; aí dá para escolher "Só nesta despesa").
  const tripMembers = people.filter((p) => p.coveredBy === payerId);
  const [dropTrip, setDropTrip] = useState<string[]>([]);
  const dropped = dropTrip.filter((id) => tripMembers.some((p) => p.id === id));
  const keptTrip = tripMembers.filter((p) => !dropped.includes(p.id));
  const candidates = people.filter((p) => accountOf(trip, p.id) !== payerAccount || dropped.includes(p.id));
  const fromEditing = editing ? Object.keys(editing.coveredBy ?? {}).filter((id) => editing.coveredBy![id] === payerId) : [];
  const [pick, setPick] = useState<{ payer: string; ids: string[]; scope: 'expense' | 'trip' } | null>(null);
  const cover =
    pick && pick.payer === payerId
      ? { ...pick, ids: pick.ids.filter((id) => candidates.some((p) => p.id === id)) }
      : { payer: payerId, ids: fromEditing.filter((id) => candidates.some((p) => p.id === id)), scope: 'expense' as const };
  const toggleCover = (id: string) =>
    setPick({ ...cover, ids: cover.ids.includes(id) ? cover.ids.filter((x) => x !== id) : [...cover.ids, id] });

  const steps = ALL_STEPS.filter((s) => s.key !== 'conta' || candidates.length > 0 || tripMembers.length > 0);
  const LAST = steps.length - 1;
  const at = Math.min(step, LAST);
  const key = steps[at].key;
  // Editando, todas as etapas já estão abertas: dá para ir direto na que precisa mudar.
  const [reached, setReached] = useState(editing ? 99 : 0);

  // Ao trocar de etapa, o foco vai para a pergunta (o leitor de tela anuncia onde está).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    titleRef.current?.focus();
  }, [at]);

  const cents = parseBRL(amount);
  const seq = editing?.seq ?? trip.nextSeq;
  const exactCents = (id: string) => {
    const t = (exact[id] ?? '').trim();
    if (!t || /^0+([.,]0*)?$/.test(t)) return 0;
    return parseBRL(t);
  };
  const input: ExpenseInput = {
    description: description.trim() || categoryLabel(trip, category),
    cents: cents ?? 0,
    date,
    category,
    payerId,
    split,
    people: who,
    ...(split === 'exact' ? { exact: Object.fromEntries(who.map((id) => [id, exactCents(id) ?? -1])) } : {}),
    ...(parts > 1 ? { installments: parts } : {}),
    ...(parts === 1 && alongTargetOf() ? { alongWith: along! } : {}),
    ...photoFields(photos),
    ...(cover.scope === 'expense' && cover.ids.some((id) => who.includes(id))
      ? { coveredBy: Object.fromEntries(cover.ids.filter((id) => who.includes(id)).map((id) => [id, payerId])) }
      : {}),
  };
  // Exemplo de parcela: a parte de alguém que não pagou (de preferência quem usa o celular).
  function sampleInstallment() {
    if (parts < 2 || !preview?.ok) return null;
    const ids = Object.keys(preview.shares).filter((id) => id !== payerId && preview.shares[id] > 0);
    const id = ids.includes(meId ?? '') ? meId! : ids[0];
    if (!id) return null;
    return { id, share: preview.shares[id], first: installmentInfo(preview.shares[id], 0, count).parts[0] };
  }
  // Centavos das outras despesas: o que sobra nesta vai para quem está atrás (igual ao que é salvo).
  const drift = tripDrift(trip, editing?.id);
  const preview = cents ? splitExpense(input, people, seq, drift) : null;
  const installment = sampleInstallment();
  const duplicate = cents ? findDuplicate(trip, { cents, date }, editing?.id) : null;

  // "Por peso" saiu (confundia). Só volta para quem edita uma despesa antiga que já usava.
  const splits: { id: SplitMode; label: string }[] = [
    { id: 'equal', label: 'Igual' },
    { id: 'exact', label: 'Valores exatos' },
    ...(editing?.split === 'weight' ? [{ id: 'weight' as const, label: 'Por peso' }] : []),
  ];

  const toggle = (id: string) => setWho((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  const allOn = people.length > 0 && people.every((p) => who.includes(p.id));

  function chooseSplit(next: SplitMode) {
    // Valores exatos começam com a divisão igual: é só ajustar quem gastou diferente.
    if (next === 'exact' && cents && who.length) {
      const base = splitExpense({ ...input, split: 'equal' }, people, seq, drift);
      if (base.ok) setExact(Object.fromEntries(Object.entries(base.shares).map(([id, c]) => [id, typed(c)])));
    }
    setSplit(next);
    setError('');
  }

  // Quanto falta (ou passou) para os valores exatos fecharem a despesa.
  const exactSum = who.reduce((a, id) => a + Math.max(0, exactCents(id) ?? 0), 0);
  const exactDiff = (cents ?? 0) - exactSum;

  function go(to: number) {
    setError('');
    setConfirmDelete(false);
    setStep(to);
    setReached((r) => Math.max(r, to));
  }

  /** Sem valor não dá para seguir: volta para a primeira etapa e avisa. */
  function needAmount() {
    if (cents) return false;
    setStep(0);
    setError('Digite o valor da despesa.');
    amountRef.current?.focus();
    return true;
  }

  function next() {
    if (key === 'valor' && needAmount()) return;
    if (key === 'valor') setAmount(typed(cents!));
    if (key === 'quem' && who.length === 0) {
      setError('Escolha pelo menos uma pessoa.');
      return;
    }
    go(at + 1);
  }

  // Quem entrou ou saiu agora de uma despesa parcelada (editando, mesmo número de parcelas, sem valores exatos).
  const sameParts = !!editing && installmentsOf(editing) > 1 && parts === installmentsOf(editing);
  const joined = sameParts ? who.filter((id) => !editing!.people.includes(id)) : [];
  const leaving = sameParts && who.length ? editing!.people.filter((id) => !who.includes(id)) : [];

  /** Parcelas que já passaram: as registradas como pagas no acerto ou os meses desde a compra (a maior). */
  /** Despesas parceladas do mesmo pagador com que esta pode ser cobrada junto. */
  function alongOptions(): Expense[] {
    return trip.expenses.filter((x) => !x.deleted && !x.settled && installmentsOf(x) > 1 && x.payerId === payerId && x.id !== editing?.id);
  }
  /** A escolhida, se ainda vale (mesmo pagador, parcela dentro do número de parcelas). */
  function alongTargetOf(): Expense | null {
    if (!along) return null;
    const t = alongOptions().find((x) => x.id === along.expenseId);
    return t && along.installment >= 1 && along.installment <= installmentsOf(t) ? t : null;
  }

  function guessElapsed(e: Expense): number {
    const n = installmentsOf(e);
    const rows = tripSummary(trip).plan.direct.filter((r) => r.expenseId === e.id);
    const paid = Math.max(0, ...rows.map((r) => installmentInfo(r.cents, r.paid, n, r.parts).paidCount));
    const [y, m] = e.date.split('-').map(Number);
    const now = new Date();
    const months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
    return Math.max(0, Math.min(n - 1, Math.max(paid, months)));
  }

  /**
   * "Alguém entrou depois": a despesa como era antes de quem entrou (dividida sem essas pessoas,
   * em parcelas iguais), para a conta de "a partir de qual parcela".
   */
  function lateBase(): Expense | null {
    if (!editing || !late?.length || joined.length || leaving.length) return null;
    const before = { ...editing, people: editing.people.filter((id) => !late.includes(id)) };
    const shares = splitLike(before, people, editing.seq, editing.cents, drift);
    if (!shares) return null;
    const base: Expense = { ...before, shares };
    delete base.schedule;
    return base;
  }

  function startLate() {
    if (!editing) return;
    setLate([]);
    setElapsed(Math.max(1, guessElapsed(editing)));
    requestAnimationFrame(() => joinRef.current?.focus());
  }

  /** `even`: "desde a 1ª" para quem já estava na despesa: volta às parcelas iguais para todos. */
  function save(mode?: JoinMode | 'even') {
    if (needAmount()) return;
    const r = splitExpense(input, people, seq, drift);
    if (!r.ok) {
      go(who.length === 0 ? steps.findIndex((x) => x.key === 'quem') : LAST);
      setError(r.error);
      return;
    }
    if (duplicate && !dupOk) {
      if (at !== LAST) go(LAST);
      setDupOk(true);
      requestAnimationFrame(() => dupRef.current?.focus());
      return;
    }
    // Entrou alguém numa parcelada: pergunta antes como dividir (o que falta ou desde o início).
    if (editing && (joined.length || leaving.length) && !mode) {
      setElapsed((k) => k ?? guessElapsed(editing));
      requestAnimationFrame(() => joinRef.current?.focus());
      return;
    }
    const schedule = editing && mode && mode !== 'even' && elapsed ? joinSchedule(lateBase() ?? editing, input, people, elapsed, mode, drift) : null;
    // Começa mais tarde: as parcelas antes dela ficam de fora para todos. Voltou para a 1ª: `{}` limpa.
    const delayed = !schedule && parts > 1 && from > 1 ? startSchedule(r.shares, parts, from) : null;
    const plan = schedule ?? delayed ?? (mode === 'even' || (editing && startOf(editing) > 1 && from === 1) ? {} : null);
    // Na viagem toda: a pessoa entra na conta de quem pagou (como em Pessoas), antes da despesa.
    for (const id of dropped) dispatch({ type: 'editTraveler', id, coveredBy: null });
    if (cover.scope === 'trip') {
      for (const id of cover.ids) dispatch({ type: 'editTraveler', id, coveredBy: payerId });
    }
    if (editing) {
      dispatch({ type: 'editExpense', id: editing.id, input: plan ? { ...input, schedule: plan } : input });
      toast(trip.settlements.length ? 'Despesa salva. Os saldos mudaram: confira o acerto.' : 'Despesa salva');
    } else {
      dispatch({ type: 'addExpense', id: newId(), input: plan ? { ...input, schedule: plan } : input });
      toast(`${input.description} · ${formatBRL(cents!)} lançado`);
    }
    onClose();
    onSaved?.();
  }

  const nameOf = (id: string) => (id === meId ? 'você' : people.find((p) => p.id === id)?.name ?? 'quem pagou');
  // "Deseja redividir o valor restante, ou dividir tudo desde o início?", com os valores de cada jeito.
  // "A partir de qual parcela?": quem entra paga dali em diante e quem sai fica só com as que
  // já foram (o valor de todos é reajustado ali), ou, só quando ninguém sai, "desde a 1ª"
  // (quem entrou paga também a parte das que já foram).
  const joinAsk = (() => {
    if (!editing || (!joined.length && !leaving.length && late === null) || elapsed === null) return null;
    // Sem mudança em quem participa: a pessoa escolhe quem, dos que já estão, entrou depois.
    const lateMode = !joined.length && !leaving.length;
    const comers = lateMode ? late ?? [] : joined;
    const base = lateBase() ?? editing;
    const n = installmentsOf(editing);
    const k = elapsed;
    const from = k + 1;
    const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
    const list = (ids: string[]) => {
      const names = ids.map(nameOf);
      return names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names.at(-1)}` : names[0];
    };
    const verb = (ids: string[], one: string, many: string) => (ids.length > 1 ? many : one);
    const question = [
      comers.length ? `${list(comers)} ${verb(comers, 'entra', 'entram')}` : '',
      leaving.length ? `${list(leaving)} ${verb(leaving, 'sai', 'saem')}` : '',
    ]
      .filter(Boolean)
      .join(' e ');
    const one = comers[0] ?? who[0];
    const stays = (id: string) => editing.people.includes(id) && !comers.includes(id);
    const stayer = who.find((id) => stays(id) && id !== payerId) ?? who.find(stays);
    const before = stayer ? partsOf(base, stayer)[k] : 0;
    const ready = !lateMode || comers.length > 0;
    const rest = k && ready ? joinSchedule(base, input, people, k, 'rest', drift) : null;
    const all = k && ready && !leaving.length ? joinSchedule(base, input, people, k, 'all', drift) : null;
    const gone = k === 1 ? 'a 1ª parcela' : `as parcelas 1 a ${k}`;
    const each = who.length > 1 ? `cada um paga ${rest ? formatBRL(rest[one][k]) : ''}` : `${nameOf(who[0])} paga ${rest ? formatBRL(rest[one][k]) : ''}`;
    return (
      <div className="confirm join-ask" role="group" aria-labelledby="h-join" ref={joinRef} tabIndex={-1}>
        <p id="h-join">
          <b>{lateMode ? (comers.length ? `${cap(question)} a partir de qual parcela?` : 'Quem entrou depois, e a partir de qual parcela?') : `${cap(question)} a partir de qual parcela?`}</b>
        </p>
        {lateMode && (
          <div className="chips" role="group" aria-label="Quem entrou depois">
            {people
              .filter((p) => who.includes(p.id) && editing.people.includes(p.id) && p.id !== payerId)
              .map((p) => {
                const on = comers.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="chip"
                    style={personStyle(p)}
                    aria-pressed={on}
                    onClick={() => setLate((l) => (on ? (l ?? []).filter((x) => x !== p.id) : [...(l ?? []), p.id]))}
                  >
                    <Avatar person={p} size="xs" checked={on} />
                    {p.name}
                  </button>
                );
              })}
          </div>
        )}
        <div className="join-elapsed">
          <span id="h-join-k">A partir da</span>
          <div className="stepper" role="group" aria-labelledby="h-join-k">
            <button type="button" onClick={() => setElapsed(Math.max(0, k - 1))} disabled={k <= 0} aria-label="Parcela anterior">
              <IconMinus size={18} />
            </button>
            <output aria-live="polite">{from}ª de {n}</output>
            <button type="button" onClick={() => setElapsed(Math.min(n - 1, k + 1))} disabled={k >= n - 1} aria-label="Próxima parcela">
              <IconPlus size={18} />
            </button>
          </div>
        </div>
        {!ready ? (
          <p className="hint">Toque em quem entrou depois.</p>
        ) : !rest ? (
          <>
            <p className="hint">Desde a 1ª parcela: a despesa inteira é dividida entre quem está marcado agora.</p>
            <button type="button" className="btn primary" onClick={() => save(lateMode ? 'even' : 'all')}>Salvar</button>
          </>
        ) : (
          <>
            <button type="button" className="join-option" onClick={() => save('rest')}>
              <b>A partir da {from}ª parcela</b>
              <small>
                {cap(gone)} {k === 1 ? 'continua' : 'continuam'} com quem já estava
                {leaving.length > 0 && <> ({list(leaving)} {verb(leaving, 'fica', 'ficam')} só com {k === 1 ? 'ela' : 'elas'})</>}. Da {from}ª em diante, o
                valor é reajustado e {each} por mês
                {stayer && before !== rest[stayer][k] && <> ({nameOf(stayer)} pagava {formatBRL(before)})</>}.
              </small>
            </button>
            {all && (
              <button type="button" className="join-option" onClick={() => save('all')}>
                <b>Desde a 1ª parcela</b>
                <small>
                  {cap(list(comers))} {verb(comers, 'paga', 'pagam')} também a parte {k === 1 ? 'da 1ª' : `das parcelas 1 a ${k}`}: {formatBRL(all[one][k])}
                  {comers.length > 1 ? ' cada' : ''} na {from}ª
                  {stayer && (
                    <>
                      , e {nameOf(stayer)} {all[stayer][k] > 0 ? `paga só ${formatBRL(all[stayer][k])}` : 'não paga nada'} nela, porque já pagou a mais
                    </>
                  )}
                  .{k + 1 < n && <> Depois, todos {formatBRL(all[one][k + 1])} por mês.</>}
                </small>
              </button>
            )}
          </>
        )}
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            setElapsed(null);
            setLate(null);
          }}
        >
          Voltar
        </button>
      </div>
    );
  })();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (editing || at === LAST) save();
    else next();
  }

  function remove() {
    if (!editing) return;
    dispatch({ type: 'deleteExpense', id: editing.id, deleted: true });
    toast(
      trip.settlements.length ? 'Despesa excluída. Os saldos mudaram.' : 'Despesa excluída',
      () => dispatch({ type: 'deleteExpense', id: editing.id, deleted: false }),
    );
    onClose();
  }

  const payerName = people.find((p) => p.id === payerId)?.name;
  const dupPayer = duplicate && people.find((p) => p.id === duplicate.payerId)?.name;

  return (
    <form className="sheet-body expense-form" onSubmit={submit} noValidate>
      <span className="sheet-grip" aria-hidden="true" />
      <h2 id="h-expense" tabIndex={-1}>{editing ? 'Editar despesa' : 'Nova despesa'}</h2>

      <ol className="wizard-steps" aria-label="Etapas">
        {steps.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              disabled={i > reached}
              data-done={i < at || undefined}
              aria-current={i === at ? 'step' : undefined}
              onClick={() => go(i)}
            >
              <span>{s.name}</span>
            </button>
          </li>
        ))}
      </ol>

      {at > 0 && cents ? (
        <p className="wizard-recap">
          <span className="cat-tile"><CategoryIcon category={category} size={16} /></span>
          <span><b>{input.description}</b> · <span className="num">{formatBRL(cents)}</span></span>
        </p>
      ) : null}

      <div className="wizard-step" key={key}>
        <h3 className="wizard-title" ref={titleRef} tabIndex={-1}>
          <small>Etapa {at + 1} de {steps.length}</small>
          {key === 'conta' ? `${payerId === meId ? 'Você' : payerName} paga conta de alguém?` : steps[at].title}
        </h3>

        {key === 'valor' && (
          <>
            <ReceiptField
              photos={photos}
              groupId={groupId}
              onAdd={(id) => setPhotos((l) => (l.includes(id) ? l : [...l, id]))}
              onRemove={(id) => {
                setPhotos((l) => l.filter((x) => x !== id));
                setReadTotal(null);
              }}
              onTotal={(c) => {
                setReadTotal({ cents: c });
                if (c && !cents) {
                  setAmount(typed(c));
                  setError('');
                  setDupOk(false);
                }
              }}
              toast={toast}
              autoRead={scan?.blob ?? null}
            />
            {readTotal && (
              <p className="hint receipt-read" aria-live="polite">
                {readTotal.cents === null ? (
                  'Não consegui ler o total na foto. Confira e digite o valor.'
                ) : readTotal.cents === cents ? (
                  <>{totalText(readTotal.cents)}. Confira se está certo.</>
                ) : (
                  <>
                    {totalText(readTotal.cents)}.{' '}
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => {
                        setAmount(typed(readTotal.cents!));
                        setDupOk(false);
                      }}
                    >
                      Usar esse valor
                    </button>
                  </>
                )}
              </p>
            )}
            <div className="money big-money">
              <span aria-hidden="true">R$</span>
              <label className="sr" htmlFor="exp-amount">Valor da despesa, em reais</label>
              <input
                id="exp-amount"
                ref={amountRef}
                className="input"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                enterKeyHint="next"
                value={amount}
                aria-invalid={amount.trim() !== '' && !cents}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError('');
                  setDupOk(false);
                }}
                onBlur={() => cents && setAmount(typed(cents))}
              />
            </div>

            <div className="note-field">
              <label className="field-label" htmlFor="exp-desc">Nome da despesa <span className="muted">(opcional)</span></label>
              <input
                id="exp-desc"
                className="input"
                maxLength={MAX_DESCRIPTION}
                placeholder={`Ex.: ${categoryLabel(trip, category)}`}
                autoComplete="off"
                autoCapitalize="sentences"
                enterKeyHint="next"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {editing && (
              confirmDelete ? (
                <div className="confirm" role="group" aria-labelledby="h-exp-del">
                  <p id="h-exp-del"><b>Excluir esta despesa?</b> Ela sai das contas, e dá para desfazer logo depois.</p>
                  <div className="sheet-actions">
                    <button type="button" className="btn secondary" onClick={() => setConfirmDelete(false)} autoFocus>Cancelar</button>
                    <button type="button" className="btn primary danger" onClick={remove}>Excluir</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn ghost note-delete exp-delete" onClick={() => setConfirmDelete(true)}>
                  <IconTrash /> Excluir despesa
                </button>
              )
            )}
          </>
        )}

        {key === 'categoria' && (
          <div className="cat-grid" role="group" aria-label="Categoria">
            {TRIP_CATEGORIES.map((c) => (
              <button key={c.id} type="button" className="cat-btn" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
                <span className="cat-tile"><CategoryIcon category={c.id} /></span>
                <span className="cat-name">{categoryLabel(trip, c.id)}</span>
              </button>
            ))}
          </div>
        )}

        {key === 'pagamento' && (
          <>
            <div className="picker" role="radiogroup" aria-label="Quem pagou">
              {people.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={p.id === payerId}
                  className="pick"
                  style={personStyle(p)}
                  onClick={() => setPayerId(p.id)}
                >
                  <Avatar person={p} size="md" checked={p.id === payerId} />
                  <span className="pick-name">{p.id === meId ? 'Eu' : p.name}</span>
                </button>
              ))}
            </div>

            <div className="note-field">
              <label className="field-label" htmlFor="exp-date">Dia</label>
              <input
                id="exp-date"
                className="input date-input"
                type="date"
                value={date}
                required
                onChange={(e) => {
                  if (!e.target.value) return;
                  setDate(e.target.value);
                  setDupOk(false);
                }}
              />
              <small className="hint">{dayLabel(date)}</small>
            </div>

            <div className="note-field">
              <h4 className="field-label" id="h-exp-parts">Como foi pago?</h4>
              <div className="seg two" role="group" aria-labelledby="h-exp-parts">
                <button type="button" aria-pressed={parts === 1} onClick={() => setParts(1)}>À vista</button>
                <button type="button" aria-pressed={parts > 1} onClick={() => parts === 1 && setParts(3)}>Parcelado</button>
              </div>
              {parts > 1 && (
                <>
                  <div className="weight-row">
                    <div className="stepper" role="group" aria-label="Número de parcelas">
                      <button type="button" onClick={() => setParts((n) => Math.max(2, n - 1))} disabled={parts <= 2} aria-label="Menos parcelas">
                        <IconMinus size={18} />
                      </button>
                      <output aria-live="polite">{parts}x</output>
                      <button type="button" onClick={() => setParts((n) => Math.min(MAX_INSTALLMENTS, n + 1))} disabled={parts >= MAX_INSTALLMENTS} aria-label="Mais parcelas">
                        <IconPlus size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="join-elapsed">
                    <span id="h-exp-start">Começa a ser dividida na</span>
                    <div className="stepper" role="group" aria-labelledby="h-exp-start">
                      <button type="button" onClick={() => setStartAt(Math.max(1, from - 1))} disabled={from <= 1} aria-label="Parcela anterior">
                        <IconMinus size={18} />
                      </button>
                      <output aria-live="polite">{from}ª parcela</output>
                      <button type="button" onClick={() => setStartAt(Math.min(parts, from + 1))} disabled={from >= parts} aria-label="Próxima parcela">
                        <IconPlus size={18} />
                      </button>
                    </div>
                  </div>
                  <p className="hint" aria-live="polite">
                    {from > 1 ? (
                      <>
                        {from === 2 ? 'A 1ª parcela fica' : `As parcelas 1 a ${from - 1} ficam`} de fora: cada um devolve a sua parte em {count}x, da {from}ª à {parts}ª, para{' '}
                        {nameOf(payerId)}.
                      </>
                    ) : (
                      <>Cada um devolve a sua parte em {parts}x para {nameOf(payerId)}.</>
                    )}
                    {installment && (
                      <> Ex.: {nameOf(installment.id)}, {formatBRL(installment.share)} = {count}x de {formatBRL(installment.first)}.</>
                    )}
                  </p>
                  {sameParts && who.length > 1 && !joined.length && !leaving.length && elapsed === null && (
                    <button type="button" className="link-btn late-link" onClick={startLate}>
                      Alguém entrou depois da 1ª parcela?
                    </button>
                  )}
                </>
              )}
              {parts === 1 && alongOptions().length > 0 && (() => {
                const options = alongOptions();
                const target = alongTargetOf();
                const n = target ? installmentsOf(target) : 0;
                const pick = (t: Expense) => setAlong({ expenseId: t.id, installment: Math.min(installmentsOf(t), guessElapsed(t) + 1) });
                return (
                  <>
                    <label className="scan-option">
                      <input type="checkbox" checked={!!target} onChange={(e) => (e.target.checked ? pick(options[0]) : setAlong(null))} />
                      <span>
                        Cobrar junto com a parcela de outra despesa <small className="muted">· ex.: entra na 2ª parcela do Airbnb</small>
                      </span>
                    </label>
                    {target && (
                      <>
                        {options.length > 1 && (
                          <div className="chips" role="group" aria-label="Junto com qual despesa">
                            {options.map((o) => (
                              <button key={o.id} type="button" className="chip" aria-pressed={o.id === target.id} onClick={() => pick(o)}>
                                {o.description}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="join-elapsed">
                          <span id="h-exp-along">Junto com a</span>
                          <div className="stepper" role="group" aria-labelledby="h-exp-along">
                            <button type="button" onClick={() => setAlong({ expenseId: target.id, installment: Math.max(1, along!.installment - 1) })} disabled={along!.installment <= 1} aria-label="Parcela anterior">
                              <IconMinus size={18} />
                            </button>
                            <output aria-live="polite">{along!.installment}ª de {n}</output>
                            <button type="button" onClick={() => setAlong({ expenseId: target.id, installment: Math.min(n, along!.installment + 1) })} disabled={along!.installment >= n} aria-label="Próxima parcela">
                              <IconPlus size={18} />
                            </button>
                          </div>
                        </div>
                        <p className="hint" aria-live="polite">
                          {cents ? formatBRL(cents) : 'O valor'} entra na {along!.installment}ª parcela de <b>{target.description}</b>: cada um paga a sua parte junto com
                          ela, para {nameOf(payerId)}, num pagamento só.
                        </p>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </>
        )}

        {key === 'conta' && (
          <>
            <div className="chips" role="group" aria-label={`De quem ${nameOf(payerId)} paga a parte`}>
              <button
                type="button"
                className="chip chip-self"
                aria-pressed={cover.ids.length === 0 && keptTrip.length === 0}
                onClick={() => {
                  setPick({ ...cover, ids: [] });
                  setDropTrip(tripMembers.map((p) => p.id));
                }}
              >
                Ninguém
              </button>
              {keptTrip.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="chip"
                  style={personStyle(p)}
                  aria-pressed="true"
                  aria-label={`${p.name}, a viagem toda. Toque para desativar`}
                  onClick={() => setDropTrip((d) => [...d, p.id])}
                >
                  <Avatar person={p} size="xs" checked />
                  {p.id === meId ? 'Você' : p.name} <small className="chip-note">· viagem toda</small>
                </button>
              ))}
              {candidates.map((p) => {
                const on = cover.ids.includes(p.id);
                return (
                  <button key={p.id} type="button" className="chip" style={personStyle(p)} aria-pressed={on} onClick={() => toggleCover(p.id)}>
                    <Avatar person={p} size="xs" checked={on} />
                    {p.id === meId ? 'Você' : p.name}
                  </button>
                );
              })}
            </div>
            {keptTrip.length > 0 && <p className="hint">“Viagem toda” vale para todas as despesas. Toque no nome para desativar.</p>}
            {dropped.length > 0 && (
              <p className="hint" aria-live="polite">
                {dropped.map((id) => nameOf(id)).join(', ').replace(/^v/, 'V')} volta a pagar a própria parte nas despesas. Se for só nesta, toque no nome de novo e escolha “Só nesta despesa”.
              </p>
            )}
            {cover.ids.length > 0 && (
              <div className="note-field">
                <h4 className="field-label" id="h-exp-cover">Vale para</h4>
                <div className="seg two" role="group" aria-labelledby="h-exp-cover">
                  <button type="button" aria-pressed={cover.scope === 'expense'} onClick={() => setPick({ ...cover, scope: 'expense' })}>
                    Só nesta despesa
                  </button>
                  <button type="button" aria-pressed={cover.scope === 'trip'} onClick={() => setPick({ ...cover, scope: 'trip' })}>
                    A viagem toda
                  </button>
                </div>
                <p className="hint" aria-live="polite">
                  {cover.scope === 'expense'
                    ? 'Nas outras despesas, cada um paga a própria parte.'
                    : 'Entra em todas as despesas, também nas que já foram lançadas.'}
                </p>
              </div>
            )}
          </>
        )}

        {key === 'quem' && (
          <>
            <div className="chips" role="group" aria-label="Quem participa">
              {people.map((p) => {
                const on = who.includes(p.id);
                return (
                  <button key={p.id} type="button" className="chip" style={personStyle(p)} aria-pressed={on} onClick={() => { toggle(p.id); setError(''); }}>
                    <Avatar person={p} size="xs" checked={on} />
                    {p.name}
                  </button>
                );
              })}
              <button type="button" className="chip chip-all" onClick={() => setWho(allOn ? [] : people.map((p) => p.id))}>
                {allOn ? 'Limpar' : 'Todos'}
              </button>
            </div>
            {payerName && !who.includes(payerId) && who.length > 0 && (
              <p className="hint">{payerName} pagou e não participa: recebe tudo de volta.</p>
            )}
            {sameParts && who.length > 1 && !joined.length && !leaving.length && elapsed === null && (
              <button type="button" className="link-btn late-link" onClick={startLate}>
                Alguém entrou depois da 1ª parcela?
              </button>
            )}

          </>
        )}

        {key === 'divisao' && (
          <>
            <div className="note-field">
              <div className={`seg ${splits.length === 2 ? 'two' : 'split-seg'}`} role="group" aria-label="Como dividir">
                {splits.map((s) => (
                  <button key={s.id} type="button" aria-pressed={split === s.id} onClick={() => chooseSplit(s.id)}>{s.label}</button>
                ))}
              </div>
              <p className="hint">
                {split === 'exact'
                  ? 'Cada um paga um valor diferente (ex.: cada um pediu um prato). Digite o de cada pessoa.'
                  : split === 'weight'
                    ? 'Esta despesa foi dividida por peso, como antes. Para mudar, escolha outra forma.'
                    : 'Todo mundo que participa paga o mesmo.'}
              </p>

              {split === 'exact' ? (
                <div className="exact-list">
                  {people.filter((p) => who.includes(p.id)).map((p) => {
                    const v = exactCents(p.id);
                    return (
                      <div key={p.id} className="exact-row" style={personStyle(p)}>
                        <Avatar person={p} size="sm" />
                        <label className="exact-name" htmlFor={`exact-${p.id}`}>{p.name}</label>
                        <div className="money">
                          <span aria-hidden="true">R$</span>
                          <input
                            id={`exact-${p.id}`}
                            className="input"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0,00"
                            value={exact[p.id] ?? ''}
                            aria-invalid={v === null}
                            onChange={(e) => {
                              setExact((x) => ({ ...x, [p.id]: e.target.value }));
                              setError('');
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {cents ? (
                    <p className={`exact-status${exactDiff === 0 ? ' ok' : ''}`} aria-live="polite">
                      {exactDiff === 0 ? (
                        <><IconCheck size={14} /> Fechou certinho: {formatBRL(cents)}</>
                      ) : exactDiff > 0 ? (
                        <>Faltam <b className="num">{formatBRL(exactDiff)}</b> para fechar {formatBRL(cents)}</>
                      ) : (
                        <>Passou <b className="num">{formatBRL(-exactDiff)}</b> de {formatBRL(cents)}</>
                      )}
                    </p>
                  ) : null}
                </div>
              ) : preview?.ok ? (
                <ul className="split-preview" aria-label="Quanto fica para cada um">
                  {people.filter((p) => Object.hasOwn(preview.shares, p.id)).map((p) => (
                    <li key={p.id} style={personStyle(p)}>
                      <Avatar person={p} size="xs" />
                      <span className="split-text">
                        <span className="split-name">{p.name}</span>
                        <b className="num">{formatBRL(preview.shares[p.id])}</b>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {duplicate && (
              <p className="warn" ref={dupRef} tabIndex={-1} role="status">
                <IconAlert size={16} />
                <span>
                  Já tem <b>{duplicate.description}</b> de {formatBRL(duplicate.cents)} neste dia{dupPayer ? `, pago por ${dupPayer}` : ''}.
                  {dupOk ? ' Toque de novo para lançar mesmo assim.' : ' Não é a mesma?'}
                </span>
              </p>
            )}
          </>
        )}
      </div>

      {joinAsk}

      <p className="field-error" role="alert">{error}</p>

      <div className="sheet-actions sticky-actions">
        {editing || step === 0 ? (
          <button type="button" className="btn secondary" onClick={onClose}>Cancelar</button>
        ) : (
          <button type="button" className="btn secondary" onClick={() => go(step - 1)}>Voltar</button>
        )}
        <button type="submit" className="btn primary">
          {duplicate && dupOk ? (editing ? 'Salvar mesmo assim' : 'Lançar mesmo assim') : editing ? 'Salvar' : step === LAST ? 'Lançar' : 'Próximo'}
        </button>
      </div>
    </form>
  );
}
