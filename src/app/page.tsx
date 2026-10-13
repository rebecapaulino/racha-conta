// Página inicial ("/"). Quem cria a conta entra com Google (AuthGate mostra a tela de login);
// depois de logado, o app roda no aparelho e funciona até sem internet.
// Duas áreas: Rolê (bar e restaurante) e Viagem (despesas de vários dias).
import { AuthGate } from "@/ui/AuthGate";
import { ClientOnly } from "@/ui/ClientOnly";
import Areas from "@/ui/Areas";

export default function Home() {
  return (
    <ClientOnly>
      <AuthGate>
        <Areas />
      </AuthGate>
    </ClientOnly>
  );
}
