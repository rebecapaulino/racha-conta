import { useState, type Dispatch } from 'react';
import { MAX_NAME } from '../../core/bill';
import { categoryLabel, MAX_TRIP_NAME, TRIP_CATEGORIES, type Trip, type TripCategory } from '../../core/trip';
import { newId } from '../../state/billState';
import type { TripAction } from '../../state/tripState';
import { IconTrash } from '../icons';
import { CategoryIcon } from './CategoryIcon';
import { Sheet } from './Sheet';

export type TripMode = { kind: 'create' } | { kind: 'edit'; trip: Trip };

interface Props {
  mode: TripMode | null;
  dispatch: Dispatch<TripAction>;
  toast: (msg: string) => void;
  onClose: () => void;
}

/** Criar viagem (nome, datas e quem é você) ou editar (nome, datas, nomes das categorias, apagar). */
export function TripSheet({ mode, onClose, ...rest }: Props) {
  return (
    <Sheet open={!!mode} onClose={onClose} labelledBy="h-trip" focus={mode?.kind === 'create' ? '#trip-name' : 'h2'}>
      {mode && <TripForm key={mode.kind === 'edit' ? mode.trip.id : 'new'} mode={mode} onClose={onClose} {...rest} />}
    </Sheet>
  );
}

function TripForm({ mode, dispatch, toast, onClose }: Props & { mode: TripMode }) {
  const trip = mode.kind === 'edit' ? mode.trip : null;
  const [name, setName] = useState(trip?.name ?? '');
  const [start, setStart] = useState(trip?.start ?? '');
  const [end, setEnd] = useState(trip?.end ?? '');
  const [me, setMe] = useState('');
  const [cats, setCats] = useState<Partial<Record<TripCategory, string>>>(() =>
    trip ? Object.fromEntries(TRIP_CATEGORIES.map((c) => [c.id, categoryLabel(trip, c.id)])) : {},
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (start && end && end < start) {
      setError('A volta não pode ser antes da ida.');
      return;
    }
    if (trip) {
      dispatch({ type: 'editTrip', name, start: start || null, end: end || null, categoryNames: cats });
      toast('Viagem salva');
    } else {
      dispatch({ type: 'createTrip', id: newId(), name, start: start || undefined, end: end || undefined, meName: me });
      toast('Caderneta criada. Boa viagem!');
    }
    onClose();
  }

  function remove() {
    if (!trip) return;
    dispatch({ type: 'deleteTrip', id: trip.id });
    toast('Viagem apagada');
    onClose();
  }

  return (
    <form className="sheet-body" onSubmit={save}>
      <span className="sheet-grip" aria-hidden="true" />
      <h2 id="h-trip" tabIndex={-1}>{trip ? 'Editar viagem' : 'Nova viagem'}</h2>
      {!trip && <p>Uma caderneta para anotar os gastos de todo mundo. No fim, o app diz quem paga quem.</p>}

      <div className="note-field">
        <label className="field-label" htmlFor="trip-name">Nome da viagem</label>
        <input
          id="trip-name"
          className="input"
          maxLength={MAX_TRIP_NAME}
          placeholder="Ex.: Réveillon 2027"
          autoComplete="off"
          autoCapitalize="sentences"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <fieldset className="note-field">
        <legend className="field-label">Datas <span className="muted">(opcional)</span></legend>
        <div className="date-pair">
          <label>
            <span>Ida</span>
            <input className="input" type="date" value={start} onChange={(e) => { setStart(e.target.value); setError(''); }} />
          </label>
          <label>
            <span>Volta</span>
            <input className="input" type="date" value={end} min={start || undefined} onChange={(e) => { setEnd(e.target.value); setError(''); }} />
          </label>
        </div>
      </fieldset>

      {!trip && (
        <div className="note-field">
          <label className="field-label" htmlFor="trip-me">Seu nome</label>
          <input
            id="trip-me"
            className="input"
            maxLength={MAX_NAME}
            placeholder="Quem está anotando"
            autoComplete="given-name"
            autoCapitalize="words"
            value={me}
            onChange={(e) => setMe(e.target.value)}
          />
          <p className="hint">Você entra na viagem e as despesas novas já vêm com você como quem pagou.</p>
        </div>
      )}

      {trip && (
        <details className="preview cat-names">
          <summary>Nomes das categorias</summary>
          <div className="cat-names-list">
            {TRIP_CATEGORIES.map((c) => (
              <label key={c.id} className="cat-name-row">
                <span className="cat-tile"><CategoryIcon category={c.id} size={18} /></span>
                <span className="sr">Nome para {c.label}</span>
                <input
                  className="input"
                  maxLength={MAX_NAME}
                  placeholder={c.label}
                  value={cats[c.id] ?? ''}
                  onChange={(e) => setCats((x) => ({ ...x, [c.id]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        </details>
      )}

      <p className="field-error" role="alert">{error}</p>

      {trip && (
        confirmDelete ? (
          <div className="confirm" role="group" aria-labelledby="h-trip-del">
            <p id="h-trip-del">
              <b>Apagar &quot;{trip.name}&quot;?</b> Todas as despesas e acertos saem deste celular. Mande o resumo no WhatsApp antes, se quiser guardar.
            </p>
            <div className="sheet-actions">
              <button type="button" className="btn secondary" onClick={() => setConfirmDelete(false)} autoFocus>Cancelar</button>
              <button type="button" className="btn primary danger" onClick={remove}>Apagar</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn ghost note-delete" onClick={() => setConfirmDelete(true)}>
            <IconTrash /> Apagar viagem
          </button>
        )
      )}

      <div className="sheet-actions">
        <button type="button" className="btn secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn primary">{trip ? 'Salvar' : 'Criar viagem'}</button>
      </div>
    </form>
  );
}
