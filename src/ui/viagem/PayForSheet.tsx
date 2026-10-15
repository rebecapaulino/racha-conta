import { useState } from 'react';
import type { Traveler } from '../../core/trip';
import { Avatar, personStyle } from '../Avatar';
import { Sheet } from './Sheet';

interface Props {
  open: boolean;
  /** As outras pessoas da viagem. */
  people: Traveler[];
  /** Quem é você na viagem (para marcar quem você já paga). */
  meId: string;
  onAnswer: (ids: string[]) => void;
}

/**
 * Logo depois de "Quem é você nesta viagem?": "Você paga a parte de alguém?" (o pai que paga a
 * da filha). As despesas continuam no nome da pessoa; no acerto, a parte dela entra na sua conta.
 * Não fecha sem responder (é uma vez só); dá para mudar depois tocando na pessoa.
 */
export function PayForSheet({ open, people, meId, onAnswer }: Props) {
  const [picked, setPicked] = useState<string[]>(() => people.filter((p) => p.coveredBy === meId).map((p) => p.id));
  const toggle = (id: string) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const names = people.filter((p) => picked.includes(p.id)).map((p) => p.name);
  const label = !names.length ? 'Não, só a minha parte' : names.length === 1 ? `Pago a parte de ${names[0]}` : `Pago a parte de ${names.length} pessoas`;
  const by = (p: Traveler) => (p.coveredBy && p.coveredBy !== meId ? people.find((x) => x.id === p.coveredBy)?.name : null);
  return (
    <Sheet open={open} onClose={() => {}} labelledBy="h-payfor">
      <div className="sheet-body">
        <span className="sheet-grip" aria-hidden="true" />
        <h2 id="h-payfor" tabIndex={-1}>Você paga a parte de alguém?</h2>
        <p>
          Por exemplo, a de um filho. As despesas continuam no nome da pessoa, mas no acerto a parte dela entra na sua conta. Dá para mudar depois, tocando na pessoa.
        </p>
        <div className="picker whoami-picker" role="group" aria-labelledby="h-payfor">
          {people.map((p) => {
            const on = picked.includes(p.id);
            const other = by(p);
            return (
              <button key={p.id} type="button" role="checkbox" aria-checked={on} className="pick" style={personStyle(p)} onClick={() => toggle(p.id)}>
                <Avatar person={p} size="md" checked={on} />
                <span className="pick-name">{p.name}</span>
                {other && !on && <small className="muted pick-note" title={`pago por ${other}`}>por {other.split(' ')[0]}</small>}
              </button>
            );
          })}
        </div>
        <div className="sheet-actions sheet-actions-end">
          <button type="button" className="btn primary" onClick={() => onAnswer(picked)}>{label}</button>
        </div>
      </div>
    </Sheet>
  );
}
