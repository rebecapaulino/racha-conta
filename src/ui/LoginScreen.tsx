import { useCallback, useEffect, useState } from 'react';
import { GoogleButton } from './GoogleButton';
import { IconCamera, IconUsers, IconWifiOff, Logo } from './icons';

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

        {/* Enfeite: a nota do bar (atrás) vira a divisão por pessoa (na frente) */}
        <div className="login-mock" aria-hidden="true">
          <div className="mock-receipt">
            <b className="r-head">BAR DO ZÉ</b>
            <span className="r-sub">MESA 12 · CONSUMO</span>
            <hr />
            <span className="r-line"><span>2 CAIPIRINHA</span><span>44,00</span></span>
            <span className="r-line"><span>3 CHOPP</span><span>43,50</span></span>
            <span className="r-line"><span>1 PICANHA</span><span>142,00</span></span>
            <span className="r-line"><span>1 FRITAS</span><span>36,00</span></span>
            <span className="r-line"><span>1 PUDIM</span><span>21,00</span></span>
            <hr />
            <span className="r-line"><span>SUBTOTAL</span><span>286,50</span></span>
            <span className="r-line"><span>SERVIÇO 10%</span><span>28,65</span></span>
            <span className="r-line r-total"><span>TOTAL</span><span>R$ 315,15</span></span>
            <span className="r-barcode" />
          </div>
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

        <GoogleButton onDone={done} onError={setError} shape="rounded" />
        <p className="field-error" role="alert">{error}</p>

        <ul className="login-perks">
          <li>
            <span className="perk-icon p1"><IconCamera size={18} /></span>
            <span className="perk-text"><b className="perk-long">Seus rolês guardados</b><b className="perk-short" aria-hidden="true">Rolês com foto</b><small>Com foto, total e quem foi</small></span>
          </li>
          <li>
            <span className="perk-icon p2"><IconUsers size={18} /></span>
            <span className="perk-text"><b className="perk-long">Convide a galera por link</b><b className="perk-short" aria-hidden="true">Convite por link</b><small>Cada um vê a sua parte e marca que pagou</small></span>
          </li>
          <li>
            <span className="perk-icon p3"><IconWifiOff size={18} /></span>
            <span className="perk-text"><b className="perk-long">Funciona até sem internet</b><b className="perk-short" aria-hidden="true">Funciona offline</b><small>Sinal fraco no bar não atrapalha</small></span>
          </li>
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
