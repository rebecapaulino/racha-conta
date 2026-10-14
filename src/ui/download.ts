/** Baixa a foto (ou arquivo) que já está aberta na tela, com o nome dado. */
export function downloadUrl(url: string, name: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** "nota-mercado.jpg": nome de arquivo sem acento nem espaço. */
export const fileName = (base: string) =>
  `nota-${(base.trim() || 'fiscal').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.jpg`;
