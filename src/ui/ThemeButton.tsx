import { useEffect, useState } from 'react';
import { IconMoon, IconSun } from './icons';
import { THEME_KEY as KEY } from './visual';

const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
};

/** Botão do topo: troca entre o modo claro e o escuro (e guarda a escolha neste aparelho). */
export function ThemeButton() {
  const [dark, setDark] = useState(false);
  // Só no aparelho: no servidor não dá para saber o tema.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- lê o tema uma vez, depois de montar
  useEffect(() => setDark(isDark()), []);

  function toggle() {
    const next = !isDark();
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try {
      localStorage.setItem(KEY, next ? 'dark' : 'light');
    } catch {
      // Sem armazenamento (aba anônima): vale até recarregar.
    }
    setDark(next);
  }

  return (
    <button
      type="button"
      className="top-btn theme-btn"
      onClick={toggle}
      aria-label={dark ? 'Mudar para o modo claro' : 'Mudar para o modo escuro'}
      title={dark ? 'Modo claro' : 'Modo escuro'}
    >
      {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
    </button>
  );
}
