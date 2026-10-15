import { useEffect, useRef, useState } from 'react';
import { signInWithGoogleToken } from '../auth/account';
import { GOOGLE_CLIENT_ID, loadGoogle, newNonce } from '../auth/google';

/** Botão oficial do Google. Chama onDone quando a pessoa entrou. */
export function GoogleButton({
  onDone,
  onError,
  shape = 'pill',
  fill = false,
  text = 'signin_with',
  oneTap = false,
}: {
  onDone: () => void;
  onError: (msg: string) => void;
  /** 'rounded': retângulo com cantos arredondados (o Google só oferece 4px; o recorte é feito no CSS). */
  shape?: 'pill' | 'rounded';
  /** Ocupa a largura toda do espaço (o Google aceita de 200 a 400px) e se ajusta se ela mudar. */
  fill?: boolean;
  /** "Fazer login com o Google" ou "Continuar com o Google". */
  text?: 'signin_with' | 'continue_with';
  /**
   * Também abre a janelinha do Google "Continuar como Fulano". Quem já entrou no app antes com
   * essa conta Google entra sozinho, sem tocar em nada (ex.: abriu o link do convite num
   * navegador em que o app ainda não estava logado).
   */
  oneTap?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let alive = true;
    let observer: ResizeObserver | undefined;
    (async () => {
      try {
        const google = await loadGoogle();
        const nonce = await newNonce();
        const el = box.current;
        if (!alive || !el) return;
        google.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: nonce.hashed,
          use_fedcm_for_button: true,
          ...(oneTap ? { use_fedcm_for_prompt: true, auto_select: true, itp_support: true, cancel_on_tap_outside: false } : {}),
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
        let drawn = 0;
        const draw = () => {
          const width = fill
            ? Math.max(200, Math.min(400, Math.floor(el.clientWidth)))
            : Math.min(300, el.clientWidth || 300);
          if (width === drawn) return;
          drawn = width;
          el.replaceChildren();
          google.renderButton(el, {
            type: 'standard',
            // no formato arredondado, o botão branco com borda (o quadrado branco do G do tema escuro fica torto no recorte)
            theme: dark && shape === 'pill' ? 'filled_black' : 'outline',
            size: 'large',
            text,
            shape: shape === 'rounded' ? 'rectangular' : 'pill',
            locale: 'pt-BR',
            width,
          });
        };
        draw();
        if (oneTap) google.prompt();
        // O Google desenha o botão com largura fixa: se a coluna mudar (ex.: celular deitado), desenha de novo.
        if (fill && typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(draw);
          observer.observe(el);
        }
      } catch {
        if (alive) setProblem('Sem conexão com o Google. Confira a internet e tente de novo.');
      }
    })();
    return () => {
      alive = false;
      observer?.disconnect();
    };
  }, [onDone, onError, shape, fill, text, oneTap]);

  if (!GOOGLE_CLIENT_ID) return <p className="hint">O login ainda não está configurado neste endereço.</p>;
  return (
    <div className="google-slot">
      <div ref={box} className={`google-btn${shape === 'rounded' ? ' rounded' : ''}`} />
      {problem && <p className="field-error" role="alert">{problem}</p>}
    </div>
  );
}
