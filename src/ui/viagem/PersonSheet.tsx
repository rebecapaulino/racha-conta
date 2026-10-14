import { useState, type Dispatch } from 'react';
import { MAX_NAME } from '../../core/bill';
import { accountMembers, canCover, formatWeight, MAX_WEIGHT, travelerUsage, usesWeight, type Traveler, type Trip } from '../../core/trip';
import type { TripAction } from '../../state/tripState';
import { Avatar, personStyle } from '../Avatar';
import { IconMinus, IconPlus, IconTrash } from '../icons';
import { Sheet } from './Sheet';

interface Props {
  trip: Trip;
  meId: string | null;
  person: Traveler | null;
  dispatch: Dispatch<TripAction>;
  toast: (msg: string) => void;
  onClose: () => void;
}

const PRESETS = [
  { weight: 1, label: 'Adulto', hint: '1' },
  { weight: 0.5, label: 'Criança', hint: '0,5' },
  { weight: 0, label: 'Não divide', hint: '0' },
];

/** Editar alguém da viagem: nome, quem paga a parte, "sou eu" e remover (sem apagar nada em silêncio). */
export function PersonSheet({ person, onClose, ...rest }: Props) {
  return (
    <Sheet open={!!person} onClose={onClose} labelledBy="h-person" className="person-sheet">
      {person && <PersonForm key={person.id} person={person} onClose={onClose} {...rest} />}
    </Sheet>
  );
}

