import type { LogEntry } from '../state/billState';

// Registro de alterações: o que mudou na conta, quando e (no modo compartilhado) quem fez.

const ADDS = new Set<LogEntry['kind']>(['addPerson', 'addItem']);
const REMOVES = new Set<LogEntry['kind']>(['removePerson', 'removeItem']);

function when(at: number, now: Date): string {
  const d = new Date(at);
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return time;
  const day = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace(/\./g, '').replace(' de ', ' ');
  return `${day}, ${time}`;
}

/** Lista do mais novo para o mais antigo. `limit` mostra só as últimas linhas. */
export function ActivityLog({ log, limit }: { log: LogEntry[]; limit?: number }) {
  const now = new Date();
  const rows = [...log].reverse().slice(0, limit ?? log.length);
  if (rows.length === 0) return <p className="hint">Nada alterado ainda.</p>;
  return (
    <ol className="log">
      {rows.map((e, i) => {
        const tone = ADDS.has(e.kind) ? 'add' : REMOVES.has(e.kind) ? 'remove' : 'change';
        return (
          <li key={`${e.at}-${i}`} className={`log-row log-${tone}`}>
            <span className="log-dot" aria-hidden="true">{tone === 'add' ? '+' : tone === 'remove' ? '−' : '•'}</span>
            <span className="log-text">
              {e.by && <b>{e.by} · </b>}
              {e.text}
            </span>
            <time className="log-time" dateTime={new Date(e.at).toISOString()}>{when(e.at, now)}</time>
          </li>
        );
      })}
    </ol>
  );
}
