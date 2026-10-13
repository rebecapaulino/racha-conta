import { useState, type Dispatch } from 'react';
import { formatBRL } from '../../core/money';
import { activeExpenses, categoryLabel, nextPayer, TRIP_CATEGORIES, type Expense, type Trip, type TripSummary } from '../../core/trip';
import type { TripAction } from '../../state/tripState';
import { Avatar, AvatarStack } from '../Avatar';
import { IconBulb, IconFilter } from '../icons';
import { Art } from '../illustrations';
import { CategoryIcon } from './CategoryIcon';
import { dayLabel, dayNumber } from './tripDates';

interface Props {
  trip: Trip;
  summary: TripSummary;
  meId: string | null;
  fluent: boolean;
  dispatch: Dispatch<TripAction>;
  toast: (msg: string, undo?: () => void) => void;
  onEdit: (e: Expense) => void;
  onGoPeople: () => void;
}

const SPLIT_TAG = { equal: '', weight: 'por peso', exact: 'valores exatos' } as const;

/** Caderneta: as despesas em páginas, uma por dia (a mais recente primeiro). */
export function TripExpenses({ trip, summary, meId, fluent, dispatch, toast, onEdit, onGoPeople }: Props) {
  const [person, setPerson] = useState('');
  const [category, setCategory] = useState('');
  const [day, setDay] = useState('');
  const all = activeExpenses(trip);
  const deleted = trip.expenses.filter((e) => e.deleted);
  const name = (id: string) => (id === meId ? 'Você' : trip.people.find((p) => p.id === id)?.name ?? '?');
  const tip = nextPayer(summary);

  if (trip.people.length === 0) {
    return (
      <section className="card empty">
        <span className="empty-icon">{fluent ? <Art kind="notebook" size={36} /> : '📒'}</span>
        <p><b>Primeiro, quem vai na viagem.</b><br />Depois é só ir anotando cada gasto aqui.</p>
        <button type="button" className="btn primary" onClick={onGoPeople}>Adicionar pessoas</button>
      </section>
    );
  }

  if (all.length === 0 && deleted.length === 0) {
    return (
      <section className="card empty">
        <span className="empty-icon">{fluent ? <Art kind="notebook" size={36} /> : '📒'}</span>
        <p><b>Caderneta em branco.</b><br />Lance o primeiro gasto: hospedagem, mercado, combustível…</p>
      </section>
    );
  }

  const shown = all.filter(
    (e) =>
      (!person || e.payerId === person || e.people.includes(person)) &&
      (!category || e.category === category) &&
      (!day || e.date === day),
  );
  const days = [...new Set(all.map((e) => e.date))].sort().reverse();
  const first = trip.start ?? days[days.length - 1];
  const pages = [...new Set(shown.map((e) => e.date))]
    .sort()
    .reverse()
    .map((date) => ({ date, items: shown.filter((e) => e.date === date).sort((a, b) => b.seq - a.seq) }));
  const filtering = !!(person || category || day);

  return (
    <div className="stack-y">
      {tip && (
        <section className="next-card" aria-labelledby="h-next">
          <span className="next-icon"><IconBulb size={20} /></span>
          <p>
            <span id="h-next">Quem paga a próxima?</span>
            <b>
              <Avatar person={tip.person} size="xs" /> {tip.person.id === meId ? 'Você' : tip.person.name}
            </b>
            <small>
              {tip.person.id === meId ? 'Dica: pague você o próximo gasto. Você é' : `Dica: deixe ${tip.person.name} pagar o próximo gasto. É`} quem
              mais deve ao grupo ({formatBRL(-tip.balance)}), então sobra menos Pix para acertar no fim.
            </small>
          </p>
        </section>
      )}

      {all.length > 1 && (
        <div className="filters" role="group" aria-label="Filtrar despesas">
          <span className="filters-icon" aria-hidden="true"><IconFilter size={18} /></span>
          <label className="filter" data-on={!!person || undefined}>
            <span className="sr">Pessoa</span>
            <select value={person} onChange={(e) => setPerson(e.target.value)}>
              <option value="">Quem</option>
              {trip.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="filter" data-on={!!category || undefined}>
            <span className="sr">Categoria</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Tipo</option>
              {TRIP_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{categoryLabel(trip, c.id)}</option>)}
            </select>
          </label>
          <label className="filter" data-on={!!day || undefined}>
            <span className="sr">Dia</span>
            <select value={day} onChange={(e) => setDay(e.target.value)}>
              <option value="">Dia</option>
              {days.map((d) => {
                const n = dayNumber(d, first);
                return <option key={d} value={d}>{n ? `Dia ${n} · ` : ''}{dayLabel(d)}</option>;
              })}
            </select>
          </label>
        </div>
      )}

      {filtering && (
        <p className="filter-result" aria-live="polite">
          <span>
            {shown.length} {shown.length === 1 ? 'despesa' : 'despesas'} · <b className="num">{formatBRL(shown.reduce((a, e) => a + e.cents, 0))}</b>
          </span>
          <button type="button" className="link-btn" onClick={() => { setPerson(''); setCategory(''); setDay(''); }}>Limpar filtros</button>
        </p>
      )}

      {pages.length === 0 && filtering && (
        <section className="card empty"><p>Nenhuma despesa com esses filtros.</p></section>
      )}

      {pages.map(({ date, items }) => {
        const n = dayNumber(date, first);
        const total = items.reduce((a, e) => a + e.cents, 0);
        return (
          <section key={date} className="card day-page" aria-labelledby={`d-${date}`}>
            <header className="day-head">
              {n && <span className="day-tab">Dia {n}</span>}
              <h3 id={`d-${date}`}>{dayLabel(date)}</h3>
              <span className="day-total num">{formatBRL(total)}</span>
            </header>
            <ul className="day-lines">
              {items.map((e) => {
                const who = trip.people.filter((p) => e.people.includes(p.id));
                const everyone = who.length === trip.people.length;
                const tag = SPLIT_TAG[e.split];
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      className="line"
                      onClick={() => onEdit(e)}
                      aria-label={`${e.description}, ${formatBRL(e.cents)}, ${name(e.payerId)} pagou. Editar`}
                    >
                      <span className="cat-tile"><CategoryIcon category={e.category} /></span>
                      <span className="row-main">
                        <b>{e.description}</b>
                        <small>
                          <span><span className="payer">{name(e.payerId)}</span> pagou</span>
                          {' · '}
                          <span>{everyone ? 'todos' : who.length === 1 ? `só ${who[0].id === meId ? 'você' : who[0].name}` : `${who.length} pessoas`}</span>
                          {tag && <> · <span>{tag}</span></>}
                        </small>
                      </span>
                      <span className="line-end">
                        <b className="num">{formatBRL(e.cents)}</b>
                        {!everyone && who.length > 1 && <AvatarStack people={who} max={3} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {deleted.length > 0 && (
        <details className="preview deleted">
          <summary>Excluídas ({deleted.length})</summary>
          <ul className="list">
            {deleted.map((e) => (
              <li key={e.id} className="row">
                <span className="cat-tile"><CategoryIcon category={e.category} /></span>
                <span className="row-main">
                  <b>{e.description}</b>
                  <small>{dayLabel(e.date)} · {formatBRL(e.cents)}</small>
                </span>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    dispatch({ type: 'deleteExpense', id: e.id, deleted: false });
                    toast(`${e.description} voltou para a caderneta`);
                  }}
                >
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
