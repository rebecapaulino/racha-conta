'use client';

import { useEffect, useState } from 'react';
import { useAccount } from '../auth/account';
import { previewInvite } from '../sync/groups';
import { inviteCodeInUrl } from './useInvite';
import { AreaSwitch, loadArea, saveArea, type Area } from './AreaSwitch';
import { InstallSheet } from './InstallSheet';
import SoloApp from './SoloApp';
import TripApp from './viagem/TripApp';

/** O app tem duas áreas com dados separados: Rolê (o que já existia) e Viagem. */
export default function Areas() {
  const [area, setArea] = useState<Area>(loadArea);
  // Link de convite (?convite=…): abre a área certa (Viagem ou Rolê), onde fica o "Entrar no grupo".
  const signedIn = !!useAccount().account;
  useEffect(() => {
    const code = inviteCodeInUrl();
    if (!code || !signedIn) return;
    previewInvite(code).then(
      (p) => {
        if (!p) return;
        // Guarda também: da próxima vez, o app abre direto onde está o grupo.
        const next = p.kind === 'role' ? 'role' : 'viagem';
        setArea(next);
        saveArea(next);
      },
      () => {},
    );
  }, [signedIn]);

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
