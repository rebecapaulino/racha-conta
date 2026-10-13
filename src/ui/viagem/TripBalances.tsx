import { useEffect, useRef, useState, type CSSProperties, type Dispatch } from 'react';
import { whatsappUrl } from '../../core/bill';
import { formatBRL } from '../../core/money';
import type { Transfer } from '../../core/settle';
import { accountMembers, accountOf, activeExpenses, categoryLabel, groupByPayer, settleTransfers, tripBalancesText, tripSettleText, type SettleMode, type SettleRow, type Trip, type TripSummary } from '../../core/trip';
import type { TripAction } from '../../state/tripState';
import { Avatar } from '../Avatar';
import { IconAlert, IconCheck, IconCopy, IconImage, IconShare } from '../icons';
import { Art } from '../illustrations';
import { CategoryIcon } from './CategoryIcon';
import { PersonAccount } from './PersonAccount';
import { Sheet } from './Sheet';
import { Signed } from './Signed';
import { renderTripImage } from './tripImage';

/** "R$ 1.486,75" sem quebrar a linha entre o "R$" e o número. */
const glued = (cents: number) => formatBRL(cents).replace(' ', '\u00a0');

interface Props {
  trip: Trip;
  summary: TripSummary;
  meId: string | null;
  fluent: boolean;
  dispatch: Dispatch<TripAction>;
  toast: (msg: string, undo?: () => void) => void;
  onSettle: (t: Transfer) => void;
}

