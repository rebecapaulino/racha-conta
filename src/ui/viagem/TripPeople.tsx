import { useRef, useState, type Dispatch } from 'react';
import { MAX_NAME } from '../../core/bill';
import { formatBRL } from '../../core/money';
import { formatWeight, type Traveler, type Trip, type TripSummary } from '../../core/trip';
import { newId } from '../../state/billState';
import type { TripAction } from '../../state/tripState';
import { Avatar } from '../Avatar';
import { IconPencil, IconPlus, IconUser, IconUsers } from '../icons';
import { Art } from '../illustrations';

interface Props {
  trip: Trip;
  summary: TripSummary;
  meId: string | null;
  fluent: boolean;
  dispatch: Dispatch<TripAction>;
  onEdit: (p: Traveler) => void;
}

/** Quem vai na viagem: pessoas ou famílias inteiras (com peso). */
export function TripPeople({ trip, summary, meId, fluent, dispatch, onEdit }: Props) {
  const [name, setName] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const people = trip.people;

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim()) {
      dispatch({ type: 'addTraveler', id: newId(), name });
      setName('');
    }
    input.current?.focus();
  }

  return (
    <div className="stack-y">
      <section className="card" aria-labelledby="h-travelers">
        <div className="card-head">
          <h2 id="h-travelers">Quem vai na viagem</h2>
          {people.length > 0 && <span className="badge">{people.length}</span>}
        </div>

        <form className="search" onSubmit={add}>
          <span className="search-icon"><IconUser /></span>
          <label className="sr" htmlFor="traveler-name">Nome da pessoa ou família</label>
          <input
            id="traveler-name"
            ref={input}
            maxLength={MAX_NAME}
            placeholder="Adicionar pessoa ou família"
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="done"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="round-btn primary" aria-label="Adicionar à viagem">
            <IconPlus />
          </button>
        </form>

        {people.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">{fluent ? <Art kind="people" size={36} /> : <IconUsers size={26} />}</span>
            <p><b>Ninguém na viagem ainda.</b><br />Adicione cada pessoa, ou cada família como uma pessoa só.</p>
          </div>
        ) : (
          <ul className="list">
            {summary.people.map(({ person, paid, owes }) => (
              <li key={person.id}>
                <button type="button" className="row person-row" onClick={() => onEdit(person)} aria-label={`Editar ${person.name}`}>
                  <Avatar person={person} size="md" />
                  <span className="row-main">
                    <b>
                      {person.name}
                      {person.id === meId && <span className="tag">você</span>}
                    </b>
                    <small>
                      <span>peso {formatWeight(person.weight)}</span>
                      {(paid > 0 || owes > 0) && <> · <span>pagou {formatBRL(paid)}</span> · <span>consumiu {formatBRL(owes)}</span></>}
                    </small>
                  </span>
                  <span className="row-go" aria-hidden="true"><IconPencil size={16} /></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="hint tip">
        <b>Dica:</b> família que acerta junto pode entrar como uma pessoa só, com peso igual ao tamanho dela (2 adultos e 1 criança = 2,5).
      </p>
    </div>
  );
}
