import { useEffect, useRef, useState, type Dispatch } from 'react';
import { MAX_ITEM_NAME, MAX_QTY, SERVICE_OPTIONS, type Bill, type ServicePct } from '../core/bill';
import { formatBRL, parseBRL } from '../core/money';
import { expectedItemsTotal, type ParsedReceipt } from '../receipt/parse';
import { defaultReader, type ReadProgress } from '../receipt/reader';
import { newId, type Action } from '../state/billState';
import { deletePhoto, putPhoto, shrinkPhoto } from '../state/photos';
import { forgetPhotoUrl, rememberPhotoUrl } from './usePhotoUrl';
import { IconAlert, IconCamera, IconCheck, IconChevron, IconImage, IconMinus, IconPlus, IconReceipt, IconTrash } from './icons';

interface Props {
  bill: Bill;
  example: boolean;
  /** Foto já guardada na nota aberta (guardar a nova substitui). */
  notePhotoId: string | null;
  dispatch: Dispatch<Action>;
  toast: (msg: string) => void;
}

interface Row {
  key: number;
  name: string;
  qty: number;
  /** Preço da unidade como a pessoa vê/digita ("22,00"). */
  price: string;
}

type Phase = 'idle' | 'reading' | 'review';

let rowSeq = 0;
const toRow = (name: string, qty: number, cents: number): Row => ({
  key: ++rowSeq,
  name,
  qty,
  price: cents ? formatBRL(cents).replace('R$ ', '') : '',
});

/**
 * Foto da nota fiscal → itens da conta.
 * Lê no próprio celular, mostra uma revisão rápida (corrigir valor, apagar ou incluir linha,
 * conferir com o total da nota) e só então lança os itens.
 */
