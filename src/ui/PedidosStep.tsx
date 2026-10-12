import { Fragment, useRef, useState, type Dispatch } from 'react';
import { MAX_ITEM_NAME, MAX_QTY, SERVICE_OPTIONS, itemTotal, type Bill, type Item, type Person, type SplitResult } from '../core/bill';
import { formatBRL, parseBRL } from '../core/money';
import type { Action } from '../state/billState';
import { Avatar, personStyle } from './Avatar';
import { IconAlert, IconMinus, IconPlus, IconTrash } from './icons';
import { Art, artForItem } from './illustrations';
import { itemEmoji, itemKind } from './itemEmoji';
import { ReceiptScan } from './ReceiptScan';
import { activeVisual } from './visual';

interface Props {
  /** A nota aberta (ou a conta inteira, quando é de uma nota só). */
  bill: Bill;
  /** Nome do lugar (é da conta inteira, não da nota). */
  title: string;
  result: SplitResult;
  example: boolean;
  /** Foto guardada da nota aberta (a leitura da nota pode trocá-la). */
  notePhotoId: string | null;
  /** Barra das notas fiscais (fica logo abaixo do nome do lugar). */
  notesBar?: React.ReactNode;
  dispatch: Dispatch<Action>;
  toast: (msg: string) => void;
}

