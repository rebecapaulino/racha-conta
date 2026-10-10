// Entrega o service worker em /sw.js com um número de versão novo a cada build,
// para o celular perceber que há atualização.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-static';

const VERSION = Date.now().toString(36);
const SCRIPT = readFileSync(join(process.cwd(), 'src/pwa/sw.template.js'), 'utf8').replaceAll('__VERSION__', VERSION);

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
