import type { TripNotice } from '../../core/trip';
import { Sheet } from './Sheet';

interface Props {
  notice: TripNotice | null;
  onClose: () => void;
}

/** Aviso do grupo (valores atualizados, por exemplo): aparece uma vez em cada aparelho, até tocar em "Entendi". */
export function NoticeSheet({ notice, onClose }: Props) {
  return (
    <Sheet open={!!notice} onClose={onClose} labelledBy="h-notice" className="notice-sheet">
      {notice && (
        <div className="sheet-body">
          <span className="sheet-grip" aria-hidden="true" />
          <h2 id="h-notice" tabIndex={-1}>{notice.title}</h2>
          {notice.text.map((p, i) => (
            <p key={i} className="notice-text">{p}</p>
          ))}
          {notice.table && (
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
          )}
          <div className="sheet-actions">
            <button type="button" className="btn primary" onClick={onClose}>Entendi</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
