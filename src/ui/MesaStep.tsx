import { useRef, useState, type Dispatch } from 'react';
import { MAX_NAME, type Bill, type SplitResult } from '../core/bill';
import { formatBRL } from '../core/money';
import type { Action } from '../state/billState';
import { Avatar } from './Avatar';
import { IconPlus, IconUser, IconUsers, IconX } from './icons';
import { Art } from './illustrations';
import { activeVisual } from './visual';

interface Props {
  bill: Bill;
  result: SplitResult;
  dispatch: Dispatch<Action>;
}

/** Etapa 1: quem está na mesa (referência: lista "Choose Friends"). */
export function MesaStep({ bill, result, dispatch }: Props) {
  const [name, setName] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const { people } = bill;

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim()) {
      dispatch({ type: 'addPerson', name });
      setName('');
    }
    input.current?.focus();
  }

  return (
    <div className="stack-y">
      <section className="card" aria-labelledby="h-people">
        <div className="card-head">
          <h2 id="h-people">Quem está na mesa</h2>
          {people.length > 0 && <span className="badge">{people.length}</span>}
        </div>

        <form className="search" onSubmit={add}>
          <span className="search-icon"><IconUser /></span>
          <label className="sr" htmlFor="person-name">Nome da pessoa</label>
          <input
            id="person-name"
            ref={input}
            maxLength={MAX_NAME}
            placeholder="Adicionar pessoa"
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="done"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="round-btn primary" aria-label="Adicionar pessoa">
            <IconPlus />
          </button>
        </form>

        {people.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">{activeVisual() === 'fluent' ? <Art kind="people" size={36} /> : <IconUsers size={26} />}</span>
            <p><b>Ninguém na mesa ainda.</b><br />Adicione quem vai dividir a conta.</p>
          </div>
        ) : (
          <ul className="list">
            {result.shares.map((s) => {
              const count = bill.items.filter((i) => i.who.includes(s.person.id)).length;
              return (
                <li key={s.person.id} className="row">
                  <Avatar person={s.person} size="md" />
                  <span className="row-main">
                    <b>{s.person.name}</b>
                    <small>
                      {count === 0 ? 'sem itens marcados' : `${count} ${count === 1 ? 'item' : 'itens'} · ${formatBRL(s.consumption)}`}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remover ${s.person.name}`}
                    onClick={() => dispatch({ type: 'removePerson', id: s.person.id })}
                  >
                    <IconX size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
