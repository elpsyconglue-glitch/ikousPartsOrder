import React, { useState, useRef } from 'react';
import { PartHistory } from '../types';
import ProtectedActionModal from './ProtectedActionModal';
import { 
  parsePartHistoriesFromFile, 
  savePartHistories, 
  exportPartHistoriesToExcel, 
  exportPartHistoriesToCsv 
} from '../utils/csvHelper';
import { Upload, Download, RotateCcw, Database, AlertCircle, CheckCircle, FileSpreadsheet, FileText } from 'lucide-react';

interface CsvManagerProps {
  histories: PartHistory[];
  onHistoriesChange: (newHistories: PartHistory[]) => void;
}

export default function CsvManager({ histories, onHistoriesChange }: CsvManagerProps) {
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info' | null; message: string }>({ type: null, message: '' });
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [showClearModal, setShowClearModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    const isCsv = fileName.endsWith('.csv');

    if (!isExcel && !isCsv) {
      setStatus({ type: 'error', message: 'Excelファイル（.xlsx, .xls）またはCSVファイル（.csv）を選択してください。' });
      return;
    }

    try {
      setStatus({ type: 'info', message: `${isExcel ? 'Excel' : 'CSV'}ファイルを解析中...` });
      const parsed = await parsePartHistoriesFromFile(file);

      if (parsed.length === 0) {
        setStatus({ type: 'error', message: '有効な部品データが検出されませんでした。1行目に「品名」などの見出し列が含まれているか確認してください。' });
        return;
      }

      let updatedHistories: PartHistory[] = [];
      if (importMode === 'replace') {
        updatedHistories = parsed;
        setStatus({ type: 'success', message: `データベースを上書き登録しました。合計${parsed.length}件のデータを取り込みました。` });
      } else {
        // 重複排除（同じ船名、機器名、品名、部品番号の組み合わせがあればスキップ）
        const existingKeys = new Set(histories.map(h => `${h.shipName}-${h.equipmentName}-${h.partName}-${h.partNumber}`));
        const uniqueNew = parsed.filter(p => !existingKeys.has(`${p.shipName}-${p.equipmentName}-${p.partName}-${p.partNumber}`));
        
        updatedHistories = [...histories, ...uniqueNew];
        setStatus({
          type: 'success',
          message: `データベースに${uniqueNew.length}件の新規データを取り込みました。(重複 ${parsed.length - uniqueNew.length} 件をスキップ)`
        });
      }

      savePartHistories(updatedHistories);
      onHistoriesChange(updatedHistories);
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: `解析エラー: ${err.message || 'ファイルが壊れているか、フォーマットが不完全です。'}` });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleExportExcel = () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      exportPartHistoriesToExcel(histories, `部品発注履歴データベース_${today}.xlsx`);
      setStatus({ type: 'success', message: 'データベースをExcelファイル (.xlsx) として書き出しました。' });
    } catch (err) {
      setStatus({ type: 'error', message: 'Excelエクスポート中にエラーが発生しました。' });
    }
  };

  const handleExportCsv = () => {
    try {
      const csvContent = exportPartHistoriesToCsv(histories);
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `部品発注履歴データベース_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setStatus({ type: 'success', message: 'データベースをCSVファイルとして書き出しました。' });
    } catch (err) {
      setStatus({ type: 'error', message: 'CSVエクスポート中にエラーが発生しました。' });
    }
  };

  const handleClear = () => {
    setShowClearModal(true);
  };

  const executeClear = () => {
    savePartHistories([]);
    onHistoriesChange([]);
    setStatus({ type: 'success', message: 'データベースを全削除して初期化クリアしました。' });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-indigo-600" />
          <h2 className="font-semibold text-slate-800 text-lg">部品発注履歴データベース管理</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
            登録数: {histories.length} 件
          </span>
        </div>
      </div>

      <div className="p-6">
        <p className="text-sm text-slate-500 mb-4 leading-relaxed">
          品名を入力した際の自動補完（船名、機器名、メーカー、形式、規格、単位、単価）は、このデータベースに基づいて動作します。
          既存の<strong className="text-slate-700">Excelファイル (.xlsx / .xls)</strong>や<strong className="text-slate-700">CSVファイル (.csv)</strong>を取り込んでデータベース化できます。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 左・中央：Excel / CSV ドラッグ＆ドロップ */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-4 mb-3">
              <label className="text-xs font-semibold text-slate-700">インポート設定:</label>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center text-xs text-slate-600 cursor-pointer">
                  <input
                    type="radio"
                    className="mr-1.5 h-3.5 w-3.5 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                  />
                  既存データに追加する
                </label>
                <label className="inline-flex items-center text-xs text-slate-600 cursor-pointer">
                  <input
                    type="radio"
                    className="mr-1.5 h-3.5 w-3.5 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                  />
                  既存データを上書き（全消去して置換）
                </label>
              </div>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={handleButtonClick}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-50/50'
                  : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/50'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx, .xls, .csv"
                className="hidden"
              />
              <Upload className="mx-auto h-8 w-8 text-indigo-500 mb-2" />
              <p className="text-sm font-bold text-slate-700">
                ここにExcel (.xlsx / .xls) または CSV (.csv) ファイルをドラッグ＆ドロップ
              </p>
              <p className="text-xs text-slate-500 mt-1">
                またはクリックしてパソコンからファイルを選択
              </p>
              <p className="text-[11px] text-slate-400 mt-2 bg-slate-100/70 py-1 px-2 rounded inline-block">
                対応列名: 「船名」「機器名」「発注先メーカー」「形式」「品名」「部品番号」「単位」「単価」
              </p>
            </div>
          </div>

          {/* 右：エクスポート・クリア操作 */}
          <div className="flex flex-col justify-between border border-slate-100 rounded-lg p-4 bg-slate-50/50">
            <h3 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              データの書き出し・管理
            </h3>
            
            <div className="space-y-2 flex-1">
              <button
                type="button"
                onClick={handleExportExcel}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors shadow-sm cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                Excel形式 (.xlsx) で書き出し
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                CSV形式 (.csv) で書き出し
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-100 rounded-md hover:bg-rose-100 transition-colors shadow-sm cursor-pointer mt-2"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                データベースを全クリア
              </button>
            </div>

            <div className="text-[10px] text-slate-400 mt-3 leading-normal">
              ※バックアップとしてExcelやCSV形式で保存しておくと安心です。
            </div>
          </div>
        </div>

        {/* ステータス表示 */}
        {status.type && (
          <div className={`mt-4 p-3 rounded-md flex items-start gap-2 text-sm ${
            status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' :
            status.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-100' :
            'bg-indigo-50 text-indigo-800 border border-indigo-100'
          }`}>
            {status.type === 'success' && <CheckCircle className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />}
            {status.type === 'error' && <AlertCircle className="h-4.5 w-4.5 text-rose-600 shrink-0 mt-0.5" />}
            {status.type === 'info' && <Database className="h-4.5 w-4.5 text-indigo-600 shrink-0 mt-0.5 animate-pulse" />}
            <span className="font-medium">{status.message}</span>
          </div>
        )}
      </div>

      {/* 2段階確認用パスワード保護モーダル */}
      <ProtectedActionModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onSuccess={executeClear}
        title="発注履歴データベースの全消去"
        description="登録されているすべての部品発注履歴・自動学習データを全削除します。"
        actionButtonText="データベースを全削除する"
        actionButtonColor="rose"
      />
    </div>
  );
}
