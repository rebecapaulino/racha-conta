import { useState, type CSSProperties } from 'react';
import { formatBRL } from '../../core/money';
import { activeExpenses, tripSummary, type Trip } from '../../core/trip';
import { AvatarStack } from '../Avatar';
import { CoverPhoto } from '../CoverPhoto';
import { IconDots, IconPencil, IconShare, IconTrash } from '../icons';
import { Sheet } from './Sheet';
import type { Member } from '../../sync/groups';
import { MemberDots } from './ShareSheet';
import { Art } from '../illustrations';
import { tripDates } from './tripDates';
import { useReceiptUrl } from './useReceiptUrl';

interface CoverProps {
  trip: Trip;
  fluent: boolean;
  onEdit: () => void;
  onPhoto: (photoId: string | null) => void;
  toast: (msg: string) => void;
  /** Grupo da viagem compartilhada: a foto que outra pessoa pôs vem de lá. */
  groupId?: string | null;
  /** Abre o compartilhar (sem isso, o botão não aparece: sem login configurado). */
  onShare?: () => void;
  /** Quem está no grupo (viagem compartilhada). */
  members?: Member[];
  accountId?: string | null;
}

/** Capa da caderneta aberta: nome, datas e o gasto total da viagem. */
export function TripCover({ trip, fluent, onEdit, onPhoto, toast, groupId = null, onShare, members = [], accountId = null }: CoverProps) {
  const photoUrl = useReceiptUrl(trip.photoId ?? null, groupId);
  const [busy, setBusy] = useState(false);
  const style = photoUrl ? ({ '--photo': `url("${photoUrl}")` } as CSSProperties) : undefined;
  const s = tripSummary(trip);
  const count = activeExpenses(trip).length;
  const dates = tripDates(trip.start, trip.end);
  const n = trip.people.length;
  return (
    <section className={`hero trip-hero${photoUrl ? ' has-photo' : ''}`} style={style} aria-label="Resumo da viagem" aria-busy={busy}>
      <div className="hero-top">
        <span className="trip-title">
          <span className="hero-title">{trip.name}</span>
          {dates && <span className="hero-date">{dates}</span>}
        </span>
        <span className="hero-actions">
          {members.length > 0 && onShare && (
            <button type="button" className="member-dots-btn" onClick={onShare} aria-label="Ver quem está no grupo">
              <MemberDots members={members} accountId={accountId} />
            </button>
          )}
          {onShare && (
            <button type="button" className="hero-photo-btn" onClick={onShare} aria-label="Compartilhar viagem" title="Compartilhar viagem">
              <IconShare size={18} />
            </button>
          )}
          <CoverPhoto noun="viagem" photoId={trip.photoId ?? null} photoUrl={photoUrl} onPhoto={onPhoto} toast={toast} onBusy={setBusy} />
          <button type="button" className="hero-photo-btn" onClick={onEdit} aria-label="Editar viagem" title="Editar viagem">
            <IconPencil size={18} />
          </button>
        </span>
      </div>
      {fluent && !photoUrl && <Art kind="suitcase" size={64} className="hero-art" />}
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
  /** Grupo de cada viagem compartilhada (a foto do cartão pode vir de lá). */
  groups?: Record<string, string>;
  fluent: boolean;
  onOpen: (id: string) => void;
  onCreate: () => void;
  /** Exclui a viagem deste aparelho (pelos três pontinhos do cartão). */
  onDelete?: (id: string) => void;
}

/** Suas viagens: cada uma é uma caderneta na estante. */
export function TripList({ trips, groups = {}, fluent, onOpen, onCreate, onDelete }: ListProps) {
  const [menu, setMenu] = useState<Trip | null>(null);
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
        {trips.map((t) => (
          <li key={t.id} className="cover-item">
            <CoverCard trip={t} groupId={groups[t.id] ?? null} onOpen={onOpen} />
            {onDelete && (
              <button type="button" className="cover-more" onClick={() => setMenu(t)} aria-label={`Mais opções de ${t.name}`} title="Mais opções">
                <IconDots size={18} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="btn secondary new-trip" onClick={onCreate}>+ Nova viagem</button>
      {onDelete && (
        <Sheet open={!!menu} onClose={() => setMenu(null)} labelledBy="h-trip-menu">
          {menu && (
            <div className="sheet-body">
              <span className="sheet-grip" aria-hidden="true" />
              <h2 id="h-trip-menu" tabIndex={-1}>{menu.name}</h2>
              <div className="confirm" role="group" aria-labelledby="h-trip-menu-del">
                <p id="h-trip-menu-del">
                  <b>Excluir &quot;{menu.name}&quot;?</b> Todas as despesas e acertos saem deste celular.
                  {groups[menu.id] ? ' Para quem está no grupo, a viagem continua.' : ''}
                </p>
                <div className="sheet-actions">
                  <button type="button" className="btn secondary" onClick={() => setMenu(null)} autoFocus>Cancelar</button>
                  <button
                    type="button"
                    className="btn primary danger"
                    onClick={() => {
                      onDelete(menu.id);
                      setMenu(null);
                    }}
                  >
                    <IconTrash /> Excluir viagem
                  </button>
                </div>
              </div>
            </div>
          )}
        </Sheet>
      )}
    </section>
  );
}

/** Uma caderneta da estante. Com foto da viagem, a foto vira o fundo (como no cartão de dentro). */
function CoverCard({ trip: t, groupId, onOpen }: { trip: Trip; groupId: string | null; onOpen: (id: string) => void }) {
  const s = tripSummary(t);
  const dates = tripDates(t.start, t.end);
  const count = activeExpenses(t).length;
  const photoUrl = useReceiptUrl(t.photoId ?? null, groupId);
  const style = photoUrl ? ({ '--photo': `url("${photoUrl}")` } as CSSProperties) : undefined;
  return (
    <button
      type="button"
      className={`cover${photoUrl ? ' has-photo' : ''}`}
      style={style}
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
  );
}
