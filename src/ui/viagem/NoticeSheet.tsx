import type { TripNotice } from '../../core/trip';
import { Sheet } from './Sheet';

interface Props {
  notice: TripNotice | null;
  onClose: () => void;
}

/** "AAAA-MM-DD" → "23/11". */
const shortDate = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

/** Lista de nomes em texto corrido: "A, B e C". */
const joinNames = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names.at(-1)}` : (names[0] ?? ''));

/** Aviso do grupo (valores atualizados, por exemplo): aparece uma vez em cada aparelho, até tocar em "Entendi". */
export function NoticeSheet({ notice, onClose }: Props) {
  return (
    <Sheet open={!!notice} onClose={onClose} labelledBy="h-notice" className="notice-sheet">
      {notice && (
        <div className="sheet-body">
          <span className="sheet-grip" aria-hidden="true" />
          {shortDate(notice.at) && <span className="notice-badge">Atualizado em {shortDate(notice.at)}</span>}
          <h2 id="h-notice" tabIndex={-1}>{notice.title}</h2>
          {notice.lead && <p className="notice-lead">{notice.lead}</p>}
          {notice.highlight && (
            <div className="notice-hero">
              <b>{notice.highlight.value}</b>
              <span>{notice.highlight.label}</span>
            </div>
          )}
          {notice.text.map((p, i) => (
            <p key={i} className="notice-text">{p}</p>
          ))}
          {!!notice.cards?.length && (
            <div className="notice-cards">
              {notice.cards.map((c, i) => (
                <section key={i} className={`notice-card${c.tone ? ` tone-${c.tone}` : ''}`}>
                  <h3>{c.title}</h3>
                  {!!c.names?.length && <p className="notice-names">{joinNames(c.names)}</p>}
                  {!!c.chips?.length && (
                    <ul className="notice-chips">
                      {c.chips.map((x, k) => (
                        <li key={k}><small>{x.label}</small><b>{x.value}</b></li>
                      ))}
                    </ul>
                  )}
                  {c.note && <p className="notice-note">{c.note}</p>}
                </section>
              ))}
            </div>
          )}
          {notice.table && (
            <details className="notice-more">
              <summary>Ver todas as parcelas</summary>
              <div className="notice-table-wrap">
                <table className="notice-table">
                  <thead>
                    <tr>{notice.table.head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {notice.table.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((c, i) => (i === 0 ? <th key={i} scope="row">{c}</th> : <td key={i} className="num">{c}</td>))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
          {notice.footnote && <p className="notice-foot">{notice.footnote}</p>}
          <div className="sheet-actions">
            <button type="button" className="btn primary" onClick={onClose}>Entendi</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
