import { useRef, useState, type Dispatch } from 'react';
import { formatBRL, parseBRL } from '../../core/money';
import {
  categoryLabel,
  findDuplicate,
  MAX_DESCRIPTION,
  nextPayer,
  splitExpense,
  TRIP_CATEGORIES,
  tripSummary,
  type Expense,
  type ExpenseInput,
  type SplitMode,
  type Trip,
  type TripCategory,
} from '../../core/trip';
import { newId } from '../../state/billState';
import { todayISO, type TripAction } from '../../state/tripState';
import { Avatar, personStyle } from '../Avatar';
import { IconAlert, IconBulb, IconCheck, IconTrash } from '../icons';
import { CategoryIcon } from './CategoryIcon';
import { Sheet } from './Sheet';
import { dayBefore, dayLabel } from './tripDates';

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

/** Lançar ou editar uma despesa: valor primeiro, o resto já vem preenchido. */
export function ExpenseSheet({ mode, onClose, ...rest }: Props) {
  return (
    <Sheet open={!!mode} onClose={onClose} labelledBy="h-expense" className="expense-sheet" focus={mode?.kind === 'new' ? '#exp-amount' : 'h2'}>
      {mode && <ExpenseForm key={mode.kind === 'edit' ? mode.expense.id : 'new'} mode={mode} onClose={onClose} {...rest} />}
    </Sheet>
  );
}

const SPLITS: { id: SplitMode; label: string }[] = [
  { id: 'equal', label: 'Igual' },
  { id: 'weight', label: 'Por peso' },
  { id: 'exact', label: 'Valores exatos' },
];

/** "1.072,48": centavos no formato de digitar (sem o "R$"). */
const typed = (cents: number) => formatBRL(cents).replace(/^R\$\s?/, '');

