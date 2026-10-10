// Página inicial ("/"). Quem cria a conta entra com Google (AuthGate mostra a tela de login);
// depois de logado, o app roda no aparelho e funciona até sem internet.
import { AuthGate } from "@/ui/AuthGate";
import { ClientOnly } from "@/ui/ClientOnly";
import SoloApp from "@/ui/SoloApp";

export default function Home() {
  return (
    <ClientOnly>
      <AuthGate>
        <SoloApp />
      </AuthGate>
    </ClientOnly>
  );
}
