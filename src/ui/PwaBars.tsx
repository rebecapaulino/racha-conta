import { dismissInstall, install, usePwa } from '../pwa/pwa';
import { IconX, Logo } from './icons';

/**
 * Aviso do app instalável: convite para instalar na tela inicial. (A versão nova não tem mais
 * aviso nem botão: troca sozinha, ver updateWhenSafe em pwa.ts.)
 */
export function PwaBars() {
  const pwa = usePwa();

  // O convite pequeno só aparece depois do "Agora não" no popup (ver InstallSheet).
  if (pwa.standalone || pwa.dismissed || !pwa.snoozed || !(pwa.canInstall || pwa.iosHint)) return null;

  return (
    <div className="notice" role="note">
      <span className="notice-icon"><Logo size={20} /></span>
      {pwa.canInstall ? (
        <>
          <p><b>Instale o app</b><small>Abre pela tela inicial, até sem internet.</small></p>
          <button type="button" className="btn primary small" onClick={install}>Instalar</button>
        </>
      ) : (
        <p>
          <b>Instale no iPhone</b>
          <small>Toque em Compartilhar e depois em &quot;Adicionar à Tela de Início&quot;.</small>
        </p>
      )}
      <button type="button" className="icon-btn" onClick={dismissInstall} aria-label="Dispensar convite de instalação">
        <IconX size={18} />
      </button>
    </div>
  );
}