function ExpenseForm({ trip, meId, mode, dispatch, toast, onClose, onSaved }: Props & { mode: ExpenseMode }) {
  const editing = mode.kind === 'edit' ? mode.expense : null;
  const people = trip.people;
  const amountRef = useRef<HTMLInputElement>(null);
  const dupRef = useRef<HTMLParagraphElement>(null);

  // Categoria nova começa na última usada: quem está no mercado costuma lançar mercado de novo.
  const lastCategory = [...trip.expenses].reverse().find((e) => !e.deleted)?.category ?? 'alimentacao';
  const defaultPayer =
    (mode.kind === 'new' && mode.payerId) || (meId && people.some((p) => p.id === meId) ? meId : people[0]?.id ?? '');

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
  const [dupOk, setDupOk] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

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
  };
  const preview = cents ? splitExpense(input, people, seq) : null;
  const duplicate = cents ? findDuplicate(trip, { cents, date }, editing?.id) : null;
  const suggestion = mode.kind === 'new' ? nextPayer(tripSummary(trip)) : null;
  const today = todayISO();
  const yesterday = dayBefore(today);

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

  function save() {
    if (!cents) {
      setError('Digite o valor da despesa.');
      amountRef.current?.focus();
      return;
    }
    const r = splitExpense(input, people, seq);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    if (duplicate && !dupOk) {
      setDupOk(true);
      dupRef.current?.focus();
      return;
    }
    if (editing) {
      dispatch({ type: 'editExpense', id: editing.id, input });
      toast(trip.settlements.length ? 'Despesa salva. Os saldos mudaram: confira o acerto.' : 'Despesa salva');
    } else {
      dispatch({ type: 'addExpense', id: newId(), input });
      toast(`${input.description} · ${formatBRL(cents)} lançado`);
    }
    onClose();
    onSaved?.();
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
    <div className="sheet-body expense-form">
      <span className="sheet-grip" aria-hidden="true" />
      <h2 id="h-expense" tabIndex={-1}>{editing ? 'Editar despesa' : 'Nova despesa'}</h2>

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
        <label className="field-label" htmlFor="exp-desc">Descrição <span className="muted">(opcional)</span></label>
        <input
          id="exp-desc"
          className="input"
          maxLength={MAX_DESCRIPTION}
          placeholder={`Ex.: ${categoryLabel(trip, category)}`}
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="done"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <fieldset className="note-field">
        <legend className="field-label">Categoria</legend>
        <div className="cat-grid">
          {TRIP_CATEGORIES.map((c) => (
            <button key={c.id} type="button" className="cat-btn" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
              <span className="cat-tile"><CategoryIcon category={c.id} /></span>
              <span className="cat-name">{categoryLabel(trip, c.id)}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="note-field">
        <h3 className="field-label" id="h-exp-payer">Quem pagou?</h3>
        <div className="picker" role="radiogroup" aria-labelledby="h-exp-payer">
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
        {suggestion && suggestion.person.id !== payerId && (
          <p className="pay-tip">
            <IconBulb size={16} />
            <span>
              Para equilibrar, quem paga a próxima é <b>{suggestion.person.name}</b> (deve {formatBRL(-suggestion.balance)} ao caixa).
            </span>
            <button type="button" className="link-btn" onClick={() => setPayerId(suggestion.person.id)}>Usar</button>
          </p>
        )}
      </div>

      <div className="note-field">
        <h3 className="field-label" id="h-exp-who">Quem participa?</h3>
        <div className="chips" role="group" aria-labelledby="h-exp-who">
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
      </div>

      <div className="note-field">
        <h3 className="field-label" id="h-exp-split">Como dividir?</h3>
        <div className="seg split-seg" role="group" aria-labelledby="h-exp-split">
          {SPLITS.map((s) => (
            <button key={s.id} type="button" aria-pressed={split === s.id} onClick={() => chooseSplit(s.id)}>{s.label}</button>
          ))}
        </div>

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
            ) : (
              <p className="hint">Digite o valor da despesa lá em cima.</p>
            )}
          </div>
        ) : preview?.ok ? (
          <ul className="split-preview" aria-label="Quanto fica para cada um">
            {people.filter((p) => Object.hasOwn(preview.shares, p.id)).map((p) => (
              <li key={p.id} style={personStyle(p)}>
                <Avatar person={p} size="xs" />
                <span className="split-text">
                  <span className="split-name">
                    {p.name}
                    {split === 'weight' && <small> · peso {String(p.weight).replace('.', ',')}</small>}
                  </span>
                  <b className="num">{formatBRL(preview.shares[p.id])}</b>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">
            {split === 'weight'
              ? 'Cada um paga conforme o peso (criança 0,5, família = soma). Ajuste os pesos em Pessoas.'
              : 'Todo mundo que participa paga o mesmo.'}
          </p>
        )}
      </div>

      <fieldset className="note-field">
        <legend className="field-label">Dia</legend>
        <div className="date-row">
          <button type="button" className="chip date-chip" aria-pressed={date === today} onClick={() => setDate(today)}>Hoje</button>
          <button type="button" className="chip date-chip" aria-pressed={date === yesterday} onClick={() => setDate(yesterday)}>Ontem</button>
          <label className="sr" htmlFor="exp-date">Outro dia</label>
          <input
            id="exp-date"
            className="input date-input"
            type="date"
            value={date}
            required
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </div>
        <small className="hint">{dayLabel(date)}</small>
      </fieldset>

      {duplicate && (
        <p className="warn" ref={dupRef} tabIndex={-1} role="status">
          <IconAlert size={16} />
          <span>
            Já tem <b>{duplicate.description}</b> de {formatBRL(duplicate.cents)} neste dia{dupPayer ? `, pago por ${dupPayer}` : ''}.
            {dupOk ? ' Toque de novo para lançar mesmo assim.' : ' Não é a mesma?'}
          </span>
        </p>
      )}

      <p className="field-error" role="alert">{error}</p>

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
          <button type="button" className="btn ghost note-delete" onClick={() => setConfirmDelete(true)}>
            <IconTrash /> Excluir despesa
          </button>
        )
      )}

      <div className="sheet-actions sticky-actions">
        <button type="button" className="btn secondary" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn primary" onClick={save}>
          {duplicate && dupOk ? 'Lançar mesmo assim' : editing ? 'Salvar' : 'Lançar'}
        </button>
      </div>
    </div>
  );
}
