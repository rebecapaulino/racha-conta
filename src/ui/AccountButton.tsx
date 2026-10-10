import { useCallback, useRef } from 'react';
import { signOut, useAccount } from '../auth/account';
import { initial } from './Avatar';
import { GoogleButton } from './GoogleButton';
import { IconUser } from './icons';

/** Botão da conta no topo + folha com "Entrar com Google" / dados da conta e "Sair". */
export function AccountButton({ toast }: { toast: (msg: string) => void }) {
  const { account } = useAccount();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = useCallback(() => dialogRef.current?.close(), []);

  const done = useCallback(() => {
    dialogRef.current?.close();
    toast('Você entrou com o Google');
  }, [toast]);

  return (
    <>
      <button
        type="button"
        className={`round-btn account-btn${account ? ' on' : ''}`}
        onClick={() => dialogRef.current?.showModal?.()}
        aria-label={account ? `Conta de ${account.name}` : 'Entrar com Google'}
        title={account ? account.name : 'Entrar'}
      >
        {account?.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto do perfil Google
          <img src={account.photo} alt="" referrerPolicy="no-referrer" />
        ) : account ? (
          <span aria-hidden="true">{initial(account.name)}</span>
        ) : (
          <IconUser />
        )}
      </button>

      <dialog
        ref={dialogRef}
        className="sheet"
        aria-labelledby="h-account"
        onClick={(e) => e.target === e.currentTarget && close()}
      >
        <div className="sheet-body">
          <span className="sheet-grip" aria-hidden="true" />
          {account ? (
            <>
              <h2 id="h-account">Sua conta</h2>
              <div className="account-card">
                <span className="account-photo">
                  {account.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- foto do perfil Google
                    <img src={account.photo} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <span aria-hidden="true">{initial(account.name)}</span>
                  )}
                </span>
                <span className="row-main">
                  <b>{account.name}</b>
                  <small>{account.email}</small>
                </span>
              </div>
              <p>Você pode criar rolês compartilhados e convidar a galera pelo link.</p>
              <div className="sheet-actions">
                <button type="button" className="btn secondary" onClick={close}>Fechar</button>
                <button
                  type="button"
                  className="btn secondary danger"
                  onClick={async () => {
                    await signOut();
                    close();
                    toast('Você saiu da conta');
                  }}
                >
                  Sair
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 id="h-account">Entrar</h2>
              <p>
                Entre com o Google para criar rolês compartilhados e convidar a galera. Usar o app sozinho
                continua sem login.
              </p>
              <GoogleButton onDone={done} onError={toast} />
              <p className="hint">
                Só usamos seu nome, e-mail e foto. <a href="/privacidade">Política de Privacidade</a>
              </p>
              <button type="button" className="btn ghost" onClick={close}>Agora não</button>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
