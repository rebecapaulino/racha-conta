import { useCallback, useEffect, useState } from 'react';
import { GoogleButton } from './GoogleButton';
import { IconCheck, Logo } from './icons';

/**
 * Tela de entrada: aparece para quem abre o app sem estar logado.
 * Topo com as cores da marca (paleta Marple) e uma mini notinha mostrando o que o app faz;
 * embaixo, o botão oficial do Google.
 */
export function LoginScreen() {
  const [error, setError] = useState('');
  // Depois de entrar, a própria sessão troca esta tela pelo app (ver AuthGate).
  const done = useCallback(() => setError(''), []);

  // Barra de status do celular em carmim, combinando com o topo; volta ao normal ao sair.
  useEffect(() => {
    const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
    const old = metas.map((m) => m.content);
    metas.forEach((m) => (m.content = '#CA2851'));
    return () => metas.forEach((m, i) => (m.content = old[i]));
  }, []);

  return (
    <main className="login">
      <section className="login-hero">
        <span className="login-bubbles" aria-hidden="true">
          <i /><i /><i /><i />
        </span>

        <div className="login-brand">
          <span className="login-logo"><Logo size={44} /></span>
          <h1>Racha Conta</h1>
          <p>Divida a conta do rolê sem treta: cada um paga o que consumiu, com o serviço certinho.</p>
        </div>

        {/* Mini notinha de enfeite */}
        <div className="login-mock" aria-hidden="true">
          <div className="mock-paper">
            <b className="mock-title">Sexta no Bar do Zé</b>
            <span className="mock-row"><i className="mock-dot d1">A</i>Ana<em>R$ 80,85</em></span>
            <span className="mock-row"><i className="mock-dot d2">B</i>Bruno<em>R$ 72,88</em></span>
            <span className="mock-row"><i className="mock-dot d3">C</i>Carla<em>R$ 80,85</em></span>
            <span className="mock-total">Total<em>R$ 315,15</em></span>
          </div>
          <span className="mock-chip">✓ 3/4 pagos</span>
        </div>
      </section>

      <section className="login-panel" aria-labelledby="h-login">
        <h2 id="h-login">Entrar</h2>
        <p className="login-lead">Use sua conta Google. É rápido e você não cria senha nova.</p>

        <GoogleButton onDone={done} onError={setError} />
        <p className="field-error" role="alert">{error}</p>

        <ul className="login-perks">
          <li><span><IconCheck size={14} /></span>Seus rolês guardados, com foto</li>
          <li><span><IconCheck size={14} /></span>Convide a galera por link</li>
          <li><span><IconCheck size={14} /></span>Funciona até sem internet no bar</li>
        </ul>

        <p className="login-legal">
          Só usamos seu nome, e-mail e foto. <a href="/privacidade">Política de Privacidade</a>
        </p>
      </section>
    </main>
  );
}

/** Abertura enquanto confere se já existe sessão no aparelho (evita piscar o login). */
export function Splash() {
  return (
    <main className="splash" aria-busy="true" aria-label="Abrindo o Racha Conta">
      <span className="login-logo"><Logo size={44} /></span>
    </main>
  );
}
