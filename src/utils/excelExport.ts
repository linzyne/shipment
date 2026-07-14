import * as XLSX from 'xlsx';
import type { DisplayRow } from './dataProcessor';
import type { AddressEntry, LotteRow } from '../types';
import { formatDateDisplay } from './dateUtils';

// 셀을 텍스트 타입으로 강제 설정 (전화번호/우편번호 앞자리 0 보존)
function forceTextCols(ws: XLSX.WorkSheet, rowCount: number, colIndexes: number[]) {
  for (let r = 1; r <= rowCount; r++) {
    for (const c of colIndexes) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (ws[addr]) {
        ws[addr].t = 's';
        ws[addr].v = String(ws[addr].v ?? '');
        delete ws[addr].w;
      }
    }
  }
}

export function exportLotteExcel(displayRows: DisplayRow[], addresses: AddressEntry[]): void {
  const addrMap = new Map<string, AddressEntry>();
  addresses.forEach(a => addrMap.set(a.key.trim(), a));

  const toWrite: LotteRow[] = [];
  let nextNo = 1;

  for (const row of displayRows) {
    if (row.isBlank) continue;
    // _물류센터 사용: 같은 그룹의 두 번째 이후 행도 물류센터 인식
    const center   = (row._물류센터 || row.물류센터).trim();
    const shipment = row.쉼먼트.trim();
    if (!shipment || !center) continue;
    const m = shipment.match(/^롯데(\d+)?$/);
    if (!m) continue;

    const count = m[1] ? Math.max(1, Number(m[1])) : 1;
    const info  = addrMap.get(center) ?? { phone: '', zip: '', addr1: '', addr2: '', key: center };
    const fullAddr = info.addr2 ? `${info.addr1} ${info.addr2}` : info.addr1;

    for (let i = 0; i < count; i++) {
      toWrite.push({
        주문번호: nextNo++,
        받는사람: center,
        전화번호1: info.phone,
        우편번호: info.zip,
        주소: fullAddr,
        상품명1: center,
      });
    }
  }

  if (toWrite.length === 0) {
    alert('롯데 택배 예약 데이터가 없습니다.\n쉼먼트 열에 "롯데" 또는 "롯데N"을 입력하세요.');
    return;
  }

  // 롯데택배 양식 헤더 (A~O, 15열)
  const headers = [
    '주문번호',          // A
    '보내는사람(지정)',   // B
    '전화번호1(지정)',    // C
    '전화번호2(지정)',    // D
    '우편번호(지정)',     // E
    '주소(지정)',         // F
    '받는사람',           // G
    '전화번호1',          // H
    '전화번호2',          // I
    '우편번호',           // J
    '주소',               // K
    '상품명1',            // L
    '상품상세1',          // M
    '수량(A타입)',        // N
    '배송메시지',         // O
  ];
  const ws_data: unknown[][] = [headers];

  for (const r of toWrite) {
    const row = new Array(15).fill('');
    row[0]  = r.주문번호;   // A: 주문번호
    row[6]  = r.받는사람;   // G: 받는사람
    row[7]  = r.전화번호1;  // H: 전화번호1
    row[9]  = r.우편번호;   // J: 우편번호
    row[10] = r.주소;        // K: 주소
    row[11] = r.상품명1;    // L: 상품명1
    ws_data.push(row);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);

  // 전화번호(H=7), 우편번호(J=9) 앞자리 0 보존
  forceTextCols(ws, toWrite.length, [7, 9]);

  XLSX.utils.book_append_sheet(wb, ws, '롯데택배');
  XLSX.writeFile(wb, `롯데택배_${formatToday()}.xlsx`);
}

export function exportSummaryExcel(displayRows: DisplayRow[]): void {
  const headers = ['발주번호', '물류센터', '상품이름', '확정수량', '입고예정일', '메모', '쉼먼트'];
  const ws_data: unknown[][] = [headers];

  for (const row of displayRows) {
    if (row.isBlank) {
      ws_data.push(['', '', '', '', '', '', '']);
      continue;
    }
    ws_data.push([
      row._발주번호 || row.발주번호,
      row._물류센터 || row.물류센터,
      row.상품이름,
      row.확정수량,
      formatDateDisplay(row.입고예정일),
      row.메모,
      row.쉼먼트,
    ]);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  XLSX.utils.book_append_sheet(wb, ws, '발주서정리');
  XLSX.writeFile(wb, `발주서정리_${formatToday()}.xlsx`);
}

function formatToday(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
