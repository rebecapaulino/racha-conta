import { useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import type { Person } from '../core/bill';
import { formatBRL } from '../core/money';
import { formatPixKey, isPixKey, parsePixKey, PIX_KIND_LABEL, pixKeyToCopy, pixKind, pixPayload, type PixKey } from '../core/pix';
import { rememberedPix, rememberPix } from '../state/pixMemory';
import { Avatar } from './Avatar';
import { IconCheck, IconCopy, IconPencil, IconPlus, IconQr } from './icons';
import { Sheet } from './viagem/Sheet';

/** Pessoa do rolê ou da viagem (só o que o Pix usa). */
type Who = Pick<Person, 'id' | 'name' | 'color' | 'pix'>;

/** Copia o texto; sem a área de transferência, usa o jeito antigo do navegador. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/** QR code do Pix, preto no branco (mesmo no tema escuro, para a câmera do banco ler). */
export function PixQr({ text, label }: { text: string; label: string }) {
  const { n, path } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    return { n: count + 8, path: d };
  }, [text]);
  return (
    <svg className="pix-qr" viewBox={`0 0 ${n} ${n}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={n} height={n} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}

/** Rascunho do campo de chave Pix: o texto, a leitura e a escolha entre CPF e celular. */
export function usePixDraft(initial: string | undefined, name: string) {
  const [value, setValue] = useState(initial && isPixKey(initial) ? formatPixKey(initial) : '');
  const [asPhone, setAsPhone] = useState(!!initial && pixKind(initial) === 'phone');
  const [error, setError] = useState('');
  const parsed = value.trim() ? parsePixKey(value) : null;
  const remembered = !value.trim() ? rememberedPix(name) : null;
  /** A chave escolhida, ou null para tirar. undefined: tem erro (já mostrado). */
  function resolve(): string | null | undefined {
    if (!parsed) return null;
    if (!parsed.ok) {
      setError(parsed.error);
      return undefined;
    }
    const key: PixKey = parsed.alt && asPhone ? parsed.alt : parsed.key;
    rememberPix(name, key.key);
    return key.key;
  }
  return {
    value,
    setValue: (v: string) => {
      setValue(v);
      setError('');
    },
    parsed,
    asPhone,
    setAsPhone,
    error,
    remembered,
    resolve,
  };
}

/** Campo da chave Pix, com o tipo entendido embaixo (e a escolha quando o número pode ser os dois). */
export function PixField({ draft, id, label }: { draft: ReturnType<typeof usePixDraft>; id: string; label: string }) {
  const { parsed } = draft;
  const kind = parsed?.ok ? (parsed.alt && draft.asPhone ? parsed.alt.kind : parsed.key.kind) : null;
  return (
    <div className="note-field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        inputMode="email"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="CPF, celular, e-mail ou chave aleatória"
        value={draft.value}
        aria-invalid={!!draft.error || undefined}
        aria-describedby={`${id}-hint`}
        onChange={(e) => draft.setValue(e.target.value)}
      />
      <p className="hint" id={`${id}-hint`} aria-live="polite">
        {draft.error ? <span className="pix-error">{draft.error}</span> : kind ? <>Chave: <b>{PIX_KIND_LABEL[kind]}</b></> : 'Opcional. Quem for pagar vê a chave e o QR code com o valor.'}
      </p>
      {parsed?.ok && parsed.alt && (
        <div className="chips" role="group" aria-label="Esse número é">
          <button type="button" className="chip" aria-pressed={!draft.asPhone} onClick={() => draft.setAsPhone(false)}>
            É CPF
          </button>
          <button type="button" className="chip" aria-pressed={draft.asPhone} onClick={() => draft.setAsPhone(true)}>
            É celular
          </button>
        </div>
      )}
      {draft.remembered && (
        <button type="button" className="link-btn pix-remembered" onClick={() => draft.setValue(formatPixKey(draft.remembered!))}>
          Usar a chave de antes: {formatPixKey(draft.remembered)}
        </button>
      )}
    </div>
  );
}

/** Janela para pôr, trocar ou tirar a chave Pix de alguém. */
export function PixEditSheet({ person, shared, onSave, onClose }: { person: Who | null; shared?: boolean; onSave: (pix: string | null) => void; onClose: () => void }) {
  return (
    <Sheet open={!!person} onClose={onClose} labelledBy="h-pix-edit" focus="#pix-edit-key" className="pix-edit">
      {person && <PixEditForm key={person.id} person={person} shared={shared} onSave={onSave} onClose={onClose} />}
    </Sheet>
  );
}

function PixEditForm({ person, shared, onSave, onClose }: { person: Who; shared?: boolean; onSave: (pix: string | null) => void; onClose: () => void }) {
  const draft = usePixDraft(person.pix, person.name);
  function save(e: React.FormEvent) {
    e.preventDefault();
    const pix = draft.resolve();
    if (pix === undefined) return;
    onSave(pix);
    onClose();
  }
  return (
    <form className="sheet-body" onSubmit={save}>
      <span className="sheet-grip" aria-hidden="true" />
      <div className="person-top">
        <Avatar person={person} size="lg" />
        <h2 id="h-pix-edit" tabIndex={-1}>Pix de {person.name}</h2>
      </div>
      <PixField draft={draft} id="pix-edit-key" label="Chave Pix" />
      <p className="hint">
        {shared ? 'Todo mundo do grupo vê a chave, para pagar direto.' : 'Fica guardada nesta conta e vai junto no texto e na notinha.'} Nunca peça senha nem
        dados do cartão.
      </p>
      <div className="sheet-actions">
        {person.pix && !draft.value.trim() ? (
          <button type="submit" className="btn primary danger">Tirar a chave</button>
        ) : (
          <>
            <button type="button" className="btn secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn primary">Salvar</button>
          </>
        )}
      </div>
    </form>
  );
}

/** Botão que confirma por um instante ("Copiado"). */
function CopyButton({ text, label, primary }: { text: string; label: string; primary?: boolean }) {
  const [done, setDone] = useState<boolean | null>(null);
  async function copy() {
    const ok = await copyText(text);
    setDone(ok);
    window.setTimeout(() => setDone(null), 2200);
  }
  return (
    <button type="button" className={`btn ${primary ? 'primary' : 'secondary'}`} onClick={copy} aria-live="polite">
      {done ? <IconCheck size={16} /> : <IconCopy size={18} />} {done === null ? label : done ? 'Copiado' : 'Não deu para copiar'}
    </button>
  );
}

/** Pagar com Pix: QR code com o valor, o "copia e cola" e a chave. */
function PixPaySheet({
  to,
  from,
  cents,
  open,
  onClose,
  onEdit,
  onPaid,
}: {
  to: Who;
  from?: string;
  cents: number;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onPaid?: () => void;
}) {
  const key = to.pix!;
  const code = pixPayload({ key, name: to.name, cents });
  return (
    <Sheet open={open} onClose={onClose} labelledBy="h-pix-pay" className="pix-sheet">
      <div className="sheet-body">
        <span className="sheet-grip" aria-hidden="true" />
        <h2 id="h-pix-pay" tabIndex={-1}>
          {from ? `${from} paga` : 'Pagar'} {formatBRL(cents)} para {to.name}
        </h2>
        <PixQr text={code} label={`QR code do Pix de ${formatBRL(cents)} para ${to.name}`} />
        <p className="hint pix-how">
          No app do banco, escolha <b>Pix copia e cola</b> (ou leia o QR code em outro celular). O valor já vai preenchido.
        </p>
        <CopyButton text={code} label="Copiar Pix copia e cola" primary />
        <div className="pix-key-row">
          <span>
            <small>{PIX_KIND_LABEL[pixKind(key)]}</small>
            <b>{formatPixKey(key)}</b>
          </span>
          <CopyButton text={pixKeyToCopy(key)} label="Copiar chave" />
        </div>
        <p className="hint">Confira o nome de quem recebe no app do banco antes de pagar.</p>
        <div className="sheet-actions">
          <button type="button" className="btn ghost" onClick={onEdit}>
            <IconPencil size={16} /> Trocar a chave
          </button>
          {onPaid ? (
            <button type="button" className="btn secondary" onClick={onPaid}>
              <IconCheck size={16} /> Já paguei
            </button>
          ) : (
            <button type="button" className="btn secondary" onClick={onClose}>Fechar</button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/**
 * Dentro do card de quem paga: o Pix de quem recebe, com o botão que abre o QR code e o
 * "copia e cola" já com o valor. Sem chave, um link para pôr a de quem recebe.
 */
export function PixPay({
  to,
  from,
  cents,
  shared,
  onSave,
  onPaid,
}: {
  to: Who;
  /** Nome de quem paga ("Você", "Ana"), para o título da janela. */
  from?: string;
  cents: number;
  shared?: boolean;
  onSave: (pix: string | null) => void;
  /** "Já paguei": abre o registro do pagamento. */
  onPaid?: () => void;
}) {
  const [paying, setPaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const has = isPixKey(to.pix);
  return (
    <>
      {has ? (
        <button type="button" className="btn secondary pix-btn" onClick={() => setPaying(true)} aria-label={`Pagar ${formatBRL(cents)} com Pix para ${to.name}`}>
          <IconQr size={16} /> Pix
        </button>
      ) : (
        <button type="button" className="link-btn pix-add" onClick={() => setEditing(true)}>
          <IconPlus size={16} /> Pix de {to.name}
        </button>
      )}
      {has && (
        <PixPaySheet
          to={to}
          from={from}
          cents={cents}
          open={paying}
          onClose={() => setPaying(false)}
          onEdit={() => {
            setPaying(false);
            setEditing(true);
          }}
          onPaid={
            onPaid &&
            (() => {
              setPaying(false);
              onPaid();
            })
          }
        />
      )}
      <PixEditSheet person={editing ? to : null} shared={shared} onSave={onSave} onClose={() => setEditing(false)} />
    </>
  );
}

/** A chave de quem pagou a conta (em "Quem pagou no caixa?"): mostra, troca ou pede para pôr. */
export function PixOwner({ person, shared, onSave }: { person: Who; shared?: boolean; onSave: (pix: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const has = isPixKey(person.pix);
  return (
    <div className="pix-owner">
      {has ? (
        <>
          <span>
            <small>Pix de {person.name} · {PIX_KIND_LABEL[pixKind(person.pix!)]}</small>
            <b>{formatPixKey(person.pix!)}</b>
          </span>
          <button type="button" className="link-btn" onClick={() => setEditing(true)}>Trocar</button>
        </>
      ) : (
        <>
          <span>
            <b>Pix de {person.name}</b>
            <small>Quem for pagar já vê a chave e o QR code com o valor.</small>
          </span>
          <button type="button" className="btn secondary" onClick={() => setEditing(true)}>
            <IconPlus size={16} /> Pôr a chave
          </button>
        </>
      )}
      <PixEditSheet person={editing ? person : null} shared={shared} onSave={onSave} onClose={() => setEditing(false)} />
    </div>
  );
}
