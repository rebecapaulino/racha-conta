import type { CSSProperties } from 'react';
import type { Person } from '../core/bill';
import { IconCheck } from './icons';

/** Variável CSS com a cor da pessoa (--p1 … --p6), para usar em qualquer elemento. */
export function personStyle(p: Person): CSSProperties {
  return { '--pc': `var(--p${(p.color % 6) + 1})` } as CSSProperties;
}

export function initial(name: string): string {
  return (name.trim().charAt(0) || '?').toUpperCase();
}

type Size = 'xs' | 'sm' | 'md' | 'lg';

export function Avatar({ person, size = 'md', checked }: { person: Person; size?: Size; checked?: boolean }) {
  return (
    <span className={`avatar avatar-${size}`} style={personStyle(person)} aria-hidden="true">
      {initial(person.name)}
      {checked && (
        <span className="avatar-check">
          <IconCheck size={10} />
        </span>
      )}
    </span>
  );
}

/** Avatares sobrepostos ("dividido entre"). */
export function AvatarStack({ people, max = 4 }: { people: Person[]; max?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="stack" aria-hidden="true">
      {shown.map((p) => (
        <Avatar key={p.id} person={p} size="sm" />
      ))}
      {rest > 0 && <span className="avatar avatar-sm avatar-more">+{rest}</span>}
    </span>
  );
}
