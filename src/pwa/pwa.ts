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
  /** A pessoa tocou em "Agora não" no popup de instalação (volta depois de alguns dias). */
  snoozed: boolean;
}

const DISMISS_KEY = 'racha-conta-instalar-dispensado';
const SNOOZE_KEY = 'racha-conta-instalar-depois';
/** Depois de "Agora não", o popup só volta a aparecer depois deste tempo. */
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

let state: PwaState = { canInstall: false, iosHint: false, standalone: false, updateReady: false, dismissed: false, snoozed: false };
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

function readSnoozed(): boolean {
  try {
    const until = Number(localStorage.getItem(SNOOZE_KEY));
    return Number.isFinite(until) && until > Date.now();
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
  state = { ...state, standalone, iosHint: ios && safari && !standalone, dismissed: readDismissed(), snoozed: readSnoozed() };

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
            updateWhenSafe();
          }
        };
        check();
        sw.addEventListener('statechange', check);
      };
      track(reg.waiting);
      reg.addEventListener('updatefound', () => track(reg.installing));
      // Confere atualização quando o app volta para a frente, e de hora em hora com ele aberto.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
      window.setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
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

/** "Agora não" no popup: some por uns dias; o aviso pequeno continua no app. */
export function snoozeInstall(): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
  } catch {
    /* sem armazenamento: só some nesta visita */
  }
  set({ snoozed: true });
}

export function applyUpdate(): void {
  waiting?.postMessage('SKIP_WAITING');
}

/**
 * Versão nova pronta: troca sozinha (ninguém precisa saber que existe um "Atualizar"). A troca
 * recarrega a página, então espera um momento em que nada se perde: sem janela aberta (uma
 * despesa sendo lançada, por exemplo) e sem ninguém digitando, ou quando a pessoa sai do app.
 * O que já foi salvo (inclusive o que ainda vai para o grupo) fica guardado no aparelho.
 */
let watching = false;
function updateWhenSafe() {
  if (watching) return;
  watching = true;
  const busy = () => {
    const el = document.activeElement;
    const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable);
    return !!document.querySelector('dialog[open]') || typing;
  };
  const tryNow = () => {
    if (document.visibilityState === 'hidden' || !busy()) {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tryNow);
      applyUpdate();
    }
  };
  const timer = window.setInterval(tryNow, 3000);
  document.addEventListener('visibilitychange', tryNow);
  tryNow();
}
