import { formatBRL } from '../../core/money';
import { activeExpenses, tripSummary, type Trip } from '../../core/trip';
import { AvatarStack } from '../Avatar';
import { IconPencil } from '../icons';
import { Art } from '../illustrations';
import { tripDates } from './tripDates';

interface CoverProps {
  trip: Trip;
  fluent: boolean;
  onEdit: () => void;
}

/** Capa da caderneta aberta: nome, datas e o gasto total da viagem. */
export function TripCover({ trip, fluent, onEdit }: CoverProps) {
  const s = tripSummary(trip);
  const count = activeExpenses(trip).length;
  const dates = tripDates(trip.start, trip.end);
  const n = trip.people.length;
  return (
    <section className="hero trip-hero" aria-label="Resumo da viagem">
      <div className="hero-top">
        <span className="trip-title">
          <span className="hero-title">{trip.name}</span>
          {dates && <span className="hero-date">{dates}</span>}
        </span>
        <button type="button" className="hero-photo-btn" onClick={onEdit} aria-label="Editar viagem" title="Editar viagem">
          <IconPencil size={18} />
        </button>
      </div>
      {fluent && <Art kind="suitcase" size={64} className="hero-art" />}
      <span className="hero-label">Gasto total da viagem</span>
      <b className="hero-total">{formatBRL(s.total)}</b>
      <div className="hero-bottom">
        <span>
          {n} {n === 1 ? 'pessoa' : 'pessoas'} · {count} {count === 1 ? 'despesa' : 'despesas'}
        </span>
        {n > 0 && <AvatarStack people={trip.people} />}
      </div>
    </section>
  );
}

interface ListProps {
  trips: Trip[];
  fluent: boolean;
  onOpen: (id: string) => void;
  onCreate: () => void;
}

/** Suas viagens: cada uma é uma caderneta na estante. */
export function TripList({ trips, fluent, onOpen, onCreate }: ListProps) {
  if (trips.length === 0) {
    return (
      <section className="card trip-welcome" aria-labelledby="h-welcome">
        <span className="welcome-art" aria-hidden="true">{fluent ? <Art kind="suitcase" size={72} /> : '🧳'}</span>
        <h2 id="h-welcome">Racha a viagem inteira</h2>
        <p>Anote cada gasto de quem pagou: hospedagem, mercado, combustível, passeios. No fim, o app diz o menor número de Pix para todo mundo ficar quite.</p>
        <ol className="welcome-steps">
          <li><span>1</span> Crie a viagem e adicione quem vai</li>
          <li><span>2</span> Lance cada gasto na hora, com quem pagou</li>
          <li><span>3</span> Veja os saldos e mande o acerto no grupo</li>
        </ol>
        <button type="button" className="btn primary big" onClick={onCreate}>Criar viagem</button>
        <p className="hint">Fica salvo neste celular e funciona sem internet.</p>
      </section>
    );
  }

  return (
    <section className="stack-y" aria-labelledby="h-trips">
      <div className="section-head">
        <h2 id="h-trips">Suas viagens</h2>
        <span className="muted">{trips.length} {trips.length === 1 ? 'caderneta' : 'cadernetas'}</span>
      </div>
      <ul className="covers">
        {trips.map((t) => {
          const s = tripSummary(t);
          const dates = tripDates(t.start, t.end);
          const count = activeExpenses(t).length;
          return (
            <li key={t.id}>
              <button
                type="button"
                className="cover"
                onClick={() => onOpen(t.id)}
                aria-label={`${t.name}${dates ? `, ${dates}` : ''}, ${formatBRL(s.total)}, ${t.people.length} pessoas`}
              >
                          <span className="cover-body">
                  <span className="cover-top">
                    <b className="cover-name">{t.name}</b>
                    {dates && <span className="hero-date">{dates}</span>}
                  </span>
                  <span className="cover-sum">
                    <small>Gasto total</small>
                    <b className="cover-total num">{formatBRL(s.total)}</b>
                  </span>
                  <span className="cover-people">
                    {t.people.length > 0 && <AvatarStack people={t.people} />}
                    <span>
                      {t.people.length} {t.people.length === 1 ? 'pessoa' : 'pessoas'} · {count} {count === 1 ? 'despesa' : 'despesas'}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn secondary new-trip" onClick={onCreate}>+ Nova viagem</button>
    </section>
  );
}
