import { useRef, useState, type Dispatch } from 'react';
import { MAX_NAME, type Bill, type Person, type SplitResult } from '../core/bill';
import { formatBRL } from '../core/money';
import { accountIn, canCoverIn } from '../core/settle';
import type { Action } from '../state/billState';
import { Avatar, personStyle } from './Avatar';
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
  // "Quem paga a parte de X?" (o pai paga a da filha): abre ao tocar no nome.
  const [coverId, setCoverId] = useState<string | null>(null);
  const coverRef = useRef<HTMLDialogElement>(null);
  const covering = people.find((p) => p.id === coverId) ?? null;
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? '?';

  function openCover(p: Person) {
    setCoverId(p.id);
    coverRef.current?.showModal?.();
  }
  function choose(by: string | null) {
    if (covering) dispatch({ type: 'cover', id: covering.id, by });
    coverRef.current?.close();
  }

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
              const by = accountIn(people, s.person.id);
              const covers = people.filter((p) => p.id !== s.person.id && accountIn(people, p.id) === s.person.id);
              return (
                <li key={s.person.id} className="row">
                  <button
                    type="button"
                    className="mesa-who"
                    onClick={() => openCover(s.person)}
                    aria-label={`${s.person.name}: escolher quem paga a parte`}
                  >
                    <Avatar person={s.person} size="md" />
                    <span className="row-main">
                      <b>{s.person.name}</b>
                      <small>
                        {count === 0 ? 'sem itens marcados' : `${count} ${count === 1 ? 'item' : 'itens'} · ${formatBRL(s.consumption)}`}
                      </small>
                      {by !== s.person.id && <small className="covered-tag">{nameOf(by)} paga a parte de {s.person.name}</small>}
                      {covers.length > 0 && <small className="covered-tag">Paga também a de {covers.map((p) => p.name).join(', ')}</small>}
                    </span>
                  </button>
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
        {people.length > 1 && (
          <p className="hint">Alguém vai pagar a parte de outra pessoa (o pai paga a da filha)? Toque no nome.</p>
        )}
      </section>

      <dialog
        ref={coverRef}
        className="sheet"
        aria-labelledby="h-cover"
        onClose={() => setCoverId(null)}
        onClick={(e) => e.target === e.currentTarget && coverRef.current?.close()}
      >
        {covering && (
          <div className="sheet-body">
            <span className="sheet-grip" aria-hidden="true" />
            <h2 id="h-cover">Quem paga a parte de {covering.name}?</h2>
            <div className="chips cover-chips" role="group" aria-labelledby="h-cover">
              <button type="button" className="chip chip-self" aria-pressed={!covering.coveredBy} onClick={() => choose(null)}>
                A própria pessoa
              </button>
              {people
                .filter((p) => canCoverIn(people, covering.id, p.id))
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="chip"
                    style={personStyle(p)}
                    aria-pressed={covering.coveredBy === p.id}
                    onClick={() => choose(p.id)}
                  >
                    <Avatar person={p} size="xs" />
                    {p.name}
                  </button>
                ))}
            </div>
            <p className="hint">
              Ex.: o pai que paga a parte da filha, ou um casal em que um paga pelos dois. Os itens continuam no nome de {covering.name}, mas na hora de pagar a parte entra na conta de quem paga.
            </p>
            <button type="button" className="btn ghost" onClick={() => coverRef.current?.close()}>
              Fechar
            </button>
          </div>
        )}
      </dialog>
    </div>
  );
}