/** Etapa 2: nome da conta, itens, quem consumiu e serviço (referência: "Split The Bill"). */
export function PedidosStep({ bill, title, result, example, notePhotoId, notesBar, dispatch, toast }: Props) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Digite o nome do item.');
      nameRef.current?.focus();
      return;
    }
    const cents = parseBRL(price);
    if (!cents) {
      setError('Digite um valor maior que zero, como 12,50.');
      priceRef.current?.focus();
      return;
    }
    dispatch({ type: 'addItem', name, cents });
    setName('');
    setPrice('');
    setError('');
    nameRef.current?.focus();
  }

  return (
    <div className="stack-y">
      <section className="card">
        <label htmlFor="mesa" className="field-label">Nome do lugar</label>
        <input
          id="mesa"
          className="input"
          maxLength={40}
          placeholder="Ex.: Bar do Zé"
          autoComplete="off"
          autoCapitalize="sentences"
          value={title}
          onChange={(e) => dispatch({ type: 'title', title: e.target.value })}
        />
      </section>

      {notesBar}

      <ReceiptScan bill={bill} example={example} notePhotoId={notePhotoId} dispatch={dispatch} toast={toast} />

      <section className="card" aria-labelledby="h-add">
        <h2 id="h-add" className="field-label">Adicionar item</h2>
        <form className="add-item" onSubmit={add} noValidate>
          <label className="sr" htmlFor="item-name">Nome do item</label>
          <input
            id="item-name"
            ref={nameRef}
            className="input"
            maxLength={MAX_ITEM_NAME}
            placeholder="Item (ex.: Chopp)"
            autoComplete="off"
            autoCapitalize="sentences"
            enterKeyHint="next"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="add-item-row">
            <div className="money">
              <span aria-hidden="true">R$</span>
              <label className="sr" htmlFor="item-price">Valor em reais</label>
              <input
                id="item-price"
                ref={priceRef}
                className="input"
                inputMode="decimal"
                placeholder="0,00"
                autoComplete="off"
                enterKeyHint="done"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <button type="submit" className="btn primary">
              <IconPlus /> Adicionar
            </button>
          </div>
        </form>
        <p className="field-error" aria-live="polite">{error}</p>
      </section>

      <section aria-labelledby="h-items" className="stack-y">
        <div className="section-head">
          <h2 id="h-items">Itens da conta</h2>
          {bill.items.length > 0 && <span className="muted">{bill.items.length} · {formatBRL(result.subtotal + result.unassigned)}</span>}
        </div>
        {bill.items.length > 0 && bill.people.length > 0 && (
          <p className="hint">Toque nos nomes para marcar quem consumiu. Pediram mais um? Use o + do item.</p>
        )}
        {bill.items.length === 0 ? (
          <div className="card empty">
            <span className="empty-icon" aria-hidden="true">{activeVisual() === 'fluent' ? <Art kind="dish" size={36} /> : '🍽️'}</span>
            <p><b>Nenhum item ainda.</b><br />Leia a nota fiscal ou lance o que foi pedido acima.</p>
          </div>
        ) : (
          <ul className="items">
            {bill.items.map((it) => (
              <ItemCard key={it.id} item={it} people={bill.people} dispatch={dispatch} />
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="h-service">
        <div className="card-head">
          <h2 id="h-service">Serviço do garçom</h2>
          {bill.servicePct > 0 && <span className="muted">{formatBRL(result.service)}</span>}
        </div>
        <div className="seg" role="group" aria-labelledby="h-service">
          {SERVICE_OPTIONS.map((v) => (
            <button key={v} type="button" aria-pressed={bill.servicePct === v} onClick={() => dispatch({ type: 'service', pct: v })}>
              {v ? `${v}%` : 'Sem'}
            </button>
          ))}
        </div>
        <p className="hint">
          {bill.servicePct ? 'Dividido conforme o quanto cada um consumiu.' : 'Sem serviço nesta conta.'}
        </p>
      </section>
    </div>
  );
}

function ItemCard({ item, people, dispatch }: { item: Item; people: Person[]; dispatch: Dispatch<Action> }) {
  const who = people.filter((p) => item.who.includes(p.id));
  const allOn = people.length > 0 && who.length === people.length;
  const qty = item.qty ?? 1;
  const total = itemTotal(item);

  const detail: string[] = [];
  if (qty > 1) detail.push(`${formatBRL(item.cents)}/un.`);
  if (people.length === 0) detail.push('adicione pessoas na mesa');
  else if (who.length === 0) detail.push('ninguém marcado');
  else if (who.length === 1) detail.push(`só ${who[0].name}`);
  else detail.push(`dividido em ${who.length}`, `${total % who.length ? '≈ ' : ''}${formatBRL(Math.round(total / who.length))} por pessoa`);

  return (
    <li className="card item" id={`item-${item.id}`}>
      <div className="item-head">
        <span className="tile" aria-hidden="true">
          {activeVisual() === 'fluent' ? <Art kind={artForItem(itemKind(item.name))} size={40} /> : itemEmoji(item.name)}
        </span>
        <span className="row-main">
          <b className="item-name">{item.name}</b>
          <small>
            {detail.map((d, i) => (
              <Fragment key={i}>{i > 0 && ' · '}<span className="nowrap">{d}</span></Fragment>
            ))}
          </small>
        </span>
        <button
          type="button"
          className="icon-btn"
          aria-label={`Remover ${item.name}`}
          onClick={() => dispatch({ type: 'removeItem', id: item.id })}
        >
          <IconTrash />
        </button>
      </div>

      <div className="item-bar">
        <div className="stepper" role="group" aria-label={`Quantidade de ${item.name}`}>
          <button
            type="button"
            aria-label={`Um ${item.name} a menos`}
            disabled={qty <= 1}
            onClick={() => dispatch({ type: 'qty', id: item.id, delta: -1 })}
          >
            <IconMinus size={18} />
          </button>
          <output aria-live="polite" aria-label={`${qty} ${qty === 1 ? 'unidade' : 'unidades'}`}>{qty}</output>
          <button
            type="button"
            aria-label={`Mais um ${item.name}`}
            disabled={qty >= MAX_QTY}
            onClick={() => dispatch({ type: 'qty', id: item.id, delta: 1 })}
          >
            <IconPlus size={18} />
          </button>
        </div>
        <b className="item-total">{formatBRL(total)}</b>
      </div>

      {people.length > 0 && (
        <div className="chips" role="group" aria-label={`Quem consumiu ${item.name}`}>
          {people.map((p) => {
            const on = item.who.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                className="chip"
                style={personStyle(p)}
                aria-pressed={on}
                onClick={() => dispatch({ type: 'toggle', itemId: item.id, personId: p.id })}
              >
                <Avatar person={p} size="xs" checked={on} />
                {p.name}
              </button>
            );
          })}
          <button type="button" className="chip chip-all" onClick={() => dispatch({ type: 'toggleAll', itemId: item.id })}>
            {allOn ? 'Limpar' : 'Todos'}
          </button>
        </div>
      )}

      {people.length > 0 && who.length === 0 && (
        <p className="warn" aria-live="polite">
          <IconAlert size={16} />
          <span>{formatBRL(total)} fica fora da conta até alguém ser marcado.</span>
        </p>
      )}
    </li>
  );
}
