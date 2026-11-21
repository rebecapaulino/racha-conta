import { useState, type Dispatch } from 'react';
import { MAX_NAME } from '../../core/bill';
import { formatBRL } from '../../core/money';
import {
  accountMembers,
  canCover,
  installmentsOf,
  paidThroughOf,
  personFromSchedule,
  personStart,
  startModeOf,
  travelerUsage,
  type Expense,
  type StartMode,
  type Traveler,
  type Trip,
} from '../../core/trip';
import type { TripAction } from '../../state/tripState';
import { Avatar, personStyle } from '../Avatar';
import { IconMinus, IconPlus, IconTrash } from '../icons';
import { PixField, usePixDraft } from '../Pix';
import { Sheet } from './Sheet';

interface Props {
  trip: Trip;
  meId: string | null;
  person: Traveler | null;
  /** Viagem compartilhada (todo mundo do grupo vê o Pix). */
  shared?: boolean;
  dispatch: Dispatch<TripAction>;
  toast: (msg: string, undo?: () => void) => void;
  onClose: () => void;
}


/**
 * Editar alguém da viagem: nome, quem paga a parte, "sou eu", assumir as despesas de outra
 * pessoa e remover (sem apagar nada em silêncio).
 */
export function PersonSheet({ person, onClose, ...rest }: Props) {
  return (
    <Sheet open={!!person} onClose={onClose} labelledBy="h-person" className="person-sheet">
      {person && <PersonForm key={person.id} person={person} onClose={onClose} {...rest} />}
    </Sheet>
  );
}

