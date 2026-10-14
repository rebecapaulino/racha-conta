// Ficha de instalação do app (PWA): nome, ícones e como ele abre no celular.

import type { MetadataRoute } from 'next';
import { THEME_COLOR, VISUAL } from '@/ui/visual';

// handle_links ainda não está no tipo do Next (é do Chrome); o resto é o manifesto normal.
export default function manifest(): MetadataRoute.Manifest & { handle_links?: 'auto' | 'preferred' | 'not-preferred' } {
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
    // Android (app instalado pelo Chrome): link do site, como o do convite, abre no app em vez do
    // navegador; com o app já aberto, vai para a mesma janela (e o "?convite=" chega a ela).
    // O iPhone não deixa link abrir o app da tela inicial: lá, o grupo aparece no app pela conta.
    launch_handler: { client_mode: 'navigate-existing' },
    handle_links: 'preferred',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
