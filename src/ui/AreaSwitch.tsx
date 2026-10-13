import { IconReceipt, IconSuitcase } from './icons';
import { Art } from './illustrations';
import { activeVisual } from './visual';

/** As duas áreas do app: Rolê (bar e restaurante, uma noite) e Viagem (vários dias). */
export type Area = 'role' | 'viagem';

const AREA_KEY = 'racha-area';

/** Abre na última área usada neste aparelho. */
export function loadArea(): Area {
  try {
    return localStorage.getItem(AREA_KEY) === 'viagem' ? 'viagem' : 'role';
  } catch {
    return 'role';
  }
}

export function saveArea(area: Area): void {
  try {
    localStorage.setItem(AREA_KEY, area);
  } catch {
    /* modo privado: abre no Rolê da próxima vez */
  }
}

export function AreaSwitch({ area, onChange }: { area: Area; onChange: (a: Area) => void }) {
  const fluent = activeVisual() === 'fluent';
  return (
    <nav className="area-switch" aria-label="Tipo de conta">
      <button type="button" aria-pressed={area === 'role'} onClick={() => onChange('role')}>
        <span className="area-icon">{fluent ? <Art kind="beer" size={26} /> : <IconReceipt />}</span>
        <span className="area-text">
          <b>Rolê</b>
          <small>bar e restaurante</small>
        </span>
      </button>
      <button type="button" aria-pressed={area === 'viagem'} onClick={() => onChange('viagem')}>
        <span className="area-icon">{fluent ? <Art kind="suitcase" size={26} /> : <IconSuitcase />}</span>
        <span className="area-text">
          <b>Viagem</b>
          <small>vários dias</small>
        </span>
      </button>
    </nav>
  );
}
