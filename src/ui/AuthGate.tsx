'use client';

import type { ReactNode } from 'react';
import { loginEnabled, useAccount } from '../auth/account';
import { LoginScreen, Splash } from './LoginScreen';

/**
 * Quem cria a conta precisa estar logado (decisão de 09/10/2026).
 * Mostra a tela de login no lugar do app, sem trocar de endereço: com o app offline,
 * um redirecionamento entre páginas poderia ficar num vai-e-volta.
 * (Quem entrar por convite na Fase 2 passa por fora deste portão.)
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { account, ready } = useAccount();
  if (!loginEnabled) return <>{children}</>;
  if (!ready) return <Splash />;
  if (!account) return <LoginScreen />;
  return <>{children}</>;
}
