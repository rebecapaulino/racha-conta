import { useState, type Dispatch } from 'react';
import { MAX_NAME } from '../../core/bill';
import { accountMembers, canCover, travelerUsage, type Traveler, type Trip } from '../../core/trip';
import type { TripAction } from '../../state/tripState';
import { Avatar, personStyle } from '../Avatar';
import { IconTrash } from '../icons';
import { Sheet } from './Sheet';

interface Props {
  trip: Trip;
  meId: string | null;
  person: Traveler | null;
  dispatch: Dispatch<TripAction>;
  toast: (msg: string) => void;
  onClose: () => void;
}


/**
 * Editar alguém da viagem: nome, quem paga a parte, "sou eu", assumir as despesas de outra
 * pessoa e remover (sem apagar nada em silêncio).
 */
export function PersonSheet({ person, onClose, ...rest }: Props) {
  return (
    <Sheet open={!!person} onClose={onClose} labelledBy="h-person" className="person-sheet">
      {person && <PersonForm key={person.id} person={person} onClose={onClose} {...rest} />}
    </Sheet>
  );
}

function PersonForm({ trip, meId, person, dispatch, toast, onClose }: Props & { person: Traveler }) {
  const [name, setName] = useState(person.name);
  const [isMe, setIsMe] = useState(person.id === meId);
  const [coveredBy, setCoveredBy] = useState(person.coveredBy ?? '');
  const sponsors = trip.people.filter((p) => canCover(trip, person.id, p.id));
  const covers = accountMembers(trip, person.id);
  const [removing, setRemoving] = useState(false);
  const others = trip.people.filter((p) => p.id !== person.id);
  const [to, setTo] = useState(others[0]?.id ?? '');
  const usage = travelerUsage(trip, person.id);
  const used = usage.expenses + usage.settlements > 0;
  // Assumir: quem tem alguma coisa no nome passa tudo para esta pessoa (ex.: a "Bia" anotada
  // antes de a Bia entrar no grupo com a conta dela).
  const [taking, setTaking] = useState(false);
  const givers = others.filter((p) => {
    const u = travelerUsage(trip, p.id);
    return u.expenses + u.settlements > 0;
  });
  const [from, setFrom] = useState('');
  const [dropFrom, setDropFrom] = useState(true);
  const giver = others.find((p) => p.id === from);
  function pickGiver(p: Traveler) {
    setFrom(p.id);
    // Sem conta no grupo (só um nome anotado): normalmente sai. Com conta: fica, a não ser que desmarque.
    setDropFrom(!p.userId);
  }

  function take() {
    if (!giver) return;
    if (dropFrom) dispatch({ type: 'removeTraveler', id: giver.id, to: person.id });
    else dispatch({ type: 'transferTraveler', from: giver.id, to: person.id });
    toast(dropFrom ? `${person.name} ficou com as despesas de ${giver.name}, que saiu da viagem.` : `${person.name} ficou com as despesas de ${giver.name}.`);
    onClose();
  }


  function save() {
    dispatch({ type: 'editTraveler', id: person.id, name, coveredBy: coveredBy || null });
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

      {taking ? (
        <div className="confirm" role="group" aria-labelledby="h-person-take">
          <p id="h-person-take">
            <b>Passar para {person.name} as despesas de quem?</b> Tudo o que está no nome da pessoa escolhida (o que pagou, o que
            consumiu e os acertos) passa para {person.name}. Nenhum valor muda.
          </p>
          {givers.length === 0 ? (
            <p className="hint">Ninguém mais tem despesas na viagem.</p>
          ) : (
            <div className="picker" role="radiogroup" aria-label="De quem são as despesas">
              {givers.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={p.id === from} className="pick" style={personStyle(p)} onClick={() => pickGiver(p)}>
                  <Avatar person={p} size="md" checked={p.id === from} />
                  <span className="pick-name">{p.id === meId ? 'Você' : p.name}</span>
                </button>
              ))}
            </div>
          )}
          {giver && (
            <label className="scan-option">
              <input type="checkbox" checked={dropFrom} onChange={(e) => setDropFrom(e.target.checked)} />
              <span>Tirar {giver.name} da viagem <small className="muted">· sem marcar, fica na viagem sem nenhuma despesa</small></span>
            </label>
          )}
          <div className="sheet-actions">
            <button type="button" className="btn secondary" onClick={() => setTaking(false)} autoFocus>Cancelar</button>
            <button type="button" className="btn primary" onClick={take} disabled={!giver}>
              Passar para {person.name}
            </button>
          </div>
        </div>
      ) : (
        others.length > 0 && !removing && (
          <button type="button" className="btn ghost person-take" onClick={() => setTaking(true)}>
            Assumir despesas de outra pessoa
          </button>
        )
      )}

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
