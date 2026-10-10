import { useEffect, useRef, useState } from 'react';
import { signInWithGoogleToken } from '../auth/account';
import { GOOGLE_CLIENT_ID, loadGoogle, newNonce } from '../auth/google';

/** Botão oficial do Google. Chama onDone quando a pessoa entrou. */
export function GoogleButton({ onDone, onError }: { onDone: () => void; onError: (msg: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let alive = true;
    (async () => {
      try {
        const google = await loadGoogle();
        const nonce = await newNonce();
        if (!alive || !box.current) return;
        google.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: nonce.hashed,
          use_fedcm_for_button: true,
          callback: async ({ credential }) => {
            try {
              await signInWithGoogleToken(credential, nonce.raw);
              onDone();
            } catch {
              onError('Não deu para entrar agora. Tente de novo.');
            }
          },
        });
        const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        google.renderButton(box.current, {
          type: 'standard',
          theme: dark ? 'filled_black' : 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
          locale: 'pt-BR',
          width: Math.min(300, box.current.clientWidth || 300),
        });
      } catch {
        if (alive) setProblem('Sem conexão com o Google. Confira a internet e tente de novo.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [onDone, onError]);

  if (!GOOGLE_CLIENT_ID) return <p className="hint">O login ainda não está configurado neste endereço.</p>;
  return (
    <div className="google-slot">
      <div ref={box} className="google-btn" />
      {problem && <p className="field-error" role="alert">{problem}</p>}
    </div>
  );
}
