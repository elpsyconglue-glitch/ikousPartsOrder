import React, { useState } from 'react';
import { Ship, Plus, Trash2, X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { saveShipNames } from '../utils/shipHelper';

interface ShipManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipNames: string[];
  onShipNamesChange: (newShipNames: string[]) => void;
}

export default function ShipManagementModal({
  isOpen,
  onClose,
  shipNames,
  onShipNamesChange,
}: ShipManagementModalProps) {
  const [newShipInput, setNewShipInput] = useState('');
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // 新規船の追加処理
  const handleAddShip = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newShipInput.trim();
    if (!trimmed) {
      setErrorMsg('船名を入力してください。');
      return;
    }

    if (shipNames.includes(trimmed)) {
      setErrorMsg(`「${trimmed}」は既に登録されています。`);
      return;
    }

    const updated = [...shipNames, trimmed];
    saveShipNames(updated);
    onShipNamesChange(updated);
    setNewShipInput('');
    setErrorMsg(null);
    setNoticeMsg(`船名「${trimmed}」を新たに追加・登録しました。`);
    setTimeout(() => setNoticeMsg(null), 3500);
  };

  // 船の削除（管理終了）処理
  const handleDeleteShip = (shipName: string) => {
    if (shipNames.length <= 1) {
      alert('船名は少なくとも1船以上必要です。');
      return;
    }

    if (confirm(`船「${shipName}」を管理対象リストから除外しますか？\n（※過去に登録された発注履歴データ自体は保持されます）`)) {
      const updated = shipNames.filter(name => name !== shipName);
      saveShipNames(updated);
      onShipNamesChange(updated);
      setErrorMsg(null);
      setNoticeMsg(`「${shipName}」を管理リストから削除しました。`);
      setTimeout(() => setNoticeMsg(null), 3500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
        
        {/* モーダルヘッダー */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/30 text-indigo-300 rounded-xl border border-indigo-500/30">
              <Ship className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                管理船舶リストの設定（追加・削除）
              </h2>
              <p className="text-xs text-slate-300">
                管理対象の船舶を追加・管理終了した船を削除できます
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* コンテンツメイン */}
        <div className="p-6 space-y-5">

          {/* 通知エリア */}
          {noticeMsg && (
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{noticeMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs text-rose-800 font-semibold flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 新規船追加フォーム */}
          <form onSubmit={handleAddShip} className="bg-slate-50 border border-indigo-100 p-4 rounded-xl space-y-3">
            <label className="block text-xs font-bold text-slate-700">
              新しい管理船舶の追加登録
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="例: 第18興洋丸、あさしお"
                value={newShipInput}
                onChange={e => setNewShipInput(e.target.value)}
                className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>船を追加</span>
              </button>
            </div>
          </form>

          {/* 船名一覧リスト */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-700">
                現在登録中の船舶一覧 ({shipNames.length}隻)
              </h3>
              <span className="text-[11px] text-slate-500">
                ※削除すると発注画面の選択肢からも除外されます
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[260px] overflow-y-auto divide-y divide-slate-100 bg-white">
              {shipNames.map((name, index) => (
                <div key={name} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-mono text-slate-400 w-5 text-right">
                      {index + 1}.
                    </span>
                    <Ship className="h-4 w-4 text-indigo-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-800">
                      {name}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDeleteShip(name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-medium"
                    title="この船を管理リストから削除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>管理終了 (削除)</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 説明・注意書き */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-900 flex gap-2">
            <Info className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              ここで追加・削除した船名は、「船別・予算発注履歴」画面および「発注書作成」画面の船名選択ドロップダウンメニューに即時反映されます。
            </p>
          </div>

        </div>

        {/* モーダルフッター */}
        <div className="bg-slate-100 px-6 py-3 text-right border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>

      </div>
    </div>
  );
}
