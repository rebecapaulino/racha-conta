// As rotas de leitura da nota só atendem o próprio app (não viram serviço aberto para outros sites).

export function fromThisSite(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host || process.env.NODE_ENV === 'development';
  } catch {
    return false;
  }
}

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
