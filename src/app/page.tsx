// Página inicial ("/"): o modo solo, que funciona sem servidor e sem internet.
import { ClientOnly } from "@/ui/ClientOnly";
import SoloApp from "@/ui/SoloApp";

export default function Home() {
  return (
    <ClientOnly>
      <SoloApp />
    </ClientOnly>
  );
}
