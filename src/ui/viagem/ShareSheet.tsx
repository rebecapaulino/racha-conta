import { useState } from 'react';
import type { Account } from '../../auth/account';
import { whatsappUrl } from '../../core/bill';
import { memberInitials } from '../../core/initials';
import { inviteUrl, type Member, type SyncStatus } from '../../sync/groups';
import { IconChat, IconCopy } from '../icons';
import { Sheet } from './Sheet';

/** Bolinhas com as iniciais de quem está no grupo (como no Excel). */
export function MemberDots({ members, accountId, max = 4 }: { members: Member[]; accountId: string | null; max?: number }) {
  const initials = memberInitials(members.map((m) => m.name));
  const shown = members.slice(0, max);
  const rest = members.length - shown.length;
  return (
    <span className="member-dots" aria-label={`No grupo: ${members.map((m) => (m.userId === accountId ? `${m.name} (você)` : m.name)).join(', ')}`}>
      {shown.map((m, i) => (
        <span key={m.userId} className="member-dot" style={{ '--pc': `var(--p${(i % 6) + 1})` } as React.CSSProperties} title={m.name} aria-hidden="true">
          {initials[i]}
        </span>
      ))}
      {rest > 0 && <span className="member-dot member-more" aria-hidden="true">+{rest}</span>}
    </span>
  );
}

interface Props {
  open: boolean;
  noun: 'viagem' | 'rolê';
  /** Nome da viagem ou do rolê. */
  title: string;
  /** Código do convite (null: ainda não compartilhou). */
  code: string | null;
  /** Mudanças feitas aqui que ainda não chegaram ao grupo. */
  pending?: number;
  /** Como está a conversa com o grupo, e o "Atualizar agora". */
  status?: SyncStatus;
  onRefresh?: () => void;
  members: Member[];
  account: Account | null;
  /** Cria o grupo e o link (só quem ainda não compartilhou). */
  onCreate: () => Promise<void>;
  toast: (msg: string) => void;
  onClose: () => void;
}

/** Compartilhar a viagem (ou o rolê): cria o link de convite e mostra quem já está no grupo. */
export function ShareSheet({ open, noun, title, code, pending = 0, status, onRefresh, members, account, onCreate, toast, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const url = code ? inviteUrl(code) : '';
  const art = noun === 'viagem' ? 'na viagem' : 'no rolê';
  const message = `Entra ${art} "${title}" no Racha Conta, para a gente dividir as contas juntos: ${url}`;
  const initials = memberInitials(members.map((m) => m.name));

  async function create() {
    setBusy(true);
    setError('');
    try {
      await onCreate();
    } catch {
      setError('Não deu para criar o link. Confira a internet e tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copiado');
    } catch {
      toast('Não deu para copiar. Segure o link para copiar.');
    }
  }

  return (
    <Sheet open={open} onClose={onClose} labelledBy="h-share-trip">
      <div className="sheet-body share-sheet">
        <span className="sheet-grip" aria-hidden="true" />
        <h2 id="h-share-trip" tabIndex={-1}>{noun === 'viagem' ? 'Compartilhar viagem' : 'Compartilhar rolê'}</h2>
        {!account ? (
          <p>Entre com o Google (no botão do topo) para compartilhar {noun === 'viagem' ? 'a viagem' : 'o rolê'}.</p>
        ) : !code ? (
          <>
            <p>
              Quem você convidar vê e edita <b>{title}</b> com você, como um grupo. Cada mudança vai para o grupo e aparece
              para os outros em alguns segundos. O registro mostra quem fez cada uma.
            </p>
            <p className="field-error" role="alert">{error}</p>
            <button type="button" className="btn primary big" onClick={create} disabled={busy}>
              {busy ? 'Criando o link…' : 'Criar link de convite'}
            </button>
          </>
        ) : (
          <>
            <label className="field-label" htmlFor="share-link">Link de convite</label>
            <input id="share-link" className="input share-link" readOnly value={url} onFocus={(e) => e.target.select()} />
            <div className="sheet-actions">
              <button type="button" className="btn secondary" onClick={copy}>
                <IconCopy /> Copiar link
              </button>
              <a className="btn primary" href={whatsappUrl(message)} target="_blank" rel="noopener noreferrer">
                <IconChat /> WhatsApp
              </a>
            </div>
            <div className="sync-box" aria-live="polite">
              <p className={`sync-state${pending ? ' is-pending' : ''}`}>
                {pending
                  ? `${pending === 1 ? '1 mudança sua ainda não foi enviada' : `${pending} mudanças suas ainda não foram enviadas`}.`
                  : '✓ Tudo o que você mudou já está no grupo.'}
              </p>
              {status?.error ? (
                <p className="sync-error">Não deu para falar com o grupo. {status.error}</p>
              ) : (
                <p className="hint">
                  {status?.checkedAt
                    ? `Conferido às ${new Date(status.checkedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}: o que os outros mudaram já aparece aqui.`
                    : 'Conferindo o grupo…'}
                </p>
              )}
              {onRefresh && (
                <button type="button" className="btn secondary" onClick={onRefresh}>
                  Atualizar agora
                </button>
              )}
            </div>
            <h3 className="field-label">No grupo ({members.length})</h3>
            {members.length === 0 ? (
              <p className="hint">Carregando quem está no grupo…</p>
            ) : (
              <ul className="list member-list">
                {members.map((m, i) => (
                  <li key={m.userId} className="row">
                    <span className="member-dot member-dot-lg" style={{ '--pc': `var(--p${(i % 6) + 1})` } as React.CSSProperties} aria-hidden="true">
                      {initials[i]}
                    </span>
                    <span className="row-main">
                      <b>
                        {m.name}
                        {m.userId === account.id && <span className="tag">você</span>}
                      </b>
                      <small>{m.role === 'owner' ? 'criou o grupo' : 'pode ver e editar'}</small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <button type="button" className="btn ghost" onClick={onClose}>Fechar</button>
      </div>
    </Sheet>
  );
}
