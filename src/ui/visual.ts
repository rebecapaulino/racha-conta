// Chave do visual do app. Os dois convivem no código:
//  - 'fluent': estilo Microsoft atual (Fluent 2), em visual-fluent.css
//  - 'suave':  estilo limpo e suave dos prints 2, 3 e 4, em globals.css
// Para voltar ao anterior, troque aqui. Para comparar sem mexer no código,
// abra o app com ?visual=suave ou ?visual=fluent no endereço.

export type Visual = 'fluent' | 'suave';

export const VISUAL: Visual = 'fluent';

/** Cor da barra do navegador em cada visual. */
export const THEME_COLOR: Record<Visual, { light: string; dark: string }> = {
  fluent: { light: '#F5F5F5', dark: '#1F1F1F' },
  suave: { light: '#F6F4F2', dark: '#171515' },
};

/** Roda antes da página aparecer: aplica ?visual= do endereço, se houver. */
export const VISUAL_OVERRIDE_SCRIPT = `try{var v=new URLSearchParams(location.search).get('visual');if(v==='fluent'||v==='suave')document.documentElement.dataset.visual=v}catch(e){}`;

/** Visual em uso na página (só no aparelho, depois do script acima). */
export function activeVisual(): Visual {
  const v = typeof document !== 'undefined' ? document.documentElement.dataset.visual : undefined;
  return v === 'fluent' || v === 'suave' ? v : VISUAL;
}
