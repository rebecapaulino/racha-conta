import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade · Racha Conta",
  description: "Quais dados o Racha Conta usa, onde ficam guardados e como apagar.",
};

// E-mail de contato mostrado na página. Deixe vazio para não mostrar nenhum.
const CONTACT_EMAIL = "rebecaoliveir2000@gmail.com";
const UPDATED = "13 de outubro de 2026";

export default function Privacidade() {
  return (
    <main className="app app-single legal">
      <header className="topbar">
        <Link href="/" className="top-btn">← Voltar ao app</Link>
      </header>

      <h1>Política de Privacidade</h1>
      <p className="muted">Racha Conta · atualizada em {UPDATED}</p>

      <p>
        O Racha Conta ajuda você a dividir a conta do bar ou restaurante e as despesas de uma viagem. Esta página explica, sem
        juridiquês, quais dados o app usa, onde eles ficam e como você apaga tudo.
      </p>

      <section>
        <h2>1. Suas contas no aparelho</h2>
        <p>
          Enquanto uma conta não é compartilhada, tudo o que você digita (pessoas, itens, valores, fotos,
          histórico) fica <b>só no seu aparelho</b>, no armazenamento do próprio navegador. Nada disso é
          enviado para nós nem para ninguém. Se você limpar os dados do navegador ou apagar o app, essas
          informações somem.
        </p>
        <p>
          <b>Foto da nota fiscal:</b> quando você usa &quot;Ler nota fiscal&quot;, a foto é lida no seu
          próprio celular e não é enviada para nós nem para ninguém. Se você escolher guardar a foto na
          nota, ela fica só neste aparelho, junto com a conta, até você removê-la ou apagar a conta.
        </p>
        <p>
          <b>Viagens:</b> os nomes de quem vai, as despesas (valor, data, categoria, quem pagou) e os
          pagamentos registrados também ficam <b>só neste aparelho</b>. O app não pede documentos, CPF nem
          dados de cartão. Ao apagar a viagem, tudo isso sai do aparelho.
        </p>
      </section>

      <section>
        <h2>2. Entrando com Google</h2>
        <p>
          Para criar contas no app, você entra com a sua conta Google (quem só participa de um rolê pelo
          link de convite não precisa). Recebemos do Google:
        </p>
        <ul>
          <li>seu <b>nome</b>, seu <b>e-mail</b> e sua <b>foto do perfil</b>;</li>
          <li>nunca a sua senha, nem acesso ao seu Gmail, contatos ou Drive.</li>
        </ul>
        <p>Usamos esses dados só para identificar você no app e mostrar quem fez cada alteração.</p>
      </section>

      <section>
        <h2>3. Rolês compartilhados</h2>
        <p>
          Num rolê compartilhado, os dados ficam guardados na nuvem para que todos vejam a mesma conta:
          nomes, itens, valores, quem já pagou, o registro de alterações e a foto do rolê, se houver.
          Quem entra pelo link de convite pode usar o app <b>sem login</b>; nesse caso guardamos apenas o
          nome que a pessoa digitar.
        </p>
        <p>
          <b>Fotos:</b> quem envia uma foto é responsável por ter a permissão das pessoas que aparecem nela.
          Qualquer pessoa do rolê pode pedir que uma foto seja removida.
        </p>
      </section>

      <section>
        <h2>4. Com quem os dados passam</h2>
        <ul>
          <li><b>Google</b>: faz o login.</li>
          <li><b>Supabase</b>: guarda os rolês compartilhados e as fotos (servidores no Brasil).</li>
          <li><b>Vercel</b>: hospeda o site.</li>
        </ul>
        <p>
          Não vendemos dados, não mostramos anúncios e não usamos rastreadores ou ferramentas de
          análise de comportamento.
        </p>
      </section>

      <section>
        <h2>5. Por quanto tempo guardamos</h2>
        <p>
          Os dados do aparelho ficam até você apagar. Os rolês compartilhados ficam até alguém do rolê
          apagá-los ou até o prazo de expiração automática, que será informado aqui e no próprio app
          antes de o modo compartilhado ser liberado.
        </p>
      </section>

      <section>
        <h2>6. Seus direitos (LGPD)</h2>
        <p>
          Você pode pedir acesso, correção ou exclusão dos seus dados, e cancelar o acesso do app à sua
          conta Google a qualquer momento em{" "}
          <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
            myaccount.google.com/permissions
          </a>
          .{" "}
          {CONTACT_EMAIL ? (
            <>
              Para isso, escreva para <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </>
          ) : (
            <>Para pedidos de exclusão, use o contato informado na tela de login do Google.</>
          )}
        </p>
      </section>

      <section>
        <h2>7. Mudanças</h2>
        <p>Se esta política mudar, a data no topo é atualizada e o app avisa quando a mudança for relevante.</p>
      </section>
    </main>
  );
}