export function ReceiptScan({ bill, example, notePhotoId, dispatch, toast }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<ReadProgress>({ fraction: 0, label: '' });
  const [photo, setPhoto] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [replace, setReplace] = useState(false);
  const [useService, setUseService] = useState(true);
  const [showErrors, setShowErrors] = useState(false);
  const [keepPhoto, setKeepPhoto] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<File | null>(null);

  const chooseRef = useRef<HTMLDialogElement>(null);
  const readingRef = useRef<HTMLDialogElement>(null);
  const reviewRef = useRef<HTMLDialogElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Abre/fecha as janelas conforme a etapa (só mexe no DOM, não no estado).
  useEffect(() => {
    const open = (d: HTMLDialogElement | null, on: boolean) => {
      if (!d) return;
      if (on && !d.open) {
        d.showModal?.();
        // Foco no título: o leitor de tela anuncia a etapa e nenhum botão aparece "marcado".
        d.querySelector<HTMLElement>('h2')?.focus();
      }
      if (!on && d.open) d.close();
    };
    open(readingRef.current, phase === 'reading');
    open(reviewRef.current, phase === 'review');
  }, [phase]);

  // Libera a foto da memória quando sai dela.
  useEffect(() => () => void (photo && URL.revokeObjectURL(photo)), [photo]);

  function pick(input: HTMLInputElement | null) {
    chooseRef.current?.close();
    input?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite escolher a mesma foto de novo
    if (!file) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    fileRef.current = file;
    setPhoto(URL.createObjectURL(file));
    setProgress({ fraction: 0, label: 'Ajustando a foto…' });
    setPhase('reading');

    try {
      const reader = await defaultReader();
      const result = await reader.read(file, setProgress, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setParsed(result);
      setRows(result.items.map((i) => toRow(i.name, i.qty, i.cents)));
      setReplace(false);
      setUseService(true);
      setShowErrors(false);
      setPhase('review');
    } catch {
      if (ctrl.signal.aborted) return;
      setPhase('idle');
      toast(
        navigator.onLine
          ? 'Não deu para ler a nota. Tente outra foto, com boa luz.'
          : 'Sem internet: na primeira vez o leitor precisa ser baixado (uns 5 MB).',
      );
    }
  }

  function cancelReading() {
    abortRef.current?.abort();
    setPhase('idle');
  }

  function closeReview() {
    setPhase('idle');
    setParsed(null);
    setRows([]);
    fileRef.current = null;
  }

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: number) => setRows((rs) => rs.filter((r) => r.key !== key));

  function addRow() {
    const row = toRow('', 1, 0);
    setRows((rs) => [...rs, row]);
    // Foca o nome da linha nova depois que ela aparece.
    requestAnimationFrame(() => document.getElementById(`scan-name-${row.key}`)?.focus());
  }

  // Conferência com a nota.
  const checked = rows.map((r) => ({ row: r, cents: parseBRL(r.price), ok: !!r.name.trim() && !!parseBRL(r.price) }));
  const invalid = checked.filter((c) => !c.ok);
  const sum = checked.reduce((t, c) => t + (c.cents ?? 0) * c.row.qty, 0);
  const expected = parsed ? expectedItemsTotal(parsed) : null;
  const diff = expected === null ? null : sum - expected;

  const pct = parsed?.servicePct ?? null;
  const pctUsable = pct !== null && (SERVICE_OPTIONS as readonly number[]).includes(pct) && pct !== bill.servicePct;
  const canMerge = !example && bill.items.length > 0;

  // Guarda a foto da nota no aparelho (reduzida), para ver e mandar depois. Falhar não impede lançar.
  async function storePhoto(): Promise<string | undefined> {
    const file = fileRef.current;
    if (!keepPhoto || !file) return undefined;
    try {
      const blob = await shrinkPhoto(file);
      const id = newId();
      if (!(await putPhoto(id, blob))) return undefined;
      rememberPhotoUrl(id, blob);
      if (notePhotoId && !example) {
        forgetPhotoUrl(notePhotoId);
        deletePhoto(notePhotoId);
      }
      return id;
    } catch {
      return undefined;
    }
  }

  async function confirm() {
    if (!rows.length || saving) return;
    if (invalid.length) {
      setShowErrors(true);
      document.getElementById(`scan-name-${invalid[0].row.key}`)?.focus();
      return;
    }
    setSaving(true);
    const photoId = await storePhoto();
    setSaving(false);
    dispatch({
      type: 'addItems',
      items: checked.map((c) => ({ name: c.row.name, qty: c.row.qty, cents: c.cents! })),
      replace: canMerge && replace,
      ...(pctUsable && useService ? { servicePct: pct as ServicePct } : {}),
      ...(photoId ? { photoId } : {}),
    });
    const n = rows.length;
    const people = example ? 0 : bill.people.length;
    toast(
      `${n} ${n === 1 ? 'item lançado' : 'itens lançados'}. ` +
        (people ? 'Agora marque quem consumiu cada um.' : 'Agora adicione quem estava na mesa.'),
    );
    closeReview();
  }

  return (
    <>
      <button type="button" className="card scan-cta" onClick={() => chooseRef.current?.showModal?.()}>
        <span className="scan-cta-icon" aria-hidden="true"><IconReceipt size={24} /></span>
        <span className="row-main">
          <b>Ler nota fiscal</b>
          <small>Tire uma foto e o app lança os itens.</small>
        </span>
        <span className="scan-cta-go" aria-hidden="true"><IconChevron size={20} /></span>
      </button>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={onFile} />

      {/* 1. Câmera ou galeria */}
      <dialog
        ref={chooseRef}
        className="sheet"
        aria-labelledby="h-scan-choose"
        onClick={(e) => e.target === e.currentTarget && chooseRef.current?.close()}
      >
        <div className="sheet-body">
          <span className="sheet-grip" aria-hidden="true" />
          <h2 id="h-scan-choose">Ler nota fiscal</h2>
          <p>Estique a nota numa mesa, com boa luz e sem sombra. A leitura acontece no seu celular.</p>
          <div className="sheet-list">
            <button type="button" className="btn secondary" onClick={() => pick(cameraRef.current)}>
              <IconCamera /> Tirar foto da nota
            </button>
            <button type="button" className="btn secondary" onClick={() => pick(galleryRef.current)}>
              <IconImage /> Escolher da galeria
            </button>
            <button type="button" className="btn ghost" onClick={() => chooseRef.current?.close()}>
              Cancelar
            </button>
          </div>
        </div>
      </dialog>

      {/* 2. Lendo */}
      <dialog
        ref={readingRef}
        className="sheet scan-reading"
        aria-labelledby="h-scan-reading"
        aria-describedby="scan-reading-label"
        onCancel={(e) => {
          e.preventDefault();
          cancelReading();
        }}
      >
        <div className="sheet-body">
          <span className="sheet-grip" aria-hidden="true" />
          <h2 id="h-scan-reading" tabIndex={-1}>Lendo a nota</h2>
          <div
            className="scan-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.fraction * 100)}
            aria-labelledby="h-scan-reading"
          >
            <span style={{ width: `${Math.max(4, Math.round(progress.fraction * 100))}%` }} />
          </div>
          <p id="scan-reading-label" aria-live="polite">{progress.label}</p>
          <p className="hint">Na primeira vez o leitor é baixado (uns 5 MB). Depois funciona até sem internet.</p>
          <button type="button" className="btn ghost" onClick={cancelReading}>Cancelar</button>
        </div>
      </dialog>

      {/* 3. Revisão */}
      <dialog
        ref={reviewRef}
        className="sheet scan-review"
        aria-labelledby="h-scan-review"
        onCancel={(e) => {
          e.preventDefault();
          closeReview();
        }}
      >
        <div className="sheet-body">
          <span className="sheet-grip" aria-hidden="true" />
          <h2 id="h-scan-review" tabIndex={-1}>{rows.length || parsed?.items.length ? 'Confira os itens' : 'Não achei itens na foto'}</h2>

          {photo && (
            <details className="scan-photo">
              <summary>Ver a foto da nota</summary>
              {/* eslint-disable-next-line @next/next/no-img-element -- foto local da nota, só para conferir */}
              <img src={photo} alt="Foto da nota fiscal" />
            </details>
          )}

          {parsed && parsed.items.length === 0 && rows.length === 0 ? (
            <>
              <p>
                Dicas: nota esticada e inteira na foto, boa luz, sem sombra e sem tremer. Ou lance os itens à mão.
              </p>
              <div className="sheet-list">
                <button type="button" className="btn primary" onClick={() => { closeReview(); chooseRef.current?.showModal?.(); }}>
                  <IconCamera /> Tentar outra foto
                </button>
                <button type="button" className="btn secondary" onClick={addRow}>
                  <IconPlus /> Digitar os itens aqui
                </button>
                <button type="button" className="btn ghost" onClick={closeReview}>Fechar</button>
              </div>
            </>
          ) : (
            <>
              <p className="scan-sum">
                <span>{rows.length} {rows.length === 1 ? 'item' : 'itens'}</span>
                <b>{formatBRL(sum)}</b>
              </p>

              {expected !== null && diff === 0 && (
                <p className="scan-check ok" role="status"><IconCheck size={16} /> A soma bate com a nota.</p>
              )}
              {expected !== null && diff !== 0 && (
                <p className="scan-check warn" role="status">
                  <IconAlert size={16} />
                  <span>
                    A nota diz {formatBRL(expected)}: {diff! < 0 ? 'faltam' : 'sobram'} <b>{formatBRL(Math.abs(diff!))}</b>.
                    Confira os valores com a foto.
                  </span>
                </p>
              )}
              {expected === null && (
                <p className="scan-check" role="status"><IconAlert size={16} /> Não achei o total na nota. Confira os valores com a foto.</p>
              )}

              <ul className="scan-rows">
                {rows.map((r, i) => {
                  const cents = parseBRL(r.price);
                  const badName = showErrors && !r.name.trim();
                  const badPrice = showErrors && !cents;
                  return (
                    <li key={r.key} className="scan-row">
                      <div className="scan-row-top">
                        <label className="sr" htmlFor={`scan-name-${r.key}`}>Nome do item {i + 1}</label>
                        <input
                          id={`scan-name-${r.key}`}
                          className="input"
                          maxLength={MAX_ITEM_NAME}
                          placeholder="Nome do item"
                          autoComplete="off"
                          autoCapitalize="sentences"
                          aria-invalid={badName || undefined}
                          value={r.name}
                          onChange={(e) => update(r.key, { name: e.target.value })}
                        />
                        <button type="button" className="icon-btn" aria-label={`Apagar ${r.name || 'linha'}`} onClick={() => remove(r.key)}>
                          <IconTrash />
                        </button>
                      </div>
                      <div className="scan-row-bottom">
                        <div className="stepper" role="group" aria-label={`Quantidade de ${r.name || 'item'}`}>
                          <button type="button" aria-label="Um a menos" disabled={r.qty <= 1} onClick={() => update(r.key, { qty: r.qty - 1 })}>
                            <IconMinus size={18} />
                          </button>
                          <output aria-live="polite">{r.qty}</output>
                          <button type="button" aria-label="Mais um" disabled={r.qty >= MAX_QTY} onClick={() => update(r.key, { qty: r.qty + 1 })}>
                            <IconPlus size={18} />
                          </button>
                        </div>
                        <div className="money">
                          <span aria-hidden="true">R$</span>
                          <label className="sr" htmlFor={`scan-price-${r.key}`}>Valor de uma unidade de {r.name || 'item'}</label>
                          <input
                            id={`scan-price-${r.key}`}
                            className="input"
                            inputMode="decimal"
                            placeholder="0,00"
                            autoComplete="off"
                            aria-invalid={badPrice || undefined}
                            value={r.price}
                            onChange={(e) => update(r.key, { price: e.target.value })}
                          />
                        </div>
                      </div>
                      {r.qty > 1 && cents && (
                        <small className="scan-row-total">{r.qty} × {formatBRL(cents)} = <b>{formatBRL(cents * r.qty)}</b></small>
                      )}
                    </li>
                  );
                })}
              </ul>
              <button type="button" className="btn ghost scan-add" onClick={addRow}>
                <IconPlus /> Incluir linha que faltou
              </button>

              {pct !== null && pctUsable && (
                <label className="scan-option">
                  <input type="checkbox" checked={useService} onChange={(e) => setUseService(e.target.checked)} />
                  <span>Usar o serviço da nota: <b>{pct}%</b></span>
                </label>
              )}
              {pct !== null && !(SERVICE_OPTIONS as readonly number[]).includes(pct) && (
                <p className="hint">A nota tem {pct}% de serviço. Escolha o mais próximo em &quot;Serviço do garçom&quot;.</p>
              )}

              {canMerge && (
                <div className="seg scan-mode" role="group" aria-label="O que fazer com os itens que já estão na conta">
                  <button type="button" aria-pressed={!replace} onClick={() => setReplace(false)}>
                    Somar aos {bill.items.length}
                  </button>
                  <button type="button" aria-pressed={replace} onClick={() => setReplace(true)}>
                    Trocar pelos da nota
                  </button>
                </div>
              )}
              {example && <p className="hint">A mesa de exemplo sai e entra a sua nota.</p>}

              {photo && (
                <label className="scan-option">
                  <input type="checkbox" checked={keepPhoto} onChange={(e) => setKeepPhoto(e.target.checked)} />
                  <span>{notePhotoId && !example ? 'Guardar esta foto no lugar da anterior' : 'Guardar a foto da nota neste celular'}</span>
                </label>
              )}

              {showErrors && invalid.length > 0 && (
                <p className="field-error" role="alert">Preencha o nome e o valor das linhas marcadas, ou apague-as.</p>
              )}

              <div className="sheet-actions scan-actions">
                <button type="button" className="btn secondary" onClick={closeReview}>Cancelar</button>
                <button type="button" className="btn primary" onClick={confirm} disabled={!rows.length || saving}>
                  Lançar {rows.length} {rows.length === 1 ? 'item' : 'itens'}
                </button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
