import React, { useState, useEffect } from 'react';
import { PriceRevisionDoc } from '../types';
import { 
  getPriceRevisionDocs, 
  savePriceRevisionDocs, 
  fileToDataUrl 
} from '../utils/priceRevisionHelper';
import { 
  X, 
  FileText, 
  UploadCloud, 
  Trash2, 
  Download, 
  ExternalLink, 
  Search, 
  Plus, 
  Building2, 
  Calendar, 
  Eye,
  FileCheck
} from 'lucide-react';

interface PriceRevisionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PriceRevisionModal({ isOpen, onClose }: PriceRevisionModalProps) {
  const [docs, setDocs] = useState<PriceRevisionDoc[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [viewingDoc, setViewingDoc] = useState<PriceRevisionDoc | null>(null);

  // フォーム用入力値
  const [title, setTitle] = useState<string>('');
  const [manufacturer, setManufacturer] = useState<string>('');
  const [effectiveDate, setEffectiveDate] = useState<string>('');
  const [remark, setRemark] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // 初回マウント＆開いた時にデータ読み込み
  useEffect(() => {
    if (isOpen) {
      const loaded = getPriceRevisionDocs();
      setDocs(loaded);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ファイル選択ハンドラ
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        alert('PDFファイル（.pdf）を選択してください。');
        return;
      }
      setSelectedFile(file);
      // タイトルが未入力ならファイル名（拡張子除く）をデフォルト挿入
      if (!title) {
        const defaultTitle = file.name.replace(/\.pdf$/i, '');
        setTitle(defaultTitle);
      }
    }
  };

  // ドロップハンドラ
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type !== 'application/pdf') {
        alert('PDFファイル（.pdf）を選択してください。');
        return;
      }
      setSelectedFile(file);
      if (!title) {
        const defaultTitle = file.name.replace(/\.pdf$/i, '');
        setTitle(defaultTitle);
      }
    }
  };

  // PDF保存処理
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('PDFファイルを選択してください。');
      return;
    }
    if (!title.trim()) {
      alert('タイトルを入力してください（例：阪神価格改定）。');
      return;
    }

    try {
      setIsUploading(true);
      const dataUrl = await fileToDataUrl(selectedFile);

      const newDoc: PriceRevisionDoc = {
        id: `rev-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        title: title.trim(),
        manufacturer: manufacturer.trim() || 'メーカー未指定',
        effectiveDate: effectiveDate || new Date().toISOString().split('T')[0],
        fileName: selectedFile.name,
        fileDataUrl: dataUrl,
        fileSize: selectedFile.size,
        updatedAt: new Date().toLocaleDateString('ja-JP'),
        remark: remark.trim()
      };

      const updated = [newDoc, ...docs];
      setDocs(updated);
      savePriceRevisionDocs(updated);

      // リセット
      setTitle('');
      setManufacturer('');
      setEffectiveDate('');
      setRemark('');
      setSelectedFile(null);
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
      alert('ファイルの読み込みに失敗しました。');
    } finally {
      setIsUploading(false);
    }
  };

  // 削除処理
  const handleDelete = (id: string, docTitle: string) => {
    if (window.confirm(`「${docTitle}」を削除してもよろしいですか？`)) {
      const updated = docs.filter(d => d.id !== id);
      setDocs(updated);
      savePriceRevisionDocs(updated);
      if (viewingDoc?.id === id) {
        setViewingDoc(null);
      }
    }
  };

  // 検索フィルター
  const filteredDocs = docs.filter(d => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      d.title.toLowerCase().includes(q) ||
      d.manufacturer.toLowerCase().includes(q) ||
      (d.remark && d.remark.toLowerCase().includes(q)) ||
      d.fileName.toLowerCase().includes(q)
    );
  });

  // バイト数フォーマット
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* ヘッダー */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-300 border border-indigo-400/30">
              <FileCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                メーカー価格改定PDF資料
                <span className="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full font-normal">
                  {docs.length}件保管中
                </span>
              </h2>
              <p className="text-xs text-slate-300">各メーカーから届いた価格改定PDFを保管し、すぐに参照できます</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* メインコンテンツ */}
        <div className="p-6 overflow-y-auto space-y-6 grow bg-slate-50/50">

          {/* 検索・アクションバー */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="タイトルやメーカー名で検索 (例: 阪神, ヤンマー)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
              />
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors shadow-sm cursor-pointer shrink-0"
            >
              <Plus className="h-4 w-4" />
              {showAddForm ? 'フォームを閉じる' : '新規PDFを登録'}
            </button>
          </div>

          {/* PDF追加フォーム */}
          {showAddForm && (
            <form onSubmit={handleAddSubmit} className="bg-white p-5 rounded-xl border-2 border-indigo-100 shadow-md space-y-4 animate-fadeIn">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <UploadCloud className="h-4 w-4 text-indigo-600" />
                価格改定PDFの新規登録
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    タイトル <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="例: 阪神価格改定"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    メーカー名 (発注先)
                  </label>
                  <input
                    type="text"
                    placeholder="例: 阪神内燃機工業, ヤンマー"
                    value={manufacturer}
                    onChange={e => setManufacturer(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    改定・適用年月
                  </label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={e => setEffectiveDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  備考・改定概要メモ
                </label>
                <input
                  type="text"
                  placeholder="例: 主機関部品一律5%値上げ、潤滑油関連は対象外"
                  value={remark}
                  onChange={e => setRemark(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* PDFファイルアップロード枠 */}
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
                  selectedFile ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-300 hover:border-indigo-400 bg-slate-50'
                }`}
              >
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="pdf-file-input"
                />
                <label htmlFor="pdf-file-input" className="cursor-pointer block">
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-700">
                      <FileText className="h-6 w-6 text-emerald-600 shrink-0" />
                      <div className="text-left">
                        <p className="text-xs font-bold">{selectedFile.name}</p>
                        <p className="text-[10px] text-emerald-600">
                          {formatFileSize(selectedFile.size)} - 変更する場合はクリック
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <UploadCloud className="h-7 w-7 mx-auto text-slate-400" />
                      <p className="text-xs font-semibold text-slate-700">
                        ここにPDFファイルをドラッグ＆ドロップ、またはクリックして選択
                      </p>
                      <p className="text-[10px] text-slate-400">PDF形式のみ対応</p>
                    </div>
                  )}
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !selectedFile}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 rounded-lg transition-colors cursor-pointer shadow-sm"
                >
                  {isUploading ? '保存中...' : '登録して保存'}
                </button>
              </div>
            </form>
          )}

          {/* 登録済みPDFリスト */}
          {filteredDocs.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-xl border border-slate-200">
              <FileText className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-600">価格改定PDFが登録されていません</p>
              <p className="text-xs text-slate-400 mt-1">
                「新規PDFを登録」ボタンから各メーカーの価格改定資料を追加してください。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDocs.map(doc => (
                <div
                  key={doc.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col justify-between"
                >
                  <div>
                    {/* カード上部: タイトル ＆ メーカー */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="p-2 bg-rose-50 text-rose-600 rounded-lg shrink-0">
                          <FileText className="h-5 w-5" />
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 leading-snug">
                            {doc.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="flex items-center gap-1 font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              <Building2 className="h-3 w-3 text-slate-400" />
                              {doc.manufacturer}
                            </span>
                            {doc.effectiveDate && (
                              <span className="flex items-center gap-1 text-slate-500">
                                <Calendar className="h-3 w-3 text-slate-400" />
                                適用: {doc.effectiveDate}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 備考メモ */}
                    {doc.remark && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg my-2 border border-slate-100">
                        {doc.remark}
                      </p>
                    )}

                    {/* ファイルメタ情報 */}
                    <p className="text-[10px] text-slate-400 truncate mt-1">
                      📄 {doc.fileName} {doc.fileSize ? `(${formatFileSize(doc.fileSize)})` : ''} • 登録: {doc.updatedAt}
                    </p>
                  </div>

                  {/* アクションボタン群 */}
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 mt-3">
                    <button
                      onClick={() => setViewingDoc(doc)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      画面で閲覧
                    </button>

                    <div className="flex items-center gap-1">
                      <a
                        href={doc.fileDataUrl}
                        download={doc.fileName}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2 py-1.5 rounded-lg transition-colors"
                        title="PDFをダウンロード"
                      >
                        <Download className="h-3.5 w-3.5" />
                        保存
                      </a>
                      <a
                        href={doc.fileDataUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
                        title="別ウィンドウで開く"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        onClick={() => handleDelete(doc.id, doc.title)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="削除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* フッター */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>💡 登録した資料はブラウザ内に自動保管され、いつでも参照可能です。</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>

      {/* モーダル内 PDFインライン表示プレビューダイアログ */}
      {viewingDoc && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-rose-400" />
                <span className="font-bold text-sm">{viewingDoc.title}</span>
                <span className="text-xs text-slate-300">（{viewingDoc.manufacturer}）</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={viewingDoc.fileDataUrl}
                  download={viewingDoc.fileName}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1"
                >
                  <Download className="h-3.5 w-3.5" />
                  保存
                </a>
                <button
                  onClick={() => setViewingDoc(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-800 p-2">
              <iframe
                src={viewingDoc.fileDataUrl}
                title={viewingDoc.title}
                className="w-full h-full rounded-lg border-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
