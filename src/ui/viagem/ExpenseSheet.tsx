import { useEffect, useRef, useState, type Dispatch, type FormEvent } from 'react';
import { formatBRL, parseBRL } from '../../core/money';
import {
  accountOf,
  categoryLabel,
  findDuplicate,
  installmentInfo,
  installmentsOf,
  MAX_DESCRIPTION,
  MAX_INSTALLMENTS,
  splitExpense,
  TRIP_CATEGORIES,
  type Expense,
  type ExpenseInput,
  type SplitMode,
  type Trip,
  type TripCategory,
} from '../../core/trip';
import { newId } from '../../state/billState';
import { todayISO, type TripAction } from '../../state/tripState';
import { Avatar, personStyle } from '../Avatar';
import { IconAlert, IconCheck, IconMinus, IconPlus, IconTrash } from '../icons';
import { CategoryIcon } from './CategoryIcon';
import { Sheet } from './Sheet';
import { dayLabel } from './tripDates';

export type ExpenseMode = { kind: 'new'; payerId?: string } | { kind: 'edit'; expense: Expense };

interface Props {
  trip: Trip;
  meId: string | null;
  mode: ExpenseMode | null;
  dispatch: Dispatch<TripAction>;
  toast: (msg: string, undo?: () => void) => void;
  onClose: () => void;
  /** Depois de lançar ou salvar (para mostrar a caderneta). */
  onSaved?: () => void;
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

function ExpenseForm({ trip, meId, mode, dispatch, toast, onClose, onSaved }: Props & { mode: ExpenseMode }) {
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
  const [category, setCategory] = useState<TripCategory>(editing?.category ?? lastCategory);
  const [payerId, setPayerId] = useState(editing?.payerId ?? defaultPayer);
  const [who, setWho] = useState<string[]>(editing?.people ?? people.map((p) => p.id));
  const [split, setSplit] = useState<SplitMode>(editing?.split ?? 'equal');
  const [exact, setExact] = useState<Record<string, string>>(() =>
    editing?.split === 'exact' ? Object.fromEntries(Object.entries(editing.shares).map(([id, c]) => [id, typed(c)])) : {},
  );
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [parts, setParts] = useState(editing ? installmentsOf(editing) : 1);
  const [dupOk, setDupOk] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Quem pagou também paga a parte de alguém? Vale só nesta despesa (padrão) ou na viagem toda,
  // como a pessoa escolher. Quem já está na conta de quem pagou na viagem toda não aparece.
  // Só é gravado ao lançar. Sem ninguém para escolher, a etapa nem aparece.
  const payerAccount = accountOf(trip, payerId);
  const candidates = people.filter((p) => accountOf(trip, p.id) !== payerAccount);
  const inTripAccount = people.filter((p) => p.id !== payerId && accountOf(trip, p.id) === payerAccount);
  const fromEditing = editing ? Object.keys(editing.coveredBy ?? {}).filter((id) => editing.coveredBy![id] === payerId) : [];
  const [pick, setPick] = useState<{ payer: string; ids: string[]; scope: 'expense' | 'trip' } | null>(null);
  const cover =
    pick && pick.payer === payerId
      ? { ...pick, ids: pick.ids.filter((id) => candidates.some((p) => p.id === id)) }
      : { payer: payerId, ids: fromEditing.filter((id) => candidates.some((p) => p.id === id)), scope: 'expense' as const };
  const toggleCover = (id: string) =>
    setPick({ ...cover, ids: cover.ids.includes(id) ? cover.ids.filter((x) => x !== id) : [...cover.ids, id] });

  const steps = ALL_STEPS.filter((s) => s.key !== 'conta' || candidates.length > 0);
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
    return { id, share: preview.shares[id], first: installmentInfo(preview.shares[id], 0, parts).parts[0] };
  }
  const preview = cents ? splitExpense(input, people, seq) : null;
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
      const base = splitExpense({ ...input, split: 'equal' }, people, seq);
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

  function save() {
    if (needAmount()) return;
    const r = splitExpense(input, people, seq);
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
    // Na viagem toda: a pessoa entra na conta de quem pagou (como em Pessoas), antes da despesa.
    if (cover.scope === 'trip') {
      for (const id of cover.ids) dispatch({ type: 'editTraveler', id, coveredBy: payerId });
    }
    if (editing) {
      dispatch({ type: 'editExpense', id: editing.id, input });
      toast(trip.settlements.length ? 'Despesa salva. Os saldos mudaram: confira o acerto.' : 'Despesa salva');
    } else {
      dispatch({ type: 'addExpense', id: newId(), input });
      toast(`${input.description} · ${formatBRL(cents!)} lançado`);
    }
    onClose();
    onSaved?.();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (editing || at === LAST) save();
    else next();
  }

  /** "Todos pagos": todo mundo já acertou. Sai do painel de acerto (continua na caderneta). */
  function toggleSettled() {
    if (!editing) return;
    const settled = !editing.settled;
    dispatch({ type: 'settleExpense', id: editing.id, settled });
    toast(
      settled ? `${editing.description}: todos pagos. Saiu do acerto.` : `${editing.description} voltou para o acerto`,
      () => dispatch({ type: 'settleExpense', id: editing.id, settled: !settled }),
    );
    onClose();
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

  const nameOf = (id: string) => (id === meId ? 'você' : people.find((p) => p.id === id)?.name ?? 'quem pagou');
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
                <div className="exp-tools">
                  <button type="button" className="btn ghost exp-settled" aria-pressed={!!editing.settled} onClick={toggleSettled}>
                    <IconCheck size={18} /> {editing.settled ? 'Voltar para o acerto' : 'Todos pagos'}
                  </button>
                  <button type="button" className="btn ghost note-delete exp-delete" onClick={() => setConfirmDelete(true)}>
                    <IconTrash /> Excluir despesa
                  </button>
                </div>
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
                  <p className="hint" aria-live="polite">
                    Cada um devolve a sua parte em {parts}x para {nameOf(payerId)}.
                    {installment && (
                      <> Ex.: {nameOf(installment.id)}, {formatBRL(installment.share)} = {parts}x de {formatBRL(installment.first)}.</>
                    )}
                  </p>
                </>
              )}
            </div>
          </>
        )}

        {key === 'conta' && (
          <>
            <div className="chips" role="group" aria-label={`De quem ${nameOf(payerId)} paga a parte`}>
              <button type="button" className="chip chip-self" aria-pressed={cover.ids.length === 0} onClick={() => setPick({ ...cover, ids: [] })}>
                Ninguém
              </button>
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
            {inTripAccount.length > 0 && (
              <p className="hint">
                Já paga a de {inTripAccount.map((p) => (p.id === meId ? 'você' : p.name)).join(', ')} na viagem toda.
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
