import { useEffect, useRef } from 'react';
import { install, snoozeInstall, usePwa } from '../pwa/pwa';
import { IconCheck, IconShare, IconSquarePlus } from './icons';

/** Espera um pouco depois de abrir o app, para o popup não pular na cara de quem acabou de entrar. */
const DELAY_MS = 2500;

/**
 * Popup convidando a instalar o app na tela inicial.
 * Android/Chrome/Edge: botão "Instalar" (abre a janela do próprio navegador).
 * iPhone no Safari: o passo a passo, porque o iPhone não tem botão de instalar.
 */
export function InstallSheet() {
  const pwa = usePwa();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const show = !pwa.standalone && !pwa.snoozed && !pwa.dismissed && (pwa.canInstall || pwa.iosHint);

  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(() => {
      const d = dialogRef.current;
      if (d && !d.open && !document.querySelector('dialog[open]')) d.showModal?.();
    }, DELAY_MS);
    return () => window.clearTimeout(t);
  }, [show]);

  const later = () => {
    dialogRef.current?.close();
    snoozeInstall();
  };

  return (
    <dialog
      ref={dialogRef}
      className="sheet install-sheet"
      aria-labelledby="h-install"
      onCancel={snoozeInstall}
      onClick={(e) => e.target === e.currentTarget && later()}
    >
      <div className="sheet-body">
        <span className="sheet-grip" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element -- ícone do app, arquivo estático */}
        <img className="install-icon" src="/icons/icon-192.png" alt="" width={72} height={72} />
        {/* foco no título ao abrir: o leitor de tela anuncia o convite e nenhum botão já aparece "marcado" */}
        <h2 id="h-install" tabIndex={-1} autoFocus>Instale o Racha Conta</h2>
        <p>Fica na tela inicial do celular, como um app de verdade.</p>

        <ul className="install-perks">
          <li><span><IconCheck size={14} /></span>Abre num toque, sem procurar no navegador</li>
          <li><span><IconCheck size={14} /></span>Funciona até sem internet no bar</li>
          <li><span><IconCheck size={14} /></span>Tela cheia, sem barra de endereço</li>
        </ul>

        {pwa.canInstall ? (
          <div className="sheet-actions">
            <button type="button" className="btn secondary" onClick={later}>Agora não</button>
            <button
              type="button"
              className="btn primary"
              onClick={async () => {
                dialogRef.current?.close();
                await install();
              }}
            >
              Instalar
            </button>
          </div>
        ) : (
          <>
            <ol className="install-steps">
              <li>
                <span className="install-num">1</span>
                <span>
                  Toque em <b>Compartilhar</b>{' '}
                  <span className="install-glyph"><IconShare size={16} /></span> na barra do Safari
                </span>
              </li>
              <li>
                <span className="install-num">2</span>
                <span>
                  Escolha <b>Adicionar à Tela de Início</b>{' '}
                  <span className="install-glyph"><IconSquarePlus size={16} /></span>
                </span>
              </li>
            </ol>
            <button type="button" className="btn primary install-ok" onClick={later}>Entendi</button>
          </>
        )}
      </div>
    </dialog>
  );
}
