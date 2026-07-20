import { useState, useCallback } from 'react';
import FileUpload from './components/FileUpload';
import OrderTable from './components/OrderTable';
import AddressManager from './components/AddressManager';
import SenderManager from './components/SenderManager';
import {
  parseFile, buildDisplayRows, splitByReservation, extractOrderRows,
} from './utils/dataProcessor';
import type { DisplayRow } from './utils/dataProcessor';
import { exportLotteExcel, exportSummaryExcel } from './utils/excelExport';
import { printPanel } from './utils/printUtils';
import type { AddressEntry, SenderInfo } from './types';
import { DEFAULT_ADDRESSES } from './data/addresses';
import './index.css';

const STORAGE_KEY = 'shipment_addresses';
const SENDER_STORAGE_KEY = 'shipment_sender';

const DEFAULT_SENDER: SenderInfo = { name: '', phone1: '', phone2: '', zip: '', addr: '' };

function loadAddresses(): AddressEntry[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_ADDRESSES;
}

function saveAddresses(addresses: AddressEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
}

function loadSender(): SenderInfo {
  try {
    const saved = localStorage.getItem(SENDER_STORAGE_KEY);
    if (saved) return { ...DEFAULT_SENDER, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_SENDER;
}

function saveSender(sender: SenderInfo) {
  localStorage.setItem(SENDER_STORAGE_KEY, JSON.stringify(sender));
}

function mergeReservedRows(existing: DisplayRow[], incoming: DisplayRow[]): DisplayRow[] {
  const existingOrderRows = extractOrderRows(existing);
  const incomingOrderRows = extractOrderRows(incoming);

  const existingKeys = new Set(
    existingOrderRows.map(r => `${r.발주번호}│${r.상품이름}│${r.확정수량}│${String(r.입고예정일)}`)
  );

  const newOrderRows = incomingOrderRows.filter(
    r => !existingKeys.has(`${r.발주번호}│${r.상품이름}│${r.확정수량}│${String(r.입고예정일)}`)
  );

  if (newOrderRows.length === 0) return existing;

  const combined = [...existingOrderRows, ...newOrderRows];
  return buildDisplayRows(combined);
}

type Tab = 'shipment' | 'settlement';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('shipment');
  const [leftRows, setLeftRows] = useState<DisplayRow[]>([]);
  const [rightRows, setRightRows] = useState<DisplayRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [addresses, setAddresses] = useState<AddressEntry[]>(loadAddresses);
  const [showAddressManager, setShowAddressManager] = useState(false);
  const [sender, setSender] = useState<SenderInfo>(loadSender);
  const [showSenderManager, setShowSenderManager] = useState(false);
  const [error, setError] = useState('');

  const hasData = leftRows.length > 0 || rightRows.length > 0;

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setError('');
    try {
      const rows = await parseFile(file);
      if (rows.length === 0) {
        setError('데이터를 찾을 수 없습니다. 헤더가 올바른지 확인해주세요.');
      } else {
        setLeftRows(buildDisplayRows(rows));
        setRightRows([]);
        setFileName(file.name);
      }
    } catch (e) {
      setError('파일 처리 중 오류가 발생했습니다: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLeftMemoChange = useCallback((id: string, value: string) => {
    setLeftRows(prev => prev.map(r => r.id === id ? { ...r, 메모: value } : r));
  }, []);

  const handleLeftShipmentChange = useCallback((id: string, value: string) => {
    setLeftRows(prev => prev.map(r => r.id === id ? { ...r, 쉼먼트: value } : r));
  }, []);

  const handleRightShipmentChange = useCallback((id: string, value: string) => {
    setRightRows(prev => prev.map(r => r.id === id ? { ...r, 쉼먼트: value } : r));
  }, []);

  const handlePullReservations = useCallback(() => {
    const { normalRows, reservedRows } = splitByReservation(leftRows);

    if (reservedRows.length === 0) {
      alert('예약 표시된 묶음이 없습니다.\n메모 열에 "예약"을 입력 후 다시 시도하세요.');
      return;
    }

    const newLeft = buildDisplayRows(normalRows);
    const newRight = mergeReservedRows(rightRows, buildDisplayRows(reservedRows));
    setLeftRows(newLeft);
    setRightRows(newRight);
  }, [leftRows, rightRows]);

  const handleCancelReservations = useCallback(() => {
    if (rightRows.length === 0) return;
    const rightOrderRows = extractOrderRows(rightRows);
    const leftOrderRows = extractOrderRows(leftRows);
    const combined = [...leftOrderRows, ...rightOrderRows];
    setLeftRows(buildDisplayRows(combined));
    setRightRows([]);
  }, [leftRows, rightRows]);

  const handleAddressUpdate = (updated: AddressEntry[]) => {
    setAddresses(updated);
    saveAddresses(updated);
  };

  const handleSenderUpdate = (updated: SenderInfo) => {
    setSender(updated);
    saveSender(updated);
  };

  const handleReset = () => {
    setLeftRows([]);
    setRightRows([]);
    setFileName('');
    setError('');
  };

  const allRows = [...leftRows, ...rightRows];
  const lotteCount = allRows.filter(
    r => !r.isBlank && r.물류센터 && /^롯데\d*$/.test(r.쉼먼트.trim())
  ).length;

  const leftItemCount = leftRows.filter(r => !r.isBlank).length;
  const rightItemCount = rightRows.filter(r => !r.isBlank).length;

  const hasPendingReservations = leftRows.some(
    r => !r.isBlank && (r.메모.includes('예약') || r.쉼먼트.includes('예약'))
  );

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      <header style={{
        background: '#fff', borderBottom: '1px solid #f0f0f0',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ maxWidth: 1600, margin: '0 auto', padding: '0 24px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.3px' }}>📦 쉽먼트</span>
            <nav style={{ display: 'flex', gap: 2 }}>
              {(['shipment', 'settlement'] as Tab[]).map(id => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  style={{
                    padding: '5px 16px', fontSize: 13,
                    fontWeight: activeTab === id ? 600 : 400,
                    color: activeTab === id ? '#1a1a1a' : '#999',
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: activeTab === id ? '2px solid #1a1a1a' : '2px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  {id === 'shipment' ? '쉽먼트' : '정산'}
                </button>
              ))}
            </nav>
            {activeTab === 'shipment' && fileName && (
              <span style={{ fontSize: 11, color: '#999', background: '#f5f5f5', padding: '3px 10px', borderRadius: 20 }}>
                {fileName}
              </span>
            )}
          </div>
          {activeTab === 'shipment' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setShowSenderManager(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                  fontSize: 12, color: '#666', background: 'none',
                  border: '1px solid #e5e5e5', borderRadius: 8, cursor: 'pointer',
                }}
              >
                📮 보내는사람 설정
              </button>
              <button
                onClick={() => setShowAddressManager(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                  fontSize: 12, color: '#666', background: 'none',
                  border: '1px solid #e5e5e5', borderRadius: 8, cursor: 'pointer',
                }}
              >
                🗺️ 택배주소 관리
              </button>
            </div>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 1600, margin: '0 auto', padding: '20px 24px' }}>
        {activeTab === 'settlement' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
            <span style={{ fontSize: 32 }}>🧾</span>
            <p style={{ fontSize: 15, color: '#aaa', margin: 0 }}>정산 기능 준비 중입니다</p>
          </div>
        )}

        {activeTab === 'shipment' && (
          <div>
            {!hasData && (
              <div style={{ marginBottom: 20 }}>
                <FileUpload onFile={handleFile} loading={loading} />
              </div>
            )}

            {error && (
              <div style={{ background: '#fff0f0', border: '1px solid #ffcccc', color: '#c0392b', fontSize: 13, padding: '10px 16px', borderRadius: 8, marginBottom: 14 }}>
                {error}
              </div>
            )}

            {!hasData && !loading && !error && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <p style={{ fontSize: 13, color: '#aaa', marginBottom: 10 }}>쉼먼트 열 입력 예시</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
                  {['롯데 → 롯데택배 1건', '롯데2 → 롯데택배 2건', '메모에 예약 → 예약 패널로 이동'].map(hint => (
                    <span key={hint} style={{ fontSize: 12, background: '#f5f5f5', color: '#666', padding: '5px 12px', borderRadius: 20 }}>{hint}</span>
                  ))}
                </div>
              </div>
            )}

            {hasData && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={handleReset} style={btnStyle('#fff', '#e5e5e5', '#555')}>
                    ↩ 새 파일
                  </button>
                  <span style={{ fontSize: 11, color: '#ccc' }}>
                    발송 {leftItemCount}건 / 예약 {rightItemCount}건
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={handlePullReservations}
                    disabled={!hasPendingReservations}
                    title="메모 칸에 &quot;예약&quot;이라고 적은 항목들을 오른쪽 예약 패널로 옮깁니다."
                    style={{
                      ...btnStyle(
                        hasPendingReservations ? '#27ae60' : '#f5f5f5',
                        hasPendingReservations ? '#27ae60' : '#f5f5f5',
                        hasPendingReservations ? '#fff' : '#bbb'
                      ),
                      cursor: hasPendingReservations ? 'pointer' : 'not-allowed',
                      fontWeight: 600,
                      position: 'relative',
                    }}
                  >
                    ▶ 예약 불러오기
                    {hasPendingReservations && (
                      <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#ff5f5f', marginLeft: 6, verticalAlign: 'middle' }} />
                    )}
                  </button>

                  <button
                    onClick={() => exportSummaryExcel(leftRows)}
                    title="현재 발송 목록 전체를 엑셀 파일(발주서정리_날짜.xlsx)로 저장합니다."
                    style={btnStyle('#f5f5f5', '#e5e5e5', '#333')}
                  >
                    ↓ 발주서정리 저장
                  </button>

                  <button
                    onClick={() => exportLotteExcel(allRows, addresses, sender)}
                    disabled={lotteCount === 0}
                    title="쉼먼트 칸에 &quot;롯데&quot;라고 적은 항목만 모아 롯데택배 업로드용 엑셀을 만듭니다."
                    style={{
                      ...btnStyle(
                        lotteCount > 0 ? '#e67e22' : '#f5f5f5',
                        lotteCount > 0 ? '#e67e22' : '#f5f5f5',
                        lotteCount > 0 ? '#fff' : '#bbb'
                      ),
                      cursor: lotteCount > 0 ? 'pointer' : 'not-allowed',
                      fontWeight: 600,
                    }}
                  >
                    ↓ 롯데택배 Excel
                    {lotteCount > 0 && (
                      <span style={{ background: 'rgba(255,255,255,0.25)', padding: '1px 7px', borderRadius: 12, fontSize: 11, marginLeft: 4 }}>
                        {lotteCount}건
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {hasData && (
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '2px 10px', marginTop: -8, marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: '#bbb' }}>▶ 예약 불러오기 = 메모에 "예약" 적은 항목 이동</span>
                <span style={{ fontSize: 11, color: '#ddd' }}>·</span>
                <span style={{ fontSize: 11, color: '#bbb' }}>↓ 발주서정리 저장 = 발송 목록 엑셀 저장</span>
                <span style={{ fontSize: 11, color: '#ddd' }}>·</span>
                <span style={{ fontSize: 11, color: '#bbb' }}>↓ 롯데택배 Excel = "롯데" 표시 건만 엑셀 생성</span>
              </div>
            )}

            {hasData && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#c0392b', letterSpacing: '-0.2px' }}>📤 발송</span>
                    {leftItemCount > 0 && <span style={{ fontSize: 11, color: '#aaa' }}>{leftItemCount}건</span>}
                    {leftRows.length > 0 && (
                      <button
                        onClick={() => printPanel(leftRows, '발송', '#c0392b')}
                        style={printBtnStyle}
                        title="발송 패널 인쇄"
                      >
                        🖨 인쇄
                      </button>
                    )}
                  </div>
                  {leftRows.length > 0 ? (
                    <OrderTable
                      rows={leftRows}
                      onMemoChange={handleLeftMemoChange}
                      onShipmentChange={handleLeftShipmentChange}
                      colorScheme="pink"
                    />
                  ) : (
                    <div style={{ border: '1px dashed #e8e8e8', borderRadius: 10, padding: '48px 0', textAlign: 'center', color: '#ccc', fontSize: 13 }}>
                      발송 항목 없음
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#27ae60', letterSpacing: '-0.2px' }}>📅 예약</span>
                    {rightItemCount > 0 && <span style={{ fontSize: 11, color: '#aaa' }}>{rightItemCount}건</span>}
                    {rightRows.length > 0 && (
                      <button
                        onClick={() => printPanel(rightRows, '예약', '#27ae60')}
                        style={printBtnStyle}
                        title="예약 패널 인쇄"
                      >
                        🖨 인쇄
                      </button>
                    )}
                    {rightRows.length > 0 && (
                      <button
                        onClick={handleCancelReservations}
                        style={{
                          marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '4px 10px', fontSize: 11, color: '#999',
                          background: '#fff', border: '1px solid #e0e0e0',
                          borderRadius: 6, cursor: 'pointer',
                        }}
                        title="예약 전체를 발송 패널로 되돌립니다"
                      >
                        ↩ 예약 취소
                      </button>
                    )}
                  </div>
                  {rightRows.length > 0 ? (
                    <OrderTable
                      rows={rightRows}
                      onMemoChange={() => {}}
                      onShipmentChange={handleRightShipmentChange}
                      colorScheme="green"
                      readOnly={false}
                    />
                  ) : (
                    <div style={{
                      border: '1px dashed #b7e0c7', borderRadius: 10,
                      padding: '48px 0', textAlign: 'center', color: '#b0d8c0', fontSize: 13,
                    }}>
                      메모에 <strong style={{ color: '#27ae60' }}>예약</strong> 입력 후<br />
                      <span style={{ fontSize: 12 }}>예약 불러오기를 눌러주세요</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {showAddressManager && (
        <AddressManager
          addresses={addresses}
          onUpdate={handleAddressUpdate}
          onClose={() => setShowAddressManager(false)}
        />
      )}

      {showSenderManager && (
        <SenderManager
          sender={sender}
          onUpdate={handleSenderUpdate}
          onClose={() => setShowSenderManager(false)}
        />
      )}
    </div>
  );
}

function btnStyle(bg: string, border: string, color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '7px 14px', fontSize: 13, color,
    background: bg, border: `1px solid ${border}`,
    borderRadius: 8, cursor: 'pointer', fontWeight: 500,
  };
}

const printBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '3px 9px', fontSize: 11, color: '#777',
  background: '#fff', border: '1px solid #e0e0e0',
  borderRadius: 6, cursor: 'pointer',
};
