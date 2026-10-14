'use client';

import { useState } from 'react';
import { AreaSwitch, loadArea, saveArea, type Area } from './AreaSwitch';
import { InstallSheet } from './InstallSheet';
import SoloApp from './SoloApp';
import TripApp from './viagem/TripApp';

/** O app tem duas áreas com dados separados: Rolê (o que já existia) e Viagem. */
export default function Areas() {
  // Link de convite (?convite=…) abre na Viagem, onde fica o "Entrar no grupo".
  const [area, setArea] = useState<Area>(() => (new URLSearchParams(window.location.search).has('convite') ? 'viagem' : loadArea()));

  function change(next: Area) {
    if (next === area) return;
    setArea(next);
    saveArea(next);
    window.scrollTo({ top: 0 });
  }

  const areaSwitch = <AreaSwitch area={area} onChange={change} />;
  return (
    <>
      {area === 'viagem' ? <TripApp areaSwitch={areaSwitch} /> : <SoloApp areaSwitch={areaSwitch} />}
      <InstallSheet />
    </>
  );
}
