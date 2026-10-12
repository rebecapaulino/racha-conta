import type { Dispatch } from 'react';
import { groupSummary, groupSummaryText, whatsappUrl, type Bill } from '../core/bill';
import { formatBRL } from '../core/money';
import type { Action } from '../state/billState';
import { Avatar } from './Avatar';
import { IconArrowRight, IconCheck, IconCopy, IconShare } from './icons';
import { categoryEmoji } from '../core/noteCategory';

interface Props {
  /** A conta inteira, com todas as notas. */
  bill: Bill;
  dispatch: Dispatch<Action>;
  toast: (msg: string) => void;
  /** Abre a nota na visão "Por nota" (para escolher quem pagou, por exemplo). */
  onOpenNote: (noteId: string) => void;
}

/** Resumo do grupo: quem paga para quem, quanto cada um gastou e as notas. */
export function GroupSummary({ bill, dispatch, toast, onOpenNote }: Props) {
  const g = groupSummary(bill);
  const name = (id: string) => bill.people.find((p) => p.id === id)!;
  const settled = bill.settled ?? [];
  const anyPayer = g.notes.some((n) => n.payer);
  const text = groupSummaryText(bill, g);

  function copy() {
    if (!navigator.clipboard?.writeText) {
      toast('Não deu para copiar neste navegador. Use Enviar resumo.');
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => toast('Resumo copiado'),
      () => toast('Não deu para copiar. Use Enviar resumo.'),
    );
  }

  // Abre o menu de compartilhar do celular (WhatsApp, Telegram…); sem ele, vai direto ao WhatsApp.
  async function send() {
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        /* a pessoa fechou o menu */
      }
      return;
    }
    window.open(whatsappUrl(text), '_blank', 'noopener');
  }

  return (
    <div className="stack-y group-summary">
      <section className="card" aria-labelledby="h-transfers">
        <div className="card-head">
          <h2 id="h-transfers">Quem paga para quem</h2>
        </div>

        {g.transfers.length > 0 ? (
          <ul className="list transfers">
            {g.transfers.map((t) => {
              const from = name(t.from);
              const to = name(t.to);
              return (
                <li key={`${t.from}-${t.to}`} className="transfer">
                  <span className="transfer-who">
                    <Avatar person={from} size="sm" />
                    <span className="transfer-text">
                      <b>{from.name}</b> paga para <b>{to.name}</b>
                    </span>
                    <b className="transfer-amount num">{formatBRL(t.cents)}</b>
                  </span>
                  <button
                    type="button"
                    className="btn secondary transfer-btn"
                    onClick={() => {
                      dispatch({ type: 'settle', from: t.from, to: t.to, cents: t.cents });
                      toast(`${from.name} pagou ${formatBRL(t.cents)} a ${to.name}`);
                    }}
                  >
                    <IconCheck size={16} /> Marcar como pago
                  </button>
                </li>
              );
            })}
          </ul>
        ) : anyPayer ? (
          <p className="scan-check ok"><IconCheck size={16} /> Tudo acertado entre o grupo.</p>
        ) : (
          <p className="hint">Escolha quem pagou cada nota para o app dizer quem paga para quem.</p>
        )}

        {g.withoutPayer.map((n) => (
          <p key={n.note.id || 'unica'} className="group-hint">
            <span aria-hidden="true">{categoryEmoji(n.note.category)}</span>
            <span><b>{n.label}</b> está sem quem pagou: cada um paga a sua parte no caixa.</span>
            <button type="button" className="link-btn" onClick={() => onOpenNote(n.note.id)}>Escolher</button>
          </p>
        ))}

        {settled.length > 0 && (
          <div className="settled">
            <h3 className="field-label">Já acertado</h3>
            <ul className="list">
              {settled.map((t, i) => (
                <li key={i} className="settled-row">
                  <span className="ok-dot" aria-hidden="true"><IconCheck size={12} /></span>
                  <span className="settled-text">
                    {name(t.from).name} pagou <b className="num">{formatBRL(t.cents)}</b> a {name(t.to).name}
                  </span>
                  <button
                    type="button"
                    className="link-btn"
                    aria-label={`Desfazer: ${name(t.from).name} pagou ${formatBRL(t.cents)} a ${name(t.to).name}`}
                    onClick={() => dispatch({ type: 'unsettle', index: i })}
                  >
                    Desfazer
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="h-spent">
        <div className="card-head">
          <h2 id="h-spent">Quanto cada um gastou</h2>
          <span className="muted num">{formatBRL(g.total)}</span>
        </div>
        <ul className="list">
          {g.people.map(({ person, byNote, total }) => (
            <li key={person.id} className="row spent-row">
              <Avatar person={person} size="md" />
              <span className="row-main">
                <b>{person.name}</b>
                <small className="spent-parts">
                  {byNote.every((v) => v === 0)
                    ? 'não entrou em nenhuma nota'
                    : g.notes.map((n, i) =>
                        byNote[i] > 0 ? (
                          <span key={n.note.id || 'unica'} className="nowrap">
                            {categoryEmoji(n.note.category)} {n.label} {formatBRL(byNote[i])}
                          </span>
                        ) : null,
                      )}
                </small>
              </span>
              <b className="num spent-total">{formatBRL(total)}</b>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="h-group-notes">
        <div className="card-head">
          <h2 id="h-group-notes">Notas</h2>
          <span className="muted">{g.notes.length}</span>
        </div>
        <ul className="list">
          {g.notes.map((n) => (
              <li key={n.note.id || 'unica'}>
                <button type="button" className="row note-row" onClick={() => onOpenNote(n.note.id)}>
                  <span className="note-emoji" aria-hidden="true">{categoryEmoji(n.note.category)}</span>
                  <span className="row-main">
                    <b>{n.label}</b>
                    <small>{n.payer ? `paga por ${n.payer.name}` : 'sem quem pagou'}</small>
                  </span>
                  <b className="num">{formatBRL(n.result.total)}</b>
                  <IconArrowRight size={18} />
                </button>
              </li>
          ))}
        </ul>
      </section>

      <div className="share-actions">
        <button type="button" className="btn secondary" onClick={copy}>
          <IconCopy /> Copiar texto
        </button>
        <button type="button" className="btn primary" onClick={send}>
          <IconShare /> Enviar resumo
        </button>
      </div>
    </div>
  );
}
