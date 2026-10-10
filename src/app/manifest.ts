// Ficha de instalação do app (PWA): nome, ícones e como ele abre no celular.

import type { MetadataRoute } from 'next';
import { THEME_COLOR, VISUAL } from '@/ui/visual';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Racha Conta',
    short_name: 'Racha Conta',
    description: 'Divida a conta do bar ou restaurante por pessoa, já com o serviço, e mande o resumo no WhatsApp.',
    lang: 'pt-BR',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: THEME_COLOR[VISUAL].light,
    theme_color: THEME_COLOR[VISUAL].light,
    categories: ['finance', 'food', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
