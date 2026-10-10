import { useRef, useState, type CSSProperties } from 'react';
import { computeSplit, payments } from '../core/bill';
import { formatBRL } from '../core/money';
import type { HistoryEntry } from '../state/history';
import { ActivityLog } from './ActivityLog';
import { Avatar, AvatarStack } from './Avatar';
import { longDate } from './dates';
import { IconArrowLeft, IconTrash } from './icons';
import { Art } from './illustrations';
import { usePhotoUrl } from './usePhotoUrl';

interface Props {
  entries: HistoryEntry[];
  fluent: boolean;
  onBack: () => void;
  onReopen: (e: HistoryEntry) => void;
  onDelete: (e: HistoryEntry) => void;
}

/** Rolês: as contas anteriores em cartões com a foto, para lembrar e tirar dúvida de quem estava. */
export function HistoryScreen({ entries, fluent, onBack, onReopen, onDelete }: Props) {
  const [open, setOpen] = useState<HistoryEntry | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  function show(e: HistoryEntry) {
    setOpen(e);
    dialogRef.current?.showModal?.();
  }

  function close() {
    dialogRef.current?.close();
  }

  return (
    <div className="history">
      <header className="topbar">
        <button type="button" className="round-btn" onClick={onBack} aria-label="Voltar para a conta">
          <IconArrowLeft />
        </button>
        <h1 className="page-title">Rolês</h1>
        <span className="muted">{entries.length > 0 && `${entries.length} ${entries.length === 1 ? 'conta' : 'contas'}`}</span>
      </header>

      {entries.length === 0 ? (
        <div className="card empty">
          <span className="empty-icon" aria-hidden="true">{fluent ? <Art kind="receipt" size={36} /> : '📸'}</span>
          <p>
            <b>Nenhum rolê guardado ainda.</b>
            <br />
            Quando você tocar em &quot;Nova conta&quot;, a conta atual vem para cá, com a foto.
          </p>
        </div>
      ) : (
        <ul className="memories">
          {entries.map((e) => (
            <li key={e.id}>
              <MemoryCard entry={e} fluent={fluent} onOpen={() => show(e)} />
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialogRef}
        className="sheet"
        aria-labelledby="h-memory"
        onClose={() => setOpen(null)}
        onClick={(ev) => ev.target === ev.currentTarget && close()}
      >
        {open && (
          <MemoryDetail
            key={open.id}
            entry={open}
            onClose={close}
            onReopen={() => {
              close();
              onReopen(open);
            }}
            onDelete={() => {
              close();
              onDelete(open);
            }}
          />
        )}
      </dialog>
    </div>
  );
}

function MemoryCard({ entry, fluent, onOpen }: { entry: HistoryEntry; fluent: boolean; onOpen: () => void }) {
  const url = usePhotoUrl(entry.photoId);
  const { bill } = entry;
  const split = computeSplit(bill);
  const total = split.total;
  // "2/4 pagos" no cartão, para saber de longe quem ainda deve naquele rolê.
  const pay = payments(bill, split);
  const tracking = !!bill.payerId || Object.keys(bill.paid ?? {}).length > 0;
  const allPaid = tracking && pay.rows.length > 0 && pay.paidCount === pay.rows.length;
  const paidLabel = !tracking ? null : allPaid ? '✓ Tudo pago' : `${pay.paidCount}/${pay.rows.length} pagos`;
  const n = bill.people.length;
  const name = bill.title.trim() || 'Conta da mesa';
  const style = url ? ({ '--photo': `url("${url}")` } as CSSProperties) : undefined;

  return (
    <button
      type="button"
      className={`memory${url ? ' has-photo' : ''}`}
      style={style}
      onClick={onOpen}
      aria-label={`${name}, ${longDate(entry.startedAt)}, ${formatBRL(total)}, ${n} ${n === 1 ? 'pessoa' : 'pessoas'}`}
    >
      {!url && fluent && <Art kind="money" size={72} className="memory-art" />}
      <span className="memory-chips">
        <span className="memory-date">{longDate(entry.startedAt)}</span>
        {paidLabel && <span className={`memory-date memory-paid${allPaid ? ' all' : ''}`}>{paidLabel}</span>}
      </span>
      <span className="memory-info">
        <span className="memory-main">
          <b className="memory-name">{name}</b>
          <span className="memory-people">
            {n > 0 && <AvatarStack people={bill.people} />}
            {n} {n === 1 ? 'pessoa' : 'pessoas'}
          </span>
        </span>
        <b className="memory-total">{formatBRL(total)}</b>
      </span>
    </button>
  );
}

function MemoryDetail({
  entry,
  onClose,
  onReopen,
  onDelete,
}: {
  entry: HistoryEntry;
  onClose: () => void;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const url = usePhotoUrl(entry.photoId);
  const [confirm, setConfirm] = useState(false);
  const { bill } = entry;
  const result = computeSplit(bill);
  const payer = bill.people.find((p) => p.id === bill.payerId);

  return (
    <div className="sheet-body">
      <span className="sheet-grip" aria-hidden="true" />
      {/* Foto local (blob) do aparelho: o otimizador de imagens do Next não se aplica. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img className="memory-photo" src={url} alt={`Foto do rolê ${bill.title}`} />}
      <h2 id="h-memory">{bill.title.trim() || 'Conta da mesa'}</h2>
      <p>
        {longDate(entry.startedAt)} · {bill.items.length} {bill.items.length === 1 ? 'item' : 'itens'} ·{' '}
        <b className="num">{formatBRL(result.total)}</b>
      </p>

      {result.shares.length > 0 && (
        <ul className="list memory-list" aria-label="Quem estava">
          {result.shares.map((s) => (
            <li key={s.person.id} className="row">
              <Avatar person={s.person} size="sm" />
              <span className="row-main">
                <b>
                  {s.person.name}
                  {s.person.id === payer?.id && <span className="tag">pagou</span>}
                </b>
              </span>
              <span className="num">{formatBRL(s.total)}</span>
            </li>
          ))}
        </ul>
      )}

      {(entry.log?.length ?? 0) > 0 && (
        <details className="preview">
          <summary>Registro de alterações ({entry.log.length})</summary>
          <ActivityLog log={entry.log} />
        </details>
      )}

      {confirm ? (
        <div className="confirm" role="group" aria-labelledby="h-del">
          <p id="h-del"><b>Apagar este rolê?</b> A conta e a foto saem deste aparelho.</p>
          <div className="sheet-actions">
            <button type="button" className="btn secondary" onClick={() => setConfirm(false)} autoFocus>
              Cancelar
            </button>
            <button type="button" className="btn primary danger" onClick={onDelete}>
              Apagar
            </button>
          </div>
        </div>
      ) : (
        <div className="sheet-actions">
          <button type="button" className="btn secondary" onClick={() => setConfirm(true)}>
            <IconTrash /> Apagar
          </button>
          <button type="button" className="btn primary" onClick={onReopen}>
            Reabrir conta
          </button>
        </div>
      )}
      <button type="button" className="btn ghost" onClick={onClose}>
        Fechar
      </button>
    </div>
  );
}
