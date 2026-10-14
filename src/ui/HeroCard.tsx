import { useState, type CSSProperties } from 'react';
import type { Person } from '../core/bill';
import { formatBRL } from '../core/money';
import { AvatarStack } from './Avatar';
import { CoverPhoto } from './CoverPhoto';
import { shortDate } from './dates';
import { IconPencil, IconShare } from './icons';
import type { Member } from '../sync/groups';
import { MemberDots } from './viagem/ShareSheet';
import { Sheet } from './viagem/Sheet';
import { Art } from './illustrations';
import { usePhotoUrl } from './usePhotoUrl';

interface Props {
  title: string;
  startedAt: number;
  total: number;
  /** Serviço da conta; null quando ela tem várias notas (cada uma com o seu). */
  servicePct: number | null;
  notesCount: number;
  people: Person[];
  photoId: string | null;
  fluent: boolean;
  onPhoto: (photoId: string | null) => void;
  /** Troca o nome do rolê (o mesmo "Nome do lugar" de Pedidos). */
  onRename: (title: string) => void;
  toast: (msg: string) => void;
  /** Abre o compartilhar (sem isso, o botão não aparece). */
  onShare?: () => void;
  /** Quem está no grupo (rolê compartilhado). */
  members?: Member[];
  accountId?: string | null;
}

/** Cartão do total. Com foto do rolê, a foto vira o fundo (fica como lembrança no histórico). */
export function HeroCard({ title, startedAt, total, servicePct, notesCount, people, photoId, fluent, onPhoto, onRename, toast, onShare, members = [], accountId = null }: Props) {
  const photoUrl = usePhotoUrl(photoId);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  const style = photoUrl ? ({ '--photo': `url("${photoUrl}")` } as CSSProperties) : undefined;

  return (
    <section className={`hero${photoUrl ? ' has-photo' : ''}`} style={style} aria-label="Resumo da conta" aria-busy={busy}>
      <div className="hero-top">
        {/* Título com a data embaixo (como na Viagem): sobra lugar para os botões ao lado. */}
        <span className="trip-title">
          <span className="hero-title">{title.trim() || 'Conta da mesa'}</span>
          <span className="hero-date">{shortDate(startedAt)}</span>
        </span>
        <span className="hero-actions">
          {members.length > 0 && onShare && (
            <button type="button" className="member-dots-btn" onClick={onShare} aria-label="Ver quem está no grupo">
              <MemberDots members={members} accountId={accountId} max={3} />
            </button>
          )}
          {onShare && (
            <button type="button" className="hero-photo-btn" onClick={onShare} aria-label="Compartilhar rolê" title="Compartilhar rolê">
              <IconShare size={18} />
            </button>
          )}
          <CoverPhoto noun="rolê" photoId={photoId} photoUrl={photoUrl} onPhoto={onPhoto} toast={toast} onBusy={setBusy} />
          <button
            type="button"
            className="hero-photo-btn"
            onClick={() => {
              setName(title);
              setEditing(true);
            }}
            aria-label="Editar rolê"
            title="Editar rolê"
          >
            <IconPencil size={18} />
          </button>
        </span>
      </div>
      {fluent && !photoUrl && <Art kind="money" size={64} className="hero-art" />}
      <span className="hero-label">Total com serviço</span>
      <b className="hero-total">{formatBRL(total)}</b>
      <div className="hero-bottom">
        <span>
          {servicePct === null ? `${notesCount} notas` : servicePct ? `${servicePct}% de serviço` : 'sem serviço'}
          {people.length > 0 && ` · ${people.length} ${people.length === 1 ? 'pessoa' : 'pessoas'}`}
        </span>
        {people.length > 0 && <AvatarStack people={people} />}
      </div>

      <Sheet open={editing} onClose={() => setEditing(false)} labelledBy="h-role-edit" focus="#role-name">
        <form
          className="sheet-body"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() !== title.trim()) {
              onRename(name.trim());
              toast('Nome do rolê trocado');
            }
            setEditing(false);
          }}
        >
          <span className="sheet-grip" aria-hidden="true" />
          <h2 id="h-role-edit" tabIndex={-1}>Editar rolê</h2>
          <div className="note-field">
            <label className="field-label" htmlFor="role-name">Nome do lugar</label>
            <input
              id="role-name"
              className="input"
              maxLength={40}
              placeholder="Ex.: Bar do Zé"
              autoComplete="off"
              autoCapitalize="sentences"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="sheet-actions">
            <button type="button" className="btn secondary" onClick={() => setEditing(false)}>Cancelar</button>
            <button type="submit" className="btn primary">Salvar</button>
          </div>
        </form>
      </Sheet>
    </section>
  );
}
