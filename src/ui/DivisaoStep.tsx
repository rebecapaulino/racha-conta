import { useEffect, useRef, useState, type CSSProperties, type Dispatch } from 'react';
import { itemTotal, payments, summaryText, whatsappUrl, type Bill, type Payment, type PersonShare, type SplitResult } from '../core/bill';
import { formatBRL } from '../core/money';
import type { Action, LogEntry } from '../state/billState';
import { ActivityLog } from './ActivityLog';
import { Avatar } from './Avatar';
import { IconAlert, IconChat, IconCheck, IconChevron, IconCopy, IconImage, IconShare, Logo } from './icons';
import { Art } from './illustrations';
import { renderReceipt } from './receiptImage';
import { unassignedText } from './unassigned';
import { usePhotoUrl } from './usePhotoUrl';
import { activeVisual } from './visual';

interface Props {
  bill: Bill;
  result: SplitResult;
  startedAt: number;
  /** Id da conta, para o número curto da nota. */
  billId: string;
  photoId: string | null;
  log: LogEntry[];
  dispatch: Dispatch<Action>;
  toast: (msg: string) => void;
  /** Leva para o item na etapa Pedidos, para marcar quem consumiu. */
  onGoToItem: (itemId: string) => void;
}

/** Etapa 3: quanto cada um paga, quem pagou, a nota e o compartilhamento. */
export function DivisaoStep({ bill, result, startedAt, billId, photoId, log, dispatch, toast, onGoToItem }: Props) {
  const previewRef = useRef<HTMLDetailsElement>(null);
  const logRef = useRef<HTMLDialogElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const text = summaryText(bill, result);
  const payer = bill.people.find((p) => p.id === bill.payerId);
  const pay = payments(bill, result);
  const payOf = (id: string) => pay.rows.find((r) => r.share.person.id === id)!;
  const everyonePaid = pay.rows.length > 0 && pay.paidCount === pay.rows.length;
  const tracking = !!payer || pay.paidCount > 0;
  // Número curto e fixo da conta ("#K3F9A"), como o "Bill No." das notinhas.
  const billNumber = Array.from(billId)
    .reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261)
    .toString(36)
    .slice(0, 5)
    .toUpperCase();

  // Notinha em imagem: fica pronta antes do toque, porque o celular só abre o menu
  // de compartilhar logo depois do toque (se demorar, ele recusa).
  const photoUrl = usePhotoUrl(photoId);
  const imageRef = useRef<Blob | null>(null);
  const imageDialogRef = useRef<HTMLDialogElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileName = `racha-conta-${(bill.title.trim() || 'conta').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;

  function buildImage(): Promise<Blob> {
    return renderReceipt({ bill, result, startedAt, photoUrl });
  }

  useEffect(() => {
    imageRef.current = null;
    let alive = true;
    const t = window.setTimeout(() => {
      buildImage().then(
        (b) => alive && (imageRef.current = b),
        () => {},
      );
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refaz só quando a conta ou a foto mudam
  }, [bill, result, startedAt, photoUrl]);

  function download(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function shareImage() {
    let blob = imageRef.current;
    try {
      if (!blob) blob = await buildImage();
    } catch {
      toast('Não deu para montar a notinha. Copie o texto.');
      return;
    }
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: bill.title.trim() || 'Racha Conta' });
      } catch (e) {
        if ((e as DOMException).name === 'NotAllowedError') toast('Toque de novo em Enviar notinha.');
        // AbortError: a pessoa fechou o menu, nada a fazer
      }
      return;
    }
    download(blob);
    toast('Notinha salva. Anexe no WhatsApp.');
  }

  async function showImage() {
    try {
      const blob = imageRef.current ?? (await buildImage());
      setImageUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
      imageDialogRef.current?.showModal?.();
    } catch {
      toast('Não deu para montar a notinha.');
    }
  }

  function fallbackCopy() {
    if (previewRef.current) previewRef.current.open = true;
    const ta = textRef.current;
    if (!ta) return;
    ta.focus();
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    toast(ok ? 'Resumo copiado' : 'Texto selecionado. Copie manualmente.');
  }

  function copy() {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => toast('Resumo copiado'), fallbackCopy);
    } else {
      fallbackCopy();
    }
  }

  return (
    <div className="stack-y">
      <section aria-labelledby="h-shares" className="stack-y">
        <div className="section-head">
          <h2 id="h-shares">Quanto cada um paga</h2>
        </div>
        {result.shares.length === 0 ? (
          <div className="card empty">
            <span className="empty-icon" aria-hidden="true">{activeVisual() === 'fluent' ? <Art kind="receipt" size={36} /> : '🧾'}</span>
            <p><b>Sem pessoas na mesa.</b><br />Adicione quem vai dividir na etapa Mesa.</p>
          </div>
        ) : (
          <ul className="shares">
            {result.shares.map((s) => {
              const pct = result.total > 0 ? Math.round((s.total / result.total) * 100) : 0;
              const isPayer = s.person.id === bill.payerId;
              const p = payOf(s.person.id);
              const settled = p.state === 'paid' || p.state === 'over' || p.state === 'payer';
              return (
                <li key={s.person.id} className={`card share${settled ? ' is-paid' : ''}`}>
                  <div className="share-head">
                    <Avatar person={s.person} size="md" />
                    <span className="row-main">
                      <b>
                        {s.person.name}
                        {isPayer && <span className="tag">pagou</span>}
                      </b>
                      <small>
                        <span>consumo {formatBRL(s.consumption)}</span>
                        {bill.servicePct > 0 && <>{' '}<span>+ serviço {formatBRL(s.service)}</span></>}
                      </small>
                    </span>
                    <span className="share-amt">{formatBRL(s.total)}</span>
                  </div>
                  <div className="meter" style={{ '--pct': `${pct}%` } as CSSProperties} aria-hidden="true">
                    <span className="meter-fill" />
                    <span className="meter-knob">{pct}%</span>
                  </div>
                  <span className="sr">{pct}% do total</span>
                  <PayRow payment={p} dispatch={dispatch} nameOf={(id) => bill.people.find((x) => x.id === id)?.name ?? '?'} />
                  <ShareDetail share={s} servicePct={bill.servicePct} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {bill.people.length > 0 && (
        <section className="card" aria-labelledby="h-payer">
          <div className="card-head">
            <h2 id="h-payer">Quem pagou no caixa?</h2>
          </div>
          <div className="picker" role="radiogroup" aria-labelledby="h-payer">
            <button
              type="button"
              role="radio"
              aria-checked={!payer}
              className="pick"
              onClick={() => dispatch({ type: 'payer', id: null })}
            >
              <span className="avatar avatar-md avatar-none" aria-hidden="true">
                —{!payer && <span className="avatar-check"><IconCheck size={10} /></span>}
              </span>
              <span className="pick-name">Ninguém</span>
            </button>
            {bill.people.map((p) => {
              const on = p.id === bill.payerId;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className="pick"
                  onClick={() => dispatch({ type: 'payer', id: p.id })}
                >
                  <Avatar person={p} size="md" checked={on} />
                  <span className="pick-name">{p.name}</span>
                </button>
              );
            })}
          </div>
          {payer && result.shares.length > 1 && (
            <p className="callout">
              <b>{payer.name}</b> recebe <b className="num">{formatBRL(result.total - payOf(payer.id).share.total)}</b> dos outros
              {pay.paidCount > 1 && (
                <>
                  {' · '}
                  {pay.remaining > 0 ? <>falta <b className="num">{formatBRL(pay.remaining)}</b></> : <b>já recebeu tudo</b>}
                </>
              )}
              .
            </p>
          )}
        </section>
      )}

      {/* Nota no estilo das notinhas de app de delivery: sai de uma "impressora" preta. */}
      <div className="bill-printer">
        <section className="receipt" aria-labelledby="h-receipt">
          <div className="bill-top">
            <span className="bill-logo" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element -- foto local do aparelho */}
              {photoUrl ? <img src={photoUrl} alt="" /> : <Logo size={26} />}
            </span>
            <span className="bill-place">
              <h2 id="h-receipt">{bill.title.trim() || 'Conta da mesa'}</h2>
              <small>{bill.people.length} {bill.people.length === 1 ? 'pessoa' : 'pessoas'}</small>
            </span>
            <span className={`bill-status${everyonePaid ? ' paid' : ''}`}>
              {everyonePaid ? 'Tudo pago' : pay.paidCount > 0 ? `${pay.paidCount}/${pay.rows.length} pagos` : 'Em aberto'}
            </span>
          </div>

          <dl className="bill-meta">
            <div><dt>Conta nº</dt><dd>#{billNumber}</dd></div>
            <div>
              <dt>Data</dt>
              <dd>
                {new Date(startedAt).toLocaleDateString('pt-BR')}{' '}
                {new Date(startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </dd>
            </div>
            <div><dt>Pago por</dt><dd>{payer?.name ?? '—'}</dd></div>
          </dl>

          <hr className="dash" />

          {bill.items.length === 0 ? (
            <p className="hint">Nenhum item lançado.</p>
          ) : (
            <ol className="bill-items">
              {bill.items.map((it, i) => {
                const out = result.unassignedItems.some((u) => u.id === it.id);
                return (
                  <li key={it.id} className={out ? 'out' : undefined}>
                    <span>
                      {i + 1}. {it.name}
                      {(it.qty ?? 1) > 1 && <span className="bill-qty"> ×{it.qty}</span>}
                      {out && <span className="bill-qty"> · fora</span>}
                    </span>
                    <span className="num">{formatBRL(itemTotal(it))}</span>
                  </li>
                );
              })}
            </ol>
          )}

          <hr className="dash" />

          <dl className="bill-meta">
            <div><dt>Consumo</dt><dd>{formatBRL(result.subtotal)}</dd></div>
            <div><dt>Serviço{bill.servicePct ? ` (${bill.servicePct}%)` : ''}</dt><dd>{formatBRL(result.service)}</dd></div>
          </dl>
          <div className="grand">
            <span>Total geral</span>
            <b>{formatBRL(result.total)}</b>
          </div>

          <div aria-live="polite">
            {result.unassigned > 0 && (
              <div className="warn warn-block">
                <IconAlert size={16} />
                <span>
                  {unassignedText(result.unassignedItems)}
                  <button type="button" className="link-btn" onClick={() => onGoToItem(result.unassignedItems[0].id)}>
                    Marcar quem consumiu
                  </button>
                </span>
              </div>
            )}
          </div>

          {bill.people.length > 0 && (
            <div className="split-with">
              <span className="split-label">Dividido com</span>
              <ul>
                {result.shares.map((s) => (
                  <li key={s.person.id}>
                    <Avatar person={s.person} size="md" checked={payOf(s.person.id).state !== 'open' && payOf(s.person.id).state !== 'partial'} />
                    <span>{s.person.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button type="button" className="btn secondary see-image" onClick={showImage}>
            <IconImage /> Ver a notinha em imagem
          </button>
          <details className="preview" ref={previewRef}>
            <summary>Texto do resumo</summary>
            <label className="sr" htmlFor="summary">Texto do resumo</label>
            <textarea id="summary" ref={textRef} readOnly value={text} rows={8} />
            <a className="link-btn" href={whatsappUrl(text)} target="_blank" rel="noopener noreferrer">
              <IconChat size={18} /> Mandar só o texto no WhatsApp
            </a>
          </details>
        </section>

        <div className="printer">
          <span className="printer-slot" aria-hidden="true" />
          {tracking && everyonePaid ? (
            <>
              <span className="printer-label">Tudo acertado ✓</span>
              <b className="printer-amount">{formatBRL(result.total)}</b>
            </>
          ) : tracking ? (
            <>
              <span className="printer-label">{payer ? `Falta ${payer.name} receber` : 'Falta pagar'}</span>
              <b className="printer-amount">{formatBRL(pay.remaining)}</b>
              <span className="printer-sub">{pay.paidCount} de {pay.rows.length} já {pay.paidCount === 1 ? 'pagou' : 'pagaram'}</span>
            </>
          ) : (
            <>
              <span className="printer-label">Total da mesa</span>
              <b className="printer-amount">{formatBRL(result.total)}</b>
            </>
          )}
        </div>
      </div>

      <section className="card" aria-labelledby="h-log">
        <div className="card-head">
          <h2 id="h-log">Registro de alterações</h2>
          {log.length > 4 && (
            <button type="button" className="link-btn" onClick={() => logRef.current?.showModal?.()}>
              Ver tudo ({log.length})
            </button>
          )}
        </div>
        <ActivityLog log={log} limit={4} />
      </section>

      <dialog
        ref={logRef}
        className="sheet"
        aria-labelledby="h-log-all"
        onClick={(e) => e.target === e.currentTarget && logRef.current?.close()}
      >
        <div className="sheet-body">
          <span className="sheet-grip" aria-hidden="true" />
          <h2 id="h-log-all">Registro de alterações</h2>
          <p>Tudo o que mudou nesta conta, do mais novo para o mais antigo.</p>
          <ActivityLog log={log} />
          <button type="button" className="btn ghost" onClick={() => logRef.current?.close()}>
            Fechar
          </button>
        </div>
      </dialog>

      <dialog
        ref={imageDialogRef}
        className="sheet"
        aria-labelledby="h-image"
        onClick={(e) => e.target === e.currentTarget && imageDialogRef.current?.close()}
      >
        <div className="sheet-body">
          <span className="sheet-grip" aria-hidden="true" />
          <h2 id="h-image">Notinha do rolê</h2>
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada no aparelho */}
          {imageUrl && <img className="receipt-image" src={imageUrl} alt="Notinha com quanto cada um paga" />}
          <div className="sheet-actions">
            <button type="button" className="btn secondary" onClick={() => imageRef.current && download(imageRef.current)}>
              Baixar
            </button>
            <button type="button" className="btn primary" onClick={shareImage}>
              <IconShare /> Enviar
            </button>
          </div>
          <button type="button" className="btn ghost" onClick={() => imageDialogRef.current?.close()}>
            Fechar
          </button>
        </div>
      </dialog>

      <div className="share-actions">
        <button type="button" className="btn secondary" onClick={copy}>
          <IconCopy /> Copiar texto
        </button>
        <button type="button" className="btn primary" onClick={shareImage}>
          <IconShare /> Enviar notinha
        </button>
      </div>
    </div>
  );
}

/** "Por que gastou mais": itens da pessoa com a parte dela em cada um, mais o serviço. */
function ShareDetail({ share, servicePct }: { share: PersonShare; servicePct: number }) {
  const [open, setOpen] = useState(false);
  const id = `detalhe-${share.person.id}`;
  const name = share.person.name;
  return (
    <div className="share-detail">
      <button
        type="button"
        className="detail-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? 'Esconder' : `Ver o que ${name} consumiu`}
        <IconChevron size={18} />
      </button>
      {open && (
        <div id={id} className="detail-body">
          {share.parts.length === 0 ? (
            <p className="hint">Nenhum item marcado para {name}.</p>
          ) : (
            <ul className="detail-list">
              {share.parts.map(({ item, cents, splitBy }) => {
                const qty = item.qty ?? 1;
                return (
                  <li key={item.id}>
                    <span className="detail-name">
                      {qty > 1 ? `${qty}× ` : ''}
                      {item.name}
                      <small className={splitBy === 1 ? 'alone' : undefined}>
                        {splitBy === 1 ? `só ${name}` : `dividido em ${splitBy}`}
                      </small>
                    </span>
                    <span className="num">{formatBRL(cents)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <dl className="detail-sums">
            <div><dt>Consumo</dt><dd>{formatBRL(share.consumption)}</dd></div>
            {servicePct > 0 && (
              <div><dt>Serviço ({servicePct}%, proporcional ao consumo)</dt><dd>{formatBRL(share.service)}</dd></div>
            )}
            <div className="detail-total"><dt>Total de {name}</dt><dd>{formatBRL(share.total)}</dd></div>
          </dl>
        </div>
      )}
    </div>
  );
}

/** "Já pagou?": marca quem acertou a parte. Guarda o valor, então mostra se a conta mudou depois. */
function PayRow({ payment, dispatch, nameOf }: { payment: Payment; dispatch: Dispatch<Action>; nameOf: (id: string) => string }) {
  const { share, state, paid, owed, due, covers, coversCents, by } = payment;
  const id = share.person.id;
  const name = share.person.name;
  if (state === 'payer') {
    return (
      <div className="pay-row">
        <span className="pay-note ok"><IconCheck size={14} /> Pagou a conta no caixa</span>
      </div>
    );
  }
  if (state === 'covered') {
    return (
      <div className="pay-row">
        <span className="pay-note ok"><IconCheck size={14} /> {nameOf(by!)} paga a parte de {name}</span>
      </div>
    );
  }
  const set = (v: boolean) => dispatch({ type: 'markPaid', personId: id, paid: v });
  // Quem paga a parte de outras pessoas vê o total que paga.
  const with_ = covers.length > 0 && (
    <span className="pay-note">
      Paga também a parte de {covers.map(nameOf).join(', ')} (<span className="num">{formatBRL(coversCents)}</span>): <b className="num">{formatBRL(due)}</b> no total
    </span>
  );
  if (state === 'partial') {
    return (
      <div className="pay-row">
        {with_}
        <span className="pay-note warn-text">Pagou {formatBRL(paid)} · falta {formatBRL(owed)}</span>
        <button type="button" className="pay-btn" onClick={() => set(true)}>
          Pagou o resto
        </button>
      </div>
    );
  }
  const on = state === 'paid' || state === 'over';
  return (
    <div className="pay-row">
      {with_}
      {state === 'over' && <span className="pay-note warn-text">Pagou {formatBRL(-owed)} a mais</span>}
      <button
        type="button"
        className="pay-btn"
        aria-pressed={on}
        aria-label={on ? `${name} já pagou ${formatBRL(due)}. Toque para desmarcar` : `Marcar que ${name} já pagou ${formatBRL(due)}`}
        onClick={() => set(!on)}
      >
        {on ? (<><IconCheck size={16} /> Pago</>) : 'Marcar como pago'}
      </button>
    </div>
  );
}
