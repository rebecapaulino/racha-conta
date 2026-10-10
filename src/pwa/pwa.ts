// Liga o app instalável: registra o service worker, guarda o convite de instalação
// do Android/Chrome e avisa quando há versão nova. Só roda no aparelho.

import { useSyncExternalStore } from 'react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PwaState {
  /** O navegador oferece instalação (Android, Chrome, Edge). */
  canInstall: boolean;
  /** iPhone/iPad no Safari: precisa ensinar o "Adicionar à Tela de Início". */
  iosHint: boolean;
  /** Já está aberto como app instalado. */
  standalone: boolean;
  /** Há versão nova esperando. */
  updateReady: boolean;
  /** A pessoa fechou o convite de instalação. */
  dismissed: boolean;
}

const DISMISS_KEY = 'racha-conta-instalar-dispensado';

let state: PwaState = { canInstall: false, iosHint: false, standalone: false, updateReady: false, dismissed: false };
let deferred: InstallPromptEvent | null = null;
let waiting: ServiceWorker | null = null;
let started = false;
const listeners = new Set<() => void>();

function set(patch: Partial<PwaState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  state = { ...state, standalone, iosHint: ios && safari && !standalone, dismissed: readDismissed() };

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    set({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    set({ canInstall: false, standalone: true });
  });

  // Em desenvolvimento o service worker atrapalharia (guardaria versões velhas).
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  navigator.serviceWorker
    .register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .then((reg) => {
      const track = (sw: ServiceWorker | null) => {
        if (!sw) return;
        const check = () => {
          // Só é "atualização" se já havia uma versão controlando a página.
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            waiting = sw;
            set({ updateReady: true });
          }
        };
        check();
        sw.addEventListener('statechange', check);
      };
      track(reg.waiting);
      reg.addEventListener('updatefound', () => track(reg.installing));
      // Confere atualização quando o app volta para a frente.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    })
    .catch(() => {
      /* sem service worker o app continua funcionando online */
    });
}

function subscribe(l: () => void) {
  start();
  listeners.add(l);
  return () => listeners.delete(l);
}

const server: PwaState = state;

export function usePwa(): PwaState {
  return useSyncExternalStore(subscribe, () => state, () => server);
}

export async function install(): Promise<void> {
  if (!deferred) return;
  await deferred.prompt();
  await deferred.userChoice.catch(() => null);
  deferred = null;
  set({ canInstall: false });
}

export function dismissInstall(): void {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* sem armazenamento: só some nesta visita */
  }
  set({ dismissed: true });
}

export function applyUpdate(): void {
  waiting?.postMessage('SKIP_WAITING');
}