/** Saldos: quem paga quem para ficar quite, o saldo de cada um, os gastos por categoria e o resumo. */
export function TripBalances({ trip, summary, meId, fluent, dispatch, toast, onSettle }: Props) {
  const [kind, setKind] = useState<'acerto' | 'saldos'>('acerto');
  const person = (id: string) => trip.people.find((p) => p.id === id)!;
  const called = (id: string, lower = false) => (id === meId ? (lower ? 'você' : 'Você') : person(id).name);
  const hasExpenses = activeExpenses(trip).length > 0;
  const mode: SettleMode = trip.settleMode ?? 'direct';
  const transfers = settleTransfers(summary, mode);
  const rows = summary.plan[mode];
  const groups = groupByPayer(rows, trip);

  /** Desmarca um pagamento feito (com Desfazer, caso tenha sido sem querer). */
  function unpay(r: SettleRow) {
    const paid = trip.settlements.filter((x) => accountOf(trip, x.from) === r.from && accountOf(trip, x.to) === r.to);
    for (const x of paid) dispatch({ type: 'unsettle', id: x.id });
    toast(`Pagamento para ${called(r.to, true)} desmarcado`, () => {
      for (const x of paid) dispatch({ type: 'settle', id: x.id, from: x.from, to: x.to, cents: x.cents });
    });
  }
  const text = kind === 'acerto' ? tripSettleText(trip, summary, mode) : tripBalancesText(trip, summary);

  // Resumo em imagem: fica pronto antes do toque, porque o celular só abre o menu de
  // compartilhar logo depois do toque (se demorar, ele recusa).
  const imageRef = useRef<Blob | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileName = `racha-conta-${(trip.name.trim() || 'viagem').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;
  useEffect(() => {
    imageRef.current = null;
    let alive = true;
    const t = window.setTimeout(() => {
      renderTripImage({ trip, summary, mode }).then(
        (b) => alive && (imageRef.current = b),
        () => {},
      );
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [trip, summary, mode]);

  async function getImage() {
    return imageRef.current ?? (imageRef.current = await renderTripImage({ trip, summary, mode }));
  }

  async function showImage() {
    try {
      const blob = await getImage();
      setImageUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
    } catch {
      toast('Não deu para montar a imagem.');
    }
  }

  function download(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function shareImage() {
    let blob: Blob;
    try {
      blob = await getImage();
    } catch {
      toast('Não deu para montar a imagem. Copie o texto.');
      return;
    }
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: trip.name });
      } catch (e) {
        if ((e as DOMException).name === 'NotAllowedError') toast('Toque de novo em Enviar.');
      }
      return;
    }
    download(blob);
    toast('Imagem salva. Anexe no WhatsApp.');
  }

  function setMode(next: SettleMode) {
    if (next !== mode) dispatch({ type: 'editTrip', settleMode: next });
  }
  const biggest = Math.max(1, ...summary.people.map((r) => Math.abs(r.balance)));
  const [selected, setSelected] = useState(meId ?? trip.people[0]?.id ?? '');
  const accountRef = useRef<HTMLElement>(null);

  /** Abre a conta detalhada da pessoa e rola até ela. */
  function explain(id: string) {
    setSelected(id);
    const el = accountRef.current;
    if (!el) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    el.focus({ preventScroll: true });
  }

  function copy() {
    if (!navigator.clipboard?.writeText) {
      toast('Não deu para copiar neste navegador. Use Enviar.');
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => toast('Resumo copiado'),
      () => toast('Não deu para copiar. Use Enviar.'),
    );
  }

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

  if (!summary.ok) {
    return (
      <p className="warn" role="alert">
        <IconAlert size={16} />
        <span>
          <b>Alguma despesa não fechou ao centavo.</b> Para não mostrar números errados, os saldos ficam escondidos.
          Abra a última despesa lançada e salve de novo.
        </span>
      </p>
    );
  }

  if (!hasExpenses) {
    return (
      <section className="card empty">
        <span className="empty-icon">{fluent ? <Art kind="money" size={36} /> : '⚖️'}</span>
        <p><b>Nada para acertar ainda.</b><br />Os saldos aparecem aqui assim que você lançar a primeira despesa.</p>
      </section>
    );
  }

  return (
    <div className="stack-y trip-balances">
      <section className="card" aria-labelledby="h-quite">
        <div className="card-head">
          <h2 id="h-quite">Para ficar tudo quite</h2>
          {transfers.length > 0 && <span className="badge" aria-label={`${transfers.length} pagamentos`}>{transfers.length}</span>}
        </div>
        <div className="seg two" role="group" aria-label="Como acertar">
          <button type="button" aria-pressed={mode === 'direct'} onClick={() => setMode('direct')}>Direto para quem pagou</button>
          <button type="button" aria-pressed={mode === 'min'} onClick={() => setMode('min')}>Menos Pix</button>
        </div>
        <p className="hint" aria-live="polite">
          {mode === 'direct'
            ? 'Cada um paga para quem pagou as despesas dele. Entre duas pessoas, só a diferença.'
            : 'O app junta tudo e faz o menor número de Pix. O dinheiro pode ir para outra pessoa, mas o total de cada um é o mesmo.'}
        </p>
        {rows.length === 0 ? (
          <p className="all-square"><IconCheck size={16} /> Está tudo quite!</p>
        ) : (
          <>
            {transfers.length === 0 && (
              <p className="all-square" role="status"><IconCheck size={16} /> Tudo pago! Está todo mundo quite.</p>
            )}
            <ul className="pay-groups">
              {groups.map((g) => {
                const left = g.items.reduce((a, r) => a + r.remaining, 0);
                const members = accountMembers(trip, g.from);
                return (
                  <li key={g.from} className={`pay-group${left === 0 ? ' is-done' : ''}`}>
                    <div className="pay-head">
                      <Avatar person={person(g.from)} size="md" />
                      <span className="pay-who">
                        <b>{called(g.from)} paga</b>
                        {members.length > 0 && (
                          <small className="pay-with">com a parte de {members.map((m) => called(m.id, true)).join(', ')}</small>
                        )}
                        <small className={left === 0 ? 'amt-pos' : undefined}>
                          {left === 0
                            ? '✓ Tudo pago'
                            : g.items.length === 1
                              ? 'para 1 pessoa'
                              : `${glued(left)} ${left === g.cents ? 'no total' : 'faltando'}, para ${g.items.length} pessoas`}
                        </small>
                      </span>
                    </div>
                    <ul className="pay-items">
                      {g.items.map((r) => {
                        const done = r.remaining === 0;
                        return (
                          <li key={r.to} className={`pay-item${done ? ' is-paid' : ''}`}>
                            <Avatar person={person(r.to)} size="md" />
                            <span className="pay-to">
                              <span className="pay-line">
                                <span className="pay-name">
                                  <span className="sr">{called(g.from)} paga </span>
                                  para <b>{called(r.to, true)}</b>
                                </span>
                                {done ? (
                                  <b className="num amt-pos pay-amount">{glued(r.cents)}</b>
                                ) : (
                                  <Signed cents={-r.remaining} className="pay-amount" />
                                )}
                              </span>
                              {r.paid > 0 && !done && (
                                <small className="pay-partial">
                                  <span className="amt-pos">já pagou {glued(r.paid)}</span> de {glued(r.cents)}
                                </small>
                              )}
                              {done ? (
                                <button
                                  type="button"
                                  className="btn secondary settle-btn is-paid"
                                  aria-pressed="true"
                                  onClick={() => unpay(r)}
                                  aria-label={`Pago: ${called(r.from)} pagou ${formatBRL(r.cents)} para ${called(r.to, true)}. Toque para desmarcar`}
                                >
                                  <IconCheck size={16} /> Pago
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn secondary settle-btn"
                                  onClick={() => onSettle({ from: r.from, to: r.to, cents: r.remaining })}
                                  aria-label={`Registrar: ${called(r.from)} pagou ${formatBRL(r.remaining)} para ${called(r.to, true)}`}
                                >
                                  <IconCheck size={16} /> {r.paid > 0 ? 'Pagar o resto' : 'Pago'}
                                </button>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <button type="button" className="link-btn pay-why" onClick={() => explain(g.from)}>
                      Por que {called(g.from, true)} paga isso? Ver a conta
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {trip.settlements.length > 0 && (
          <div className="settled">
            <h3 className="field-label">Histórico de pagamentos</h3>
            <ul className="list">
              {[...trip.settlements].reverse().map((s) => (
                <li key={s.id} className="settled-row">
                  <span className="ok-dot" aria-hidden="true"><IconCheck size={12} /></span>
                  <span className="settled-text">
                    {called(s.from)} pagou <b className="num">{formatBRL(s.cents)}</b> para {called(s.to, true)}
                  </span>
                  <button
                    type="button"
                    className="link-btn"
                    aria-label={`Desfazer: ${person(s.from).name} pagou ${formatBRL(s.cents)} para ${person(s.to).name}`}
                    onClick={() => {
                      dispatch({ type: 'unsettle', id: s.id });
                      toast('Pagamento desfeito');
                    }}
                  >
                    Desfazer
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {trip.people.length > 0 && (
        <PersonAccount ref={accountRef} trip={trip} transfers={transfers} mode={mode} meId={meId} selected={selected} onSelect={setSelected} />
      )}

      <section className="card" aria-labelledby="h-balances">
        <div className="card-head">
          <h2 id="h-balances">Saldos</h2>
        </div>
        <p className="hint">Quanto cada um pagou menos quanto consumiu. Quem pôs mais no caixa recebe.</p>
        <ul className="list balances">
          {summary.people.map(({ person: p, paid, owes, sent, received, balance }) => {
            const state = balance > 0 ? 'in' : balance < 0 ? 'out' : 'zero';
            const style = { '--w': `${(Math.abs(balance) / biggest) * 50}%` } as CSSProperties;
            return (
              <li key={p.id} className={`balance balance-${state}`}>
                <div className="balance-top">
                  <Avatar person={p} size="md" />
                  <span className="row-main">
                    <b>
                      {p.name}
                      {p.id === meId && <span className="tag">você</span>}
                    </b>
                    <small className="balance-lines">
                      <span>pagou {glued(paid)}</span>
                      <span>consumiu {glued(owes)}</span>
                      {sent > 0 && <span>já mandou {glued(sent)}</span>}
                      {received > 0 && <span>já recebeu {glued(received)}</span>}
                    </small>
                  </span>
                  <span className="balance-tag">
                    {state === 'in' ? 'recebe' : state === 'out' ? 'paga' : 'quite'}
                    {state !== 'zero' && <Signed cents={balance} />}
                  </span>
                </div>
                <span className="balance-bar" style={style} aria-hidden="true"><i /></span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card" aria-labelledby="h-cats">
        <div className="card-head">
          <h2 id="h-cats">Gastos por categoria</h2>
          <span className="muted num">{formatBRL(summary.total)}</span>
        </div>
        <ul className="list cat-bars">
          {summary.byCategory.map(({ category, cents }) => {
            const pct = summary.total ? Math.round((cents / summary.total) * 100) : 0;
            return (
              <li key={category} className="cat-bar">
                <span className="cat-tile"><CategoryIcon category={category} size={18} /></span>
                <span className="cat-bar-main">
                  <span className="cat-bar-line">
                    <b>{categoryLabel(trip, category)}</b>
                    <span className="num">{formatBRL(cents)}</span>
                  </span>
                  <span className="cat-meter" style={{ '--pct': `${Math.max(2, (cents / summary.total) * 100)}%` } as CSSProperties} aria-hidden="true"><i /></span>
                  <small>{pct}% da viagem</small>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card" aria-labelledby="h-share">
        <div className="card-head">
          <h2 id="h-share">Resumo para o grupo</h2>
        </div>
        <div className="seg two" role="group" aria-label="Qual resumo mandar">
          <button type="button" aria-pressed={kind === 'acerto'} onClick={() => setKind('acerto')}>Quem paga quem</button>
          <button type="button" aria-pressed={kind === 'saldos'} onClick={() => setKind('saldos')}>Saldos</button>
        </div>
        <pre className="share-preview" aria-label="Texto que vai ser enviado">{text}</pre>
        <button type="button" className="btn secondary see-image" onClick={showImage}>
          <IconImage /> Ver o resumo em imagem
        </button>
      </section>

      <div className="share-actions">
        <button type="button" className="btn secondary" onClick={copy}>
          <IconCopy /> Copiar texto
        </button>
        <button type="button" className="btn primary" onClick={send}>
          <IconShare /> Enviar texto
        </button>
      </div>

      <Sheet open={!!imageUrl} onClose={() => setImageUrl(null)} labelledBy="h-trip-image">
        <div className="sheet-body">
          <span className="sheet-grip" aria-hidden="true" />
          <h2 id="h-trip-image" tabIndex={-1}>Resumo em imagem</h2>
          {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada no aparelho */}
          {imageUrl && <img className="receipt-image" src={imageUrl} alt="Resumo da viagem: quem paga quem e quanto cada um gastou" />}
          <div className="sheet-actions">
            <button type="button" className="btn secondary" onClick={() => imageRef.current && download(imageRef.current)}>
              Baixar
            </button>
            <button type="button" className="btn primary" onClick={shareImage}>
              <IconShare /> Enviar
            </button>
          </div>
          <button type="button" className="btn ghost" onClick={() => setImageUrl(null)}>Fechar</button>
        </div>
      </Sheet>
    </div>
  );
}
