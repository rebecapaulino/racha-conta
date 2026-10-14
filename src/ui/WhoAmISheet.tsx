import { useState } from 'react';
import type { Person } from '../core/bill';
import { Avatar, FacesProvider, personStyle } from './Avatar';
import { IconPlus } from './icons';
import { Sheet } from './viagem/Sheet';

const NO_FACES: Record<string, string> = {};

interface Props {
  open: boolean;
  noun: 'viagem' | 'rolê';
  /** Quem ainda não é de nenhuma conta (pode ser a pessoa que entrou). */
  people: Person[];
  /** Quem tem o mesmo nome da conta: só uma sugestão, nunca vem marcado. */
  suggested: string[];
  /** Como a pessoa entra se for nova ("Rebeca O."). */
  newName: string;
  onChoose: (id: string | null) => void;
}

/**
 * Logo depois de entrar no grupo: "Quem é você?". Nome igual não decide sozinho (duas Rebecas
 * podem ser pessoas diferentes): vem marcado "Pessoa nova", e quem já estava na lista
 * com o nome dela é só sugerido. Não fecha sem escolher.
 */
export function WhoAmISheet({ open, noun, people, suggested, newName, onChoose }: Props) {
  const [pick, setPick] = useState<string | null>(null);
  const ordered = [...people.filter((p) => suggested.includes(p.id)), ...people.filter((p) => !suggested.includes(p.id))];
  const where = noun === 'viagem' ? 'nesta viagem' : 'neste rolê';
  return (
    <Sheet open={open} onClose={() => {}} labelledBy="h-whoami">
      <div className="sheet-body">
        <span className="sheet-grip" aria-hidden="true" />
        <h2 id="h-whoami" tabIndex={-1}>Quem é você {where}?</h2>
        <p>
          Se alguém já tinha anotado você, escolha o seu nome: o que estiver nele passa a ser seu. Se não, entre como pessoa nova.
        </p>
        {/* Só iniciais aqui: a foto pelo nome ("Rebeca" = conta Rebeca) é justamente o palpite que pode estar errado. */}
        <FacesProvider value={NO_FACES}>
          <div className="picker whoami-picker" role="radiogroup" aria-labelledby="h-whoami">
            {ordered.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={pick === p.id} className="pick" style={personStyle(p)} onClick={() => setPick(p.id)}>
                <Avatar person={p} size="md" checked={pick === p.id} />
                <span className="pick-name">{p.name}</span>
                {suggested.includes(p.id) && <small className="muted">mesmo nome</small>}
              </button>
            ))}
            <button type="button" role="radio" aria-checked={pick === null} className="pick whoami-new" onClick={() => setPick(null)}>
              <span className="avatar avatar-md whoami-new-icon" aria-hidden="true">
                <IconPlus size={18} />
              </span>
              <span className="pick-name">Pessoa nova</span>
              <small className="muted">entra como {newName}</small>
            </button>
          </div>
        </FacesProvider>
        <div className="sheet-actions">
          <button type="button" className="btn primary" onClick={() => onChoose(pick)}>
            {pick ? `Sou ${people.find((p) => p.id === pick)?.name}` : `Entrar como ${newName}`}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
