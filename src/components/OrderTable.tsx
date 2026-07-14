import type { DisplayRow } from '../utils/dataProcessor';
import { formatDateDisplay } from '../utils/dateUtils';

interface Props {
  rows: DisplayRow[];
  onMemoChange: (id: string, value: string) => void;
  onShipmentChange: (id: string, value: string) => void;
  colorScheme?: 'pink' | 'green';
  readOnly?: boolean;
}

const SCHEME = {
  pink: {
    headerBg: '#c0392b', headerBorder: '#a93226', rowHover: '#fff0ef',
    groupOdd: '#fff', groupEven: '#fdf5f4',
    sepBg: '#f5e6e5', sepBorder: '#e8c4c1',
    accentBorder: '#d4796f',
  },
  green: {
    headerBg: '#27ae60', headerBorder: '#1e8449', rowHover: '#eaf7ef',
    groupOdd: '#fff', groupEven: '#f3faf5',
    sepBg: '#dff2e7', sepBorder: '#b7dfc5',
    accentBorder: '#5bbf82',
  },
};

/* ── 예약 토글 버튼 ── */
function MemoButton({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const active = value.includes('예약');
  return (
    <button
      onClick={() => onChange(active ? '' : '예약')}
      style={{
        padding: '3px 10px',
        fontSize: 11,
        fontWeight: active ? 700 : 400,
        borderRadius: 5,
        border: active ? '1.5px solid #27ae60' : '1.5px solid #d5d5d5',
        background: active ? '#e8f8f0' : '#fafafa',
        color: active ? '#27ae60' : '#bbb',
        cursor: 'pointer',
        transition: 'all 0.12s',
        whiteSpace: 'nowrap',
      }}
    >
      예약
    </button>
  );
}

/* ── 롯데 카운터 버튼 ── */
function LotteButton({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const m = value.match(/^롯데(\d+)?$/);
  const active = !!m;
  const count = active ? (m[1] ? Number(m[1]) : 1) : 0;

  const toggle = () => onChange(active ? '' : '롯데');
  const adjust = (delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = count + delta;
    if (next <= 0) { onChange(''); return; }
    onChange(next === 1 ? '롯데' : `롯데${next}`);
  };

  if (!active) {
    return (
      <button
        onClick={toggle}
        style={{
          padding: '3px 12px',
          fontSize: 11,
          borderRadius: 5,
          border: '1.5px solid #d5d5d5',
          background: '#fafafa',
          color: '#bbb',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        롯데
      </button>
    );
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 0, border: '1.5px solid #e67e22', borderRadius: 6, overflow: 'hidden' }}>
      <button
        onClick={(e) => adjust(-1, e)}
        style={counterBtnStyle('#fff4ec', '#c0392b')}
      >−</button>
      <button
        onClick={toggle}
        style={{
          padding: '3px 8px',
          fontSize: 11,
          fontWeight: 700,
          background: '#fff4ec',
          color: '#e67e22',
          border: 'none',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          borderLeft: '1px solid #f0c090',
          borderRight: '1px solid #f0c090',
        }}
        title="클릭하면 롯데 해제"
      >
        롯데 {count}
      </button>
      <button
        onClick={(e) => adjust(+1, e)}
        style={counterBtnStyle('#fff4ec', '#c0392b')}
      >+</button>
    </div>
  );
}

function counterBtnStyle(bg: string, color: string): React.CSSProperties {
  return {
    padding: '3px 7px',
    fontSize: 12,
    fontWeight: 700,
    background: bg,
    color,
    border: 'none',
    cursor: 'pointer',
  };
}

/* ── 메인 테이블 ── */
export default function OrderTable({ rows, onMemoChange, onShipmentChange, colorScheme = 'pink', readOnly = false }: Props) {
  if (rows.length === 0) return null;

  const sc = SCHEME[colorScheme];
  const headers = ['발주번호', '물류센터', '상품이름', '확정수량', '입고예정일', '메모', colorScheme === 'green' ? '표기' : '쉼먼트'];

  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e5e5e5', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={{
                background: sc.headerBg,
                color: '#fff',
                fontWeight: 600,
                padding: '7px 8px',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                border: `1px solid ${sc.headerBorder}`,
                fontSize: 12,
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(() => {
            let groupIndex = 0;
            return rows.map((row) => {
            if (row.isBlank) {
              groupIndex++;
              return (
                <tr key={row.id}>
                  <td colSpan={7} style={{
                    height: 10,
                    background: sc.sepBg,
                    borderTop: `2px solid ${sc.sepBorder}`,
                    borderBottom: `2px solid ${sc.sepBorder}`,
                    padding: 0,
                  }} />
                </tr>
              );
            }

            return (
              <tr
                key={row.id}
                style={{ borderBottom: '1px solid #ebebeb', background: '#fff' }}
                onMouseEnter={e => (e.currentTarget.style.background = sc.rowHover)}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                <td style={cs(70)}>{row.발주번호}</td>
                <td style={cs(60)}>{row.물류센터}</td>
                <td style={{ ...cs(0), textAlign: 'left', minWidth: 220, padding: '5px 8px' }}>{row.상품이름}</td>
                <td style={cs(50)}>{row.확정수량 !== '' ? row.확정수량 : ''}</td>
                <td style={{ ...cs(80), whiteSpace: 'nowrap' }}>{formatDateDisplay(row.입고예정일)}</td>

                {/* 메모 */}
                <td style={{ ...cs(70), padding: '4px 6px' }}>
                  {readOnly ? (
                    <span style={{ fontSize: 11, color: '#666' }}>{row.메모}</span>
                  ) : (
                    <MemoButton value={row.메모} onChange={(v) => onMemoChange(row.id, v)} />
                  )}
                </td>

                {/* 쉼먼트 / 표기 */}
                <td style={{ ...cs(90), padding: '4px 6px' }}>
                  {readOnly ? (
                    <span style={{ fontSize: 11, color: '#666' }}>{row.쉼먼트}</span>
                  ) : (
                    <LotteButton value={row.쉼먼트} onChange={(v) => onShipmentChange(row.id, v)} />
                  )}
                </td>
              </tr>
            );
          });
          })()}
        </tbody>
      </table>
    </div>
  );
}

function cs(width: number): React.CSSProperties {
  return {
    padding: '5px 8px',
    textAlign: 'center',
    color: '#444',
    border: '1px solid #eeeeee',
    width: width > 0 ? width : undefined,
    fontSize: 11,
  };
}
