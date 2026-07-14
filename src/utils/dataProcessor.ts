import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { OrderRow } from '../types';
import { normalizeDateValue, dateKeyYMD, ymdSortKey } from './dateUtils';

function parseNumber(v: unknown): number {
  if (v === null || v === '') return NaN;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

function readTableByHeader(rawData: unknown[][]): Record<string, unknown>[] {
  if (rawData.length < 1) return [];
  const headers = (rawData[0] as unknown[]).map(h => String(h ?? '').trim());
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i] as unknown[];
    if (row.every(v => v === '' || v == null)) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => { obj[h] = row[idx]; });
    rows.push(obj);
  }
  return rows;
}

export function parseFile(file: File): Promise<OrderRow[]> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const result = Papa.parse(text, { header: false, skipEmptyLines: false });
        resolve(mapRawToOrderRows(result.data as unknown[][]));
      };
      reader.onerror = reject;
      reader.readAsText(file, 'utf-8');
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
        resolve(mapRawToOrderRows(raw));
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    }
  });
}

function mapRawToOrderRows(rawData: unknown[][]): OrderRow[] {
  const data = readTableByHeader(rawData);
  let rows: OrderRow[] = data.map(r => {
    const orderNo = r['Order number'] ?? r['발주번호'] ?? '';
    const center  = r['FC(RC)'] ?? r['물류센터'] ?? '';
    const pName   = r['Product Name'] ?? r['상품이름'] ?? '';
    const qty     = r['Confirmed Quantity'] ?? r['확정수량'] ?? 0;
    const pDate   = r['Receiving Date'] ?? r['입고예정일'] ?? r['Expected Receiving Date'] ?? '';

    const parsedQty = parseNumber(qty);
    return {
      발주번호: String(orderNo).trim(),
      물류센터: String(center).trim(),
      상품이름: String(pName).trim(),
      확정수량: Number.isFinite(parsedQty) ? parsedQty : '',
      입고예정일: normalizeDateValue(pDate),
      메모: '',
      쉼먼트: '',
    };
  });

  rows = rows.filter(x => Number(x.확정수량) > 0);

  rows.sort((a, b) => {
    const da = ymdSortKey(a.입고예정일);
    const db = ymdSortKey(b.입고예정일);
    if (da !== db) return da - db;
    const kc = a.물류센터.localeCompare(b.물류센터, 'ko', { numeric: true });
    if (kc !== 0) return kc;
    const ko = a.발주번호.localeCompare(b.발주번호, 'ko', { numeric: true });
    if (ko !== 0) return ko;
    return a.상품이름.localeCompare(b.상품이름, 'ko', { numeric: true });
  });

  return rows;
}

export interface DisplayRow {
  id: string;
  발주번호: string;
  물류센터: string;
  상품이름: string;
  확정수량: number | '';
  입고예정일: Date | string;
  메모: string;
  쉼먼트: string;
  isBlank: boolean;
  groupKey: string;
  // 원본 전체 값 (abbreviated 되지 않은 값, 데이터 조작용)
  _발주번호: string;
  _물류센터: string;
  _입고예정일: Date | string;
}

export function buildDisplayRows(rows: OrderRow[]): DisplayRow[] {
  const display: DisplayRow[] = [];
  let prevCenterDateKey = '';
  let prevOrderNo = '';
  let idx = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const ymd = dateKeyYMD(r.입고예정일);
    const centerDateKey = `${r.물류센터}|${ymd}`;

    if (prevCenterDateKey && centerDateKey !== prevCenterDateKey) {
      display.push({
        id: `blank-${idx++}`,
        발주번호: '', 물류센터: '', 상품이름: '', 확정수량: '',
        입고예정일: '', 메모: '', 쉼먼트: '',
        isBlank: true, groupKey: '',
        _발주번호: '', _물류센터: '', _입고예정일: '',
      });
    }

    const isFirst = centerDateKey !== prevCenterDateKey;
    display.push({
      id: `row-${idx++}`,
      발주번호: prevOrderNo === r.발주번호 && !isFirst ? '' : r.발주번호,
      물류센터: isFirst ? r.물류센터 : '',
      상품이름: r.상품이름,
      확정수량: r.확정수량,
      입고예정일: isFirst ? r.입고예정일 : '',
      메모: r.메모,
      쉼먼트: r.쉼먼트,
      isBlank: false,
      groupKey: centerDateKey,
      _발주번호: r.발주번호,
      _물류센터: r.물류센터,
      _입고예정일: r.입고예정일,
    });

    prevCenterDateKey = centerDateKey;
    prevOrderNo = r.발주번호;
  }

  return display;
}

// displayRows → 논리적 OrderRow[] 복원 (abbreviated 값 복구)
export function extractOrderRows(displayRows: DisplayRow[]): OrderRow[] {
  return displayRows
    .filter(r => !r.isBlank)
    .map(r => ({
      발주번호: r._발주번호,
      물류센터: r._물류센터,
      상품이름: r.상품이름,
      확정수량: r.확정수량,
      입고예정일: r._입고예정일,
      메모: r.메모,
      쉼먼트: r.쉼먼트,
    }));
}

// 메모에 "예약"이 표시된 행만 개별 분리
export function splitByReservation(displayRows: DisplayRow[]): {
  normalRows: OrderRow[];
  reservedRows: OrderRow[];
} {
  const normalRows: OrderRow[] = [];
  const reservedRows: OrderRow[] = [];

  for (const row of displayRows) {
    if (row.isBlank) continue;
    const orderRow: OrderRow = {
      발주번호: row._발주번호,
      물류센터: row._물류센터,
      상품이름: row.상품이름,
      확정수량: row.확정수량,
      입고예정일: row._입고예정일,
      메모: row.메모,
      쉼먼트: row.쉼먼트,
    };
    if (row.메모.includes('예약') || row.쉼먼트.includes('예약')) {
      reservedRows.push(orderRow);
    } else {
      normalRows.push(orderRow);
    }
  }

  return { normalRows, reservedRows };
}