function PersonForm({ trip, meId, person, dispatch, toast, onClose }: Props & { person: Traveler }) {
  const [name, setName] = useState(person.name);
  const [weight, setWeight] = useState(person.weight);
  const [isMe, setIsMe] = useState(person.id === meId);
  const [coveredBy, setCoveredBy] = useState(person.coveredBy ?? '');
  const sponsors = trip.people.filter((p) => canCover(trip, person.id, p.id));
  const covers = accountMembers(trip, person.id);
  const [removing, setRemoving] = useState(false);
  const others = trip.people.filter((p) => p.id !== person.id);
  const [to, setTo] = useState(others[0]?.id ?? '');
  const usage = travelerUsage(trip, person.id);
  const used = usage.expenses + usage.settlements > 0;

  const step = (d: number) => setWeight((w) => Math.min(MAX_WEIGHT, Math.max(0, Math.round((w + d) * 2) / 2)));

  function save() {
    dispatch({ type: 'editTraveler', id: person.id, name, weight, coveredBy: coveredBy || null });
    if (isMe !== (person.id === meId)) dispatch({ type: 'setMe', id: isMe ? person.id : null });
    toast('Pessoa salva');
    onClose();
  }

  function remove() {
    if (used && !to) return;
    dispatch({ type: 'removeTraveler', id: person.id, ...(used ? { to } : {}) });
    const target = others.find((p) => p.id === to)?.name;
    toast(used ? `${person.name} saiu. As despesas passaram para ${target}.` : `${person.name} saiu da viagem`);
    onClose();
  }

  return (
    <div className="sheet-body">
      <span className="sheet-grip" aria-hidden="true" />
      <div className="person-top" style={personStyle(person)}>
        <Avatar person={{ ...person, name: name || person.name }} size="lg" />
        <h2 id="h-person" tabIndex={-1}>{person.name}</h2>
      </div>

      <div className="note-field">
        <label className="field-label" htmlFor="person-edit-name">Nome</label>
        <input
          id="person-edit-name"
          className="input"
          maxLength={MAX_NAME}
          autoComplete="off"
          autoCapitalize="words"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {usesWeight(trip) && (
        <div className="note-field">
          <h3 className="field-label" id="h-weight">Peso na divisão</h3>
          <div className="weight-row">
            <div className="stepper" role="group" aria-labelledby="h-weight">
              <button type="button" onClick={() => step(-0.5)} disabled={weight <= 0} aria-label="Diminuir peso">
                <IconMinus size={18} />
              </button>
              <output aria-live="polite">{formatWeight(weight)}</output>
              <button type="button" onClick={() => step(0.5)} disabled={weight >= MAX_WEIGHT} aria-label="Aumentar peso">
                <IconPlus size={18} />
              </button>
            </div>
            <div className="chips weight-presets">
              {PRESETS.map((p) => (
                <button key={p.label} type="button" className="chip" aria-pressed={weight === p.weight} onClick={() => setWeight(p.weight)}>
                  {p.label} <small>{p.hint}</small>
                </button>
              ))}
            </div>
          </div>
          <p className="hint">
            Vale quando a despesa é dividida <b>por peso</b>. Família inteira numa pessoa só? Some: 2 adultos e 1 criança = 2,5.
          </p>
        </div>
      )}

      <div className="note-field">
        <h3 className="field-label" id="h-covered">Quem paga a parte de {name.trim() || person.name}?</h3>
        <div className="chips cover-chips" role="group" aria-labelledby="h-covered">
          <button type="button" className="chip chip-self" aria-pressed={!coveredBy} onClick={() => setCoveredBy('')}>
            A própria pessoa
          </button>
          {sponsors.map((p) => (
            <button
              key={p.id}
              type="button"
              className="chip"
              style={personStyle(p)}
              aria-pressed={coveredBy === p.id}
              onClick={() => setCoveredBy(p.id)}
            >
              <Avatar person={p} size="xs" />
              {p.id === meId ? 'Você' : p.name}
            </button>
          ))}
        </div>
        <p className="hint">
          {coveredBy
            ? `As despesas continuam no nome de ${name.trim() || person.name}, mas no acerto a conta entra na de ${trip.people.find((p) => p.id === coveredBy)?.name}: é quem paga ou recebe.`
            : 'Ex.: o pai que paga a parte da filha, ou um casal em que um paga pelos dois. No acerto, a conta junta com a de quem paga.'}
        </p>
        {covers.length > 0 && (
          <p className="hint">{person.name} já paga a parte de {covers.map((p) => p.name).join(', ')}.</p>
        )}
      </div>

      <label className="scan-option">
        <input type="checkbox" checked={isMe} onChange={(e) => setIsMe(e.target.checked)} />
        <span>Sou eu <small className="muted">· neste celular, despesa nova já vem com você como quem pagou</small></span>
      </label>

      {removing ? (
        <div className="confirm" role="group" aria-labelledby="h-person-del">
          {used ? (
            <>
              <p id="h-person-del">
                <b>{person.name} aparece em {usage.expenses} {usage.expenses === 1 ? 'despesa' : 'despesas'}
                {usage.settlements > 0 && ` e ${usage.settlements} ${usage.settlements === 1 ? 'acerto' : 'acertos'}`}.</b>{' '}
                Para não sumir dinheiro, escolha quem fica com tudo isso:
              </p>
              {others.length === 0 ? (
                <p className="hint">Adicione outra pessoa antes de remover.</p>
              ) : (
                <div className="picker" role="radiogroup" aria-label="Quem fica com as despesas">
                  {others.map((p) => (
                    <button key={p.id} type="button" role="radio" aria-checked={p.id === to} className="pick" style={personStyle(p)} onClick={() => setTo(p.id)}>
                      <Avatar person={p} size="md" checked={p.id === to} />
                      <span className="pick-name">{p.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p id="h-person-del"><b>Remover {person.name} da viagem?</b> Não aparece em nenhuma despesa.</p>
          )}
          <div className="sheet-actions">
            <button type="button" className="btn secondary" onClick={() => setRemoving(false)} autoFocus>Cancelar</button>
            <button type="button" className="btn primary danger" onClick={remove} disabled={used && !to}>
              {used ? 'Passar e remover' : 'Remover'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn ghost note-delete" onClick={() => setRemoving(true)}>
          <IconTrash /> Remover da viagem
        </button>
      )}

      <div className="sheet-actions">
        <button type="button" className="btn secondary" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn primary" onClick={save}>Salvar</button>
      </div>
    </div>
  );
}
