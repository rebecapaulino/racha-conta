import { createContext, useContext, useState, type CSSProperties, type ReactNode } from 'react';
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

/** id da pessoa → foto da conta dela (ver core/faces). Fora do Rolê e da Viagem abertos: vazio. */
const Faces = createContext<Record<string, string>>({});
export function FacesProvider({ value, children }: { value: Record<string, string>; children: ReactNode }) {
  return <Faces.Provider value={value}>{children}</Faces.Provider>;
}

function Photo({ url, fallback }: { url: string; fallback: string }) {
  const [broken, setBroken] = useState<string | null>(null);
  if (broken === url) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element -- foto da conta, vem do Google
  return <img className="avatar-photo" src={url} alt="" referrerPolicy="no-referrer" onError={() => setBroken(url)} />;
}

export function Avatar({ person, size = 'md', checked }: { person: Person; size?: Size; checked?: boolean }) {
  const photo = useContext(Faces)[person.id];
  return (
    <span className={`avatar avatar-${size}`} style={personStyle(person)} aria-hidden="true">
      {photo ? <Photo url={photo} fallback={initial(person.name)} /> : initial(person.name)}
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
