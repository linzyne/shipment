import { useState } from 'react';
import type { AddressEntry } from '../types';

interface Props {
  addresses: AddressEntry[];
  onUpdate: (addresses: AddressEntry[]) => void;
  onClose: () => void;
}

export default function AddressManager({ addresses, onUpdate, onClose }: Props) {
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState('');
  const [editList, setEditList] = useState<AddressEntry[]>(addresses);

  const handleParse = () => {
    setError('');
    const lines = pasteText.trim().split('\n').filter(l => l.trim());
    const parsed: AddressEntry[] = [];

    for (const line of lines) {
      // 탭 구분자 우선, 공백 fallback
      const parts = line.includes('\t') ? line.split('\t') : line.split(/\s{2,}/);
      if (parts.length < 2) continue;
      const entry: AddressEntry = {
        key:   parts[0]?.trim() || '',
        addr1: parts[1]?.trim() || '',
        addr2: parts[2]?.trim() || '',
        phone: parts[3]?.trim() || '',
        zip:   parts[4]?.trim() || '',
      };
      if (entry.key) parsed.push(entry);
    }

    if (parsed.length === 0) {
      setError('파싱된 데이터가 없습니다. 탭으로 구분된 형식인지 확인하세요.');
      return;
    }

    // 중복 key는 덮어씌우기
    const merged = [...editList];
    for (const p of parsed) {
      const idx = merged.findIndex(a => a.key === p.key);
      if (idx >= 0) merged[idx] = p;
      else merged.push(p);
    }
    setEditList(merged);
    setPasteText('');
  };

  const handleDelete = (key: string) => {
    setEditList(prev => prev.filter(a => a.key !== key));
  };

  const handleSave = () => {
    onUpdate(editList);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">택배주소 관리</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* 붙여넣기 추가 */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">
              스프레드시트에서 복사한 내용을 붙여넣으세요 (A~E열: 물류센터, 주소1, 주소2, 전화번호, 우편번호)
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              rows={4}
              placeholder={'고양1\t경기도 고양시 덕양구 권율대로 570\t쿠팡 고양1 물류센터 3번 Gate\t070-7730-9778\t10550'}
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            <button
              onClick={handleParse}
              disabled={!pasteText.trim()}
              className="mt-2 px-4 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-medium rounded-lg transition-colors"
            >
              추가/업데이트
            </button>
          </div>

          {/* 현재 주소 목록 */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">등록된 주소 ({editList.length}개)</p>
            <div className="space-y-1.5">
              {editList.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">등록된 주소가 없습니다.</p>
              )}
              {editList.map(a => (
                <div key={a.key} className="flex items-start gap-3 bg-gray-50 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-gray-800">{a.key}</span>
                    <span className="text-xs text-gray-500 ml-2">{a.addr1} {a.addr2}</span>
                    <span className="text-xs text-gray-400 ml-2">{a.phone}</span>
                    <span className="text-xs text-gray-400 ml-1">({a.zip})</span>
                  </div>
                  <button
                    onClick={() => handleDelete(a.key)}
                    className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium rounded-lg transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
