import { useEffect, useState } from 'react';
import { previewInvite, type InvitePreview } from '../sync/groups';
import { Sheet } from './viagem/Sheet';

export type InviteStatus = 'loading' | 'ready' | 'invalid' | 'joining' | 'error';
export interface Invite {
  code: string;
  preview: InvitePreview | null;
  status: InviteStatus;
}

export const inviteCodeInUrl = () => new URLSearchParams(window.location.search).get('convite');

/** Tira o "?convite=…" do endereço (depois de entrar ou de recusar). */
export function clearInviteUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('convite');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

/**
 * Convite aberto pelo link: mostra de quem é e de qual tipo (viagem ou rolê). Convite do
 * outro tipo é ignorado aqui (a área certa cuida dele).
 */
export function useInvite(kind: 'trip' | 'role', signedIn: boolean) {
  const [invite, setInvite] = useState<Invite | null>(() => {
    const code = inviteCodeInUrl();
    return code ? { code, preview: null, status: 'loading' } : null;
  });
  const loadingCode = invite?.status === 'loading' ? invite.code : null;
  useEffect(() => {
    if (!loadingCode || !signedIn) return;
    previewInvite(loadingCode).then(
      (preview) => {
        if (preview && preview.kind !== kind) setInvite(null);
        else setInvite({ code: loadingCode, preview, status: preview ? 'ready' : 'invalid' });
      },
      () => setInvite({ code: loadingCode, preview: null, status: 'error' }),
    );
  }, [loadingCode, signedIn, kind]);

  function close() {
    clearInviteUrl();
    setInvite(null);
  }
  return { invite, setInvite, close };
}

/** "Fulano te chamou para a viagem X" → Entrar no grupo. */
export function InviteSheet({ invite, noun, onJoin, onClose }: { invite: Invite | null; noun: 'viagem' | 'rolê'; onJoin: () => void; onClose: () => void }) {
  const p = invite?.preview;
  return (
    <Sheet open={!!invite && invite.status !== 'loading'} onClose={onClose} labelledBy="h-invite">
      <div className="sheet-body">
        <span className="sheet-grip" aria-hidden="true" />
        <h2 id="h-invite" tabIndex={-1}>{noun === 'viagem' ? 'Convite para viagem' : 'Convite para rolê'}</h2>
        {invite?.status === 'invalid' ? (
          <p>Esse convite não vale mais. Peça um link novo para quem te chamou.</p>
        ) : invite?.status === 'error' ? (
          <p className="field-error" role="alert">Não deu para abrir o convite. Confira a internet e tente de novo.</p>
        ) : p ? (
          <p>
            <b>{p.ownerName || 'Alguém'}</b> te chamou para {noun === 'viagem' ? 'a viagem' : 'o rolê'} <b>{p.title || (noun === 'viagem' ? 'sem nome' : 'Conta da mesa')}</b>
            {' '}({p.members} {p.members === 1 ? 'pessoa' : 'pessoas'} no grupo). Entrando, você vê e edita junto.
          </p>
        ) : null}
        <div className="sheet-actions">
          <button type="button" className="btn secondary" onClick={onClose}>Agora não</button>
          {invite && p && invite.status !== 'invalid' && (
            <button type="button" className="btn primary" onClick={onJoin} disabled={invite.status === 'joining'}>
              {invite.status === 'joining' ? 'Entrando…' : 'Entrar no grupo'}
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
