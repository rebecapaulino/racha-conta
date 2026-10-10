// Botão oficial "Entrar com Google" (Google Identity Services).
// O script vem do Google (accounts.google.com); sem internet o botão simplesmente não aparece.

interface CredentialResponse {
  credential: string;
}

interface GoogleId {
  initialize: (config: {
    client_id: string;
    callback: (r: CredentialResponse) => void;
    nonce?: string;
    use_fedcm_for_prompt?: boolean;
    use_fedcm_for_button?: boolean;
    button_auto_select?: boolean;
  }) => void;
  renderButton: (el: HTMLElement, options: Record<string, string | number>) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

let scriptPromise: Promise<GoogleId> | null = null;

export function loadGoogle(): Promise<GoogleId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  scriptPromise ??= new Promise<GoogleId>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('google')));
    s.onerror = () => {
      scriptPromise = null; // permite tentar de novo quando a internet voltar
      reject(new Error('offline'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** O Google confere o nonce: mandamos o hash para ele e o valor original para o Supabase. */
export async function newNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return { raw, hashed };
}