function PersonForm({ trip, meId, person, shared, dispatch, toast, onClose }: Props & { person: Traveler }) {
  const [name, setName] = useState(person.name);
  const pix = usePixDraft(person.pix, person.name);
  const [isMe, setIsMe] = useState(person.id === meId);
  const [coveredBy, setCoveredBy] = useState(person.coveredBy ?? '');
  const sponsors = trip.people.filter((p) => canCover(trip, person.id, p.id));
  const covers = accountMembers(trip, person.id);
  const [removing, setRemoving] = useState(false);
  const others = trip.people.filter((p) => p.id !== person.id);
  const [to, setTo] = useState(others[0]?.id ?? '');
  const usage = travelerUsage(trip, person.id);
  const used = usage.expenses + usage.settlements > 0;
  // Assumir: quem tem alguma coisa no nome passa tudo para esta pessoa (ex.: a "Bia" anotada
  // antes de a Bia entrar no grupo com a conta dela).
  const [taking, setTaking] = useState(false);
  const givers = others.filter((p) => {
    const u = travelerUsage(trip, p.id);
    return u.expenses + u.settlements > 0;
  });
  // Parceladas de que a pessoa participa: em qual parcela ela começa a pagar (entrou depois).
  const parceladas = trip.expenses.filter((e) => !e.deleted && !e.settled && installmentsOf(e) > 1 && e.people.includes(person.id));
  // E, para quem entrou depois, se no fim todos pagam o mesmo ou se ela só paga dali em diante.
  const [starts, setStarts] = useState<Record<string, Start>>(() =>
    Object.fromEntries(parceladas.map((e) => [e.id, { from: personStart(e, person.id), mode: startModeOf(trip, e, person.id) }])),
  );
  const [from, setFrom] = useState('');
  const [dropFrom, setDropFrom] = useState(true);
  const giver = others.find((p) => p.id === from);
  function pickGiver(p: Traveler) {
    setFrom(p.id);
    // Sem conta no grupo (só um nome anotado): normalmente sai. Com conta: fica, a não ser que desmarque.
    setDropFrom(!p.userId);
  }

  function take() {
    if (!giver) return;
    if (dropFrom) dispatch({ type: 'removeTraveler', id: giver.id, to: person.id });
    else dispatch({ type: 'transferTraveler', from: giver.id, to: person.id });
    toast(dropFrom ? `${person.name} ficou com as despesas de ${giver.name}, que saiu da viagem.` : `${person.name} ficou com as despesas de ${giver.name}.`);
    onClose();
  }


  function save() {
    const key = pix.resolve();
    if (key === undefined) {
      document.getElementById('person-edit-pix')?.focus();
      return;
    }
    dispatch({ type: 'editTraveler', id: person.id, name, coveredBy: coveredBy || null, pix: key });
    const changed = parceladas.filter((e) => {
      const s = starts[e.id];
      return s.from !== personStart(e, person.id) || (s.from > 1 && s.mode !== startModeOf(trip, e, person.id));
    });
    for (const e of changed) {
      const s = starts[e.id];
      dispatch({ type: 'startPaying', id: person.id, expenseId: e.id, from: s.from, ...(s.mode === 'spread' ? { mode: 'spread' as const } : {}) });
    }
    if (isMe !== (person.id === meId)) dispatch({ type: 'setMe', id: isMe ? person.id : null });
    if (changed.length) {
      // Desfazer volta cada despesa exatamente às parcelas de antes (`{}`: eram iguais para todos).
      toast(`Parcelas de ${name.trim() || person.name} reajustadas. Confira o acerto.`, () =>
        changed.forEach((e) => dispatch({ type: 'editExpense', id: e.id, input: { ...e, schedule: e.schedule ?? {} } })),
      );
    } else toast('Pessoa salva');
    onClose();
  }

  function remove() {
    if (used && !to) return;
    dispatch({ type: 'removeTraveler', id: person.id, ...(used ? { to } : {}) });
    const target = others.find((p) => p.id === to)?.name;
    toast(used ? `${person.name} saiu. As despesas passaram para ${target}.` : `${person.name} saiu da viagem`);
    onClose();
  }

  return (
    <div className="sheet-body">
      <span className="sheet-grip" aria-hidden="true" />
      <div className="person-top" style={personStyle(person)}>
        <Avatar person={{ ...person, name: name || person.name }} size="lg" />
        <h2 id="h-person" tabIndex={-1}>{person.name}</h2>
      </div>

      <div className="note-field">
        <label className="field-label" htmlFor="person-edit-name">Nome</label>
        <input
          id="person-edit-name"
          className="input"
          maxLength={MAX_NAME}
          autoComplete="off"
          autoCapitalize="words"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="note-field">
        <h3 className="field-label" id="h-covered">Quem paga a parte de {name.trim() || person.name}?</h3>
        <div className="chips cover-chips" role="group" aria-labelledby="h-covered">
          <button type="button" className="chip chip-self" aria-pressed={!coveredBy} onClick={() => setCoveredBy('')}>
            A própria pessoa
          </button>
          {sponsors.map((p) => (
            <button
              key={p.id}
              type="button"
              className="chip"
              style={personStyle(p)}
              aria-pressed={coveredBy === p.id}
              onClick={() => setCoveredBy(p.id)}
            >
              <Avatar person={p} size="xs" />
              {p.id === meId ? 'Você' : p.name}
            </button>
          ))}
        </div>
        <p className="hint">
          {coveredBy
            ? `As despesas continuam no nome de ${name.trim() || person.name}, mas no acerto a conta entra na de ${trip.people.find((p) => p.id === coveredBy)?.name}: é quem paga ou recebe.`
            : 'Ex.: o pai que paga a parte da filha, ou um casal em que um paga pelos dois. No acerto, a conta junta com a de quem paga.'}
        </p>
        {covers.length > 0 && (
          <p className="hint">{person.name} já paga a parte de {covers.map((p) => p.name).join(', ')}.</p>
        )}
      </div>

      <PixField draft={pix} id="person-edit-pix" label={`Pix de ${name.trim() || person.name}`} />
      {shared && pix.value.trim() && <p className="hint pix-shared">Todo mundo do grupo vê a chave, para pagar direto.</p>}

      {parceladas.length > 0 && (
        <div className="note-field person-starts">
          <h3 className="field-label">Começa a pagar em qual parcela?</h3>
          <p className="hint">
            Para quem entrou depois: as parcelas de antes ficam com quem já estava. Escolha se no fim todos pagam o mesmo ({name.trim() || person.name} paga
            mais nas que faltam) ou se só paga dali em diante.
          </p>
          {parceladas.map((e) => (
            <StartRow key={e.id} trip={trip} e={e} person={person} start={starts[e.id]} onChange={(v) => setStarts((s) => ({ ...s, [e.id]: v }))} />
          ))}
        </div>
      )}

      <label className="scan-option">
        <input type="checkbox" checked={isMe} onChange={(e) => setIsMe(e.target.checked)} />
        <span>Sou eu <small className="muted">· neste celular, despesa nova já vem com você como quem pagou</small></span>
      </label>

      {taking ? (
        <div className="confirm" role="group" aria-labelledby="h-person-take">
          <p id="h-person-take">
            <b>Passar para {person.name} as despesas de quem?</b> Tudo o que está no nome da pessoa escolhida (o que pagou, o que
            consumiu e os acertos) passa para {person.name}. Nenhum valor muda.
          </p>
          {givers.length === 0 ? (
            <p className="hint">Ninguém mais tem despesas na viagem.</p>
          ) : (
            <div className="picker" role="radiogroup" aria-label="De quem são as despesas">
              {givers.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={p.id === from} className="pick" style={personStyle(p)} onClick={() => pickGiver(p)}>
                  <Avatar person={p} size="md" checked={p.id === from} />
                  <span className="pick-name">{p.id === meId ? 'Você' : p.name}</span>
                </button>
              ))}
            </div>
          )}
          {giver && (
            <label className="scan-option">
              <input type="checkbox" checked={dropFrom} onChange={(e) => setDropFrom(e.target.checked)} />
              <span>Tirar {giver.name} da viagem <small className="muted">· sem marcar, fica na viagem sem nenhuma despesa</small></span>
            </label>
          )}
          <div className="sheet-actions">
            <button type="button" className="btn secondary" onClick={() => setTaking(false)} autoFocus>Cancelar</button>
            <button type="button" className="btn primary" onClick={take} disabled={!giver}>
              Passar para {person.name}
            </button>
          </div>
        </div>
      ) : (
        others.length > 0 && !removing && (
          <button type="button" className="btn ghost person-take" onClick={() => setTaking(true)}>
            Assumir despesas de outra pessoa
          </button>
        )
      )}

      {removing ? (
        <div className="confirm" role="group" aria-labelledby="h-person-del">
          {used ? (
            <>
              <p id="h-person-del">
                <b>{person.name} aparece em {usage.expenses} {usage.expenses === 1 ? 'despesa' : 'despesas'}
                {usage.settlements > 0 && ` e ${usage.settlements} ${usage.settlements === 1 ? 'acerto' : 'acertos'}`}.</b>{' '}
                Para não sumir dinheiro, escolha quem fica com tudo isso:
              </p>
              {others.length === 0 ? (
                <p className="hint">Adicione outra pessoa antes de remover.</p>
              ) : (
                <div className="picker" role="radiogroup" aria-label="Quem fica com as despesas">
                  {others.map((p) => (
                    <button key={p.id} type="button" role="radio" aria-checked={p.id === to} className="pick" style={personStyle(p)} onClick={() => setTo(p.id)}>
                      <Avatar person={p} size="md" checked={p.id === to} />
                      <span className="pick-name">{p.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p id="h-person-del"><b>Remover {person.name} da viagem?</b> Não aparece em nenhuma despesa.</p>
          )}
          <div className="sheet-actions">
            <button type="button" className="btn secondary" onClick={() => setRemoving(false)} autoFocus>Cancelar</button>
            <button type="button" className="btn primary danger" onClick={remove} disabled={used && !to}>
              {used ? 'Passar e remover' : 'Remover'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn ghost note-delete" onClick={() => setRemoving(true)}>
          <IconTrash /> Remover da viagem
        </button>
      )}

      <div className="sheet-actions">
        <button type="button" className="btn secondary" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn primary" onClick={save}>Salvar</button>
      </div>
    </div>
  );
}

/** "R$ 158,04" sem quebrar a linha entre o "R$" e o número. */
const brl = (cents: number) => formatBRL(cents).replace(' ', '\u00a0');

/** Em qual parcela a pessoa começa a pagar uma parcelada e, se entrou depois, como fica o total. */
interface Start {
  from: number;
  mode: StartMode;
}

/** Uma parcelada no modal da pessoa: "Airbnb · Começa na 2ª de 5", com quanto cada um paga. */
function StartRow({ trip, e, person, start, onChange }: { trip: Trip; e: Expense; person: Traveler; start: Start; onChange: (start: Start) => void }) {
  const { from, mode } = start;
  const n = installmentsOf(e);
  const plan = personFromSchedule(trip, e, person.id, from, mode);
  const parts = plan && Object.keys(plan).length ? plan : null;
  // As já pagas por todos não mudam no "todos pagam o mesmo"; o valor muda depois delas.
  const shut = mode === 'spread' ? Math.max(0, Math.min(n - 1, paidThroughOf(e))) : 0;
  const k = from - 1;
  const at = Math.max(k, shut);
  const mine = parts?.[person.id]?.[at];
  const owedShut = (parts?.[person.id] ?? []).slice(0, shut).reduce((a, c) => a + c, 0);
  const other = e.people.find((id) => id !== person.id && id !== e.payerId && parts?.[id]);
  const otherName = trip.people.find((p) => p.id === other)?.name;
  const whole = (id: string) => (parts?.[id] ?? []).reduce((a, c) => a + c, 0);
  const totals = e.people.filter((id) => parts?.[id]).map(whole);
  const [low, high] = [Math.min(...totals), Math.max(...totals)];
  const label = `h-start-${e.id}`;
  return (
    <div className="person-start">
      <div className="join-elapsed">
        <span id={label}>{e.description}</span>
        <div className="stepper" role="group" aria-labelledby={label}>
          <button type="button" onClick={() => onChange({ from: Math.max(1, from - 1), mode })} disabled={from <= 1} aria-label="Parcela anterior">
            <IconMinus size={18} />
          </button>
          <output aria-live="polite">{from}ª de {n}</output>
          <button type="button" onClick={() => onChange({ from: Math.min(n, from + 1), mode })} disabled={from >= n} aria-label="Próxima parcela">
            <IconPlus size={18} />
          </button>
        </div>
      </div>
      {from > 1 && (
        <div className="seg two" role="group" aria-label={`Como ${person.name} paga ${e.description}`}>
          <button type="button" aria-pressed={mode === 'spread'} onClick={() => onChange({ from, mode: 'spread' })}>
            Todos pagam o mesmo
          </button>
          <button type="button" aria-pressed={mode === 'rest'} onClick={() => onChange({ from, mode: 'rest' })}>
            Só dali em diante
          </button>
        </div>
      )}
      <p className="hint" aria-live="polite">
        {from > 1 && parts && mine !== undefined ? (
          <>
            {shut > 0 &&
              `${shut === 1 ? 'A 1ª já foi marcada como paga por todos e fica como está' : `As parcelas 1 a ${shut} já foram marcadas como pagas por todos e ficam como estão`}${
                owedShut > 0 ? ` (${person.name}: ${brl(owedShut)})` : ''
              }. `}
            {k > shut && (
              <>
                {k - shut === 1 ? `Na ${k}ª` : `Da ${shut + 1}ª à ${k}ª`}, só quem já estava{other && otherName ? ` (${otherName}: ${brl(parts[other][shut])})` : ''}.{' '}
              </>
            )}
            Da {at + 1}ª em diante, {person.name} paga {brl(mine)}
            {other && otherName ? ` e ${otherName}, ${brl(parts[other][at])}` : ''} por parcela.{' '}
            {mode === 'spread'
              ? high - low <= 1
                ? `No fim, todos pagam ${brl(low)}${high > low ? ` ou ${brl(high)}` : ''}.`
                : `No fim, cada um paga a sua parte da despesa inteira (${person.name}: ${brl(whole(person.id))}).`
              : `No fim, ${person.name} paga ${brl(whole(person.id))}${other && otherName ? ` e ${otherName}, ${brl(whole(other))}` : ''}.`}
          </>
        ) : (
          `${person.name} paga desde a 1ª parcela.`
        )}
      </p>
    </div>
  );
}
