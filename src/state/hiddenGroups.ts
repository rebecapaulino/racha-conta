// Grupos que a pessoa excluiu da lista dela (Viagem ou Rolê). Ficam na conta (valem em todo
// aparelho em que ela entrar). Aqui no aparelho fica só o que ainda não chegou na conta (sem
// internet na hora): vale já, e vai para a conta na próxima vez que der. Depois de chegar, sai
// daqui, para a conta ser a única lista (e entrar de novo pelo convite valer em todo lugar).

import { saveHiddenGroups, type Account } from '../auth/account';

const KEY = 'racha-grupos-excluidos-v1';

export function loadHidden(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((g): g is string => typeof g === 'string') : [];
  } catch {
    return [];
  }
}

function saveHidden(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* modo privado: vale só na conta */
  }
}

/** Os excluídos que valem agora: os da conta e os deste aparelho. */
export function hiddenFor(account: Pick<Account, 'hiddenGroups'> | null): Set<string> {
  return new Set([...loadHidden(), ...(account?.hiddenGroups ?? [])]);
}

/** Excluiu da lista: some deste aparelho na hora e dos outros quando a conta for atualizada. */
export function hideGroup(groupId: string): void {
  saveHidden([...new Set([...loadHidden(), groupId])]);
  saveHiddenGroups([groupId]).then(
    () => saveHidden(loadHidden().filter((g) => g !== groupId)),
    () => {
      /* sem internet: vai na próxima conferência (pushHidden) */
    },
  );
}

/** Entrou de novo pelo convite: volta a aparecer. */
export function unhideGroup(groupId: string): void {
  saveHidden(loadHidden().filter((g) => g !== groupId));
  saveHiddenGroups([], [groupId]).catch(() => {});
}

/** Manda para a conta os excluídos deste aparelho que ela ainda não tem. */
export function pushHidden(account: Pick<Account, 'hiddenGroups'>): void {
  const local = loadHidden();
  if (!local.length) return;
  const missing = local.filter((g) => !account.hiddenGroups.includes(g));
  if (!missing.length) return saveHidden([]);
  saveHiddenGroups(missing).then(
    () => saveHidden(loadHidden().filter((g) => !missing.includes(g))),
    () => {},
  );
}
