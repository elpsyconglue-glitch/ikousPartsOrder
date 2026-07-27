import React, { useState, useMemo } from 'react';
import { PartHistory, OrderCategory, ORDER_CATEGORY_TITLE_MAP } from '../types';
import { DEFAULT_SHIP_NAMES } from '../defaultData';
import { getFiscalYear, updateHistoryUnitPrice, savePartHistories, clearAllPartHistories } from '../utils/csvHelper';
import PriceRevisionModal from './PriceRevisionModal';
import ProtectedActionModal from './ProtectedActionModal';
import ShipManagementModal from './ShipManagementModal';
import { 
  Ship, 
  ChevronDown, 
  ChevronUp, 
  Printer, 
  Edit3, 
  Save, 
  Plus, 
  Trash2, 
  Search, 
  DollarSign, 
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  FileCheck,
  Settings
} from 'lucide-react';


interface BudgetManagerProps {
  histories: PartHistory[];
  onHistoriesChange: (newHistories: PartHistory[]) => void;
  shipNames?: string[];
  onShipNamesChange?: (newShipNames: string[]) => void;
}

export default function BudgetManager({
  histories,
  onHistoriesChange,
  shipNames = DEFAULT_SHIP_NAMES,
  onShipNamesChange
}: BudgetManagerProps) {
  const activeShipNames = shipNames && shipNames.length > 0 ? shipNames : DEFAULT_SHIP_NAMES;

  // 選択されている船（デフォルトは先頭の船）
  const [selectedShip, setSelectedShip] = useState<string>(activeShipNames[0]);
  const [showShipManagementModal, setShowShipManagementModal] = useState<boolean>(false);

  // 船リストが更新された際、現在選択中の船が削除されていれば最初の船に自動切り替え
  React.useEffect(() => {
    if (activeShipNames.length > 0 && !activeShipNames.includes(selectedShip)) {
      setSelectedShip(activeShipNames[0]);
    }
  }, [activeShipNames, selectedShip]);
  // 選択されている注文カテゴリ（デフォルトは '部品'）
  const [selectedCategory, setSelectedCategory] = useState<OrderCategory>('部品');
  // 選択されている年度（'ALL' または年度数例 2026）
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  // 選択されている月（'ALL' または '1'~'12'）
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');

  // 編集中の行IDと一時保存値
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number | ''>('');
  const [editQty, setEditQty] = useState<number | ''>('');
  const [editRemark, setEditRemark] = useState<string>('');

  // 印刷モーダルの表示状態
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // 価格改定PDF資料モーダルの表示状態
  const [showPriceRevisionModal, setShowPriceRevisionModal] = useState<boolean>(false);

  // 全履歴クリア用保護モーダル
  const [showClearAllModal, setShowClearAllModal] = useState<boolean>(false);

  // 新規履歴の手動追加モーダル
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newItem, setNewItem] = useState<{
    equipmentName: string;
    partName: string;
    partNumber: string;
    manufacturer: string;
    model: string;
    quantity: number | '';
    unit: string;
    unitPrice: number | '';
    orderDate: string;
    remark: string;
  }>({
    equipmentName: '',
    partName: '',
    partNumber: '',
    manufacturer: '',
    model: '',
    quantity: 1,
    unit: '個',
    unitPrice: '',
    orderDate: new Date().toISOString().split('T')[0],
    remark: ''
  });

  // 船別・予算発注履歴の対象データ：発注日(orderDate)が存在する「実際の入力・発注実績レコード」のみを抽出
  // (※CSVインポートした未発注のパーツマスタデータは自動除外)
  const actualOrders = useMemo(() => {
    return histories.filter(h => Boolean(h.orderDate && h.orderDate.trim() !== ''));
  }, [histories]);

  // 保存されている全履歴から存在する「年度」のリストを抽出（現在の年度を含む）
  const availableYears = useMemo(() => {
    const currentFY = getFiscalYear();
    const yearsSet = new Set<number>([currentFY, currentFY - 1, currentFY - 2]);
    
    actualOrders.forEach(h => {
      if (h.orderDate) {
        yearsSet.add(getFiscalYear(h.orderDate));
      }
    });

    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [actualOrders]);

  // 管理船舶それぞれにおける「当年度の発注合計額」を算出（サマリー表示用）
  const shipSummaries = useMemo(() => {
    const map: { [shipName: string]: number } = {};
    activeShipNames.forEach(name => { map[name] = 0; });

    actualOrders.forEach(h => {
      const ship = h.shipName;
      if (!ship || ship === '未指定') return;
      const qty = h.quantity || 1;
      const price = h.unitPrice || 0;
      const amount = qty * price;

      if (map[ship] !== undefined) {
        map[ship] += amount;
      } else {
        map[ship] = amount;
      }
    });

    return map;
  }, [actualOrders, activeShipNames]);

  // 選択された「船」「カテゴリ」「年度」に該当する発注履歴一覧を抽出
  const filteredHistories = useMemo(() => {
    return actualOrders.filter(h => {
      // 船名のマッチ
      const shipMatch = h.shipName === selectedShip || (selectedShip === '未指定' && (!h.shipName || h.shipName === '未指定'));
      if (!shipMatch) return false;

      // カテゴリのマッチ（未指定はデフォルト部品扱い）
      const itemCategory = h.category || '部品';
      if (itemCategory !== selectedCategory) return false;

      // 年度のマッチ
      if (selectedYear !== 'ALL') {
        const itemFY = getFiscalYear(h.orderDate);
        if (itemFY !== Number(selectedYear)) return false;
      }

      // 月のマッチ（'ALL' または 1〜12月）
      if (selectedMonth !== 'ALL') {
        if (!h.orderDate) return false;
        const normalizedDateStr = h.orderDate.replace(/\//g, '-');
        const dateObj = new Date(normalizedDateStr);
        let monthNum: number | null = null;
        if (!isNaN(dateObj.getTime())) {
          monthNum = dateObj.getMonth() + 1;
        } else {
          const parts = normalizedDateStr.split('-');
          if (parts.length >= 2) {
            monthNum = parseInt(parts[1], 10);
          }
        }
        if (monthNum !== Number(selectedMonth)) return false;
      }

      return true;
    });
  }, [actualOrders, selectedShip, selectedCategory, selectedYear, selectedMonth]);

  // フィルタリング後の合計金額
  const categoryTotalAmount = useMemo(() => {
    return filteredHistories.reduce((sum, item) => {
      const qty = item.quantity || 1;
      const price = item.unitPrice || 0;
      return sum + (qty * price);
    }, 0);
  }, [filteredHistories]);

  // 単価・金額の編集開始
  const handleStartEdit = (item: PartHistory) => {
    setEditingId(item.id);
    setEditPrice(item.unitPrice || '');
    setEditQty(item.quantity !== undefined ? item.quantity : 1);
    setEditRemark(item.remark || '');
  };

  // 単価・金額の編集保存（次回自動反映）
  const handleSaveEdit = (id: string) => {
    const newPrice = typeof editPrice === 'number' ? editPrice : 0;
    const newQty = typeof editQty === 'number' ? editQty : 1;

    const updated = updateHistoryUnitPrice(
      histories,
      id,
      newPrice,
      newQty,
      editRemark
    );
    onHistoriesChange(updated);
    setEditingId(null);
  };

  // 履歴行の削除
  const handleDeleteItem = (id: string) => {
    if (confirm('この発注履歴項目を削除しますか？')) {
      const updated = histories.filter(h => h.id !== id);
      savePartHistories(updated);
      onHistoriesChange(updated);
    }
  };

  // 新規履歴の手動追加
  const handleAddNewHistory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.partName.trim()) {
      alert('品名を入力してください');
      return;
    }

    const createdItem: PartHistory = {
      id: `manual-${Date.now()}`,
      shipName: selectedShip,
      equipmentName: newItem.equipmentName || '全般',
      manufacturer: newItem.manufacturer || '手入力',
      model: newItem.model || '-',
      partName: newItem.partName.trim(),
      partNumber: newItem.partNumber || '-',
      unit: newItem.unit || '個',
      unitPrice: Number(newItem.unitPrice) || 0,
      quantity: Number(newItem.quantity) || 1,
      category: selectedCategory,
      orderDate: newItem.orderDate || new Date().toISOString().split('T')[0],
      remark: newItem.remark || ''
    };

    const updated = [createdItem, ...histories];
    savePartHistories(updated);
    onHistoriesChange(updated);

    setShowAddModal(false);
    setNewItem({
      equipmentName: '',
      partName: '',
      partNumber: '',
      manufacturer: '',
      model: '',
      quantity: 1,
      unit: '個',
      unitPrice: '',
      orderDate: new Date().toISOString().split('T')[0],
      remark: ''
    });
  };

  // 未発注のCSVマスタデータを発注履歴データベースから削除
  const handleCleanUnorderedMasterData = () => {
    const unorderedCount = histories.filter(h => !h.orderDate || h.orderDate.trim() === '').length;
    if (unorderedCount === 0) {
      alert('未発注のCSVマスタデータはありません。（すべてのデータに発注日が存在します）');
      return;
    }
    if (confirm(`CSV等で取り込まれた未発注のマスタデータ（合計 ${unorderedCount} 件）をデータベースから完全に削除しますか？\n（発注書作成時または本画面で手動入力された発注実績データのみが保持されます）`)) {
      const onlyOrders = histories.filter(h => Boolean(h.orderDate && h.orderDate.trim() !== ''));
      savePartHistories(onlyOrders);
      onHistoriesChange(onlyOrders);
      alert(`${unorderedCount}件の未発注マスタデータを削除しました。`);
    }
  };

  // 予算データの全削除
  const handleClearAll = () => {
    setShowClearAllModal(true);
  };

  const executeClearAll = () => {
    const cleared = clearAllPartHistories();
    onHistoriesChange(cleared);
  };

  // 印刷ダイアログのトリガー
  const triggerPrint = () => {
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <div className="space-y-6">
      {/* 画面ヘッダー情報 */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-slate-800 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                予算管理・発注実績データベース
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Ship className="h-7 w-7 text-indigo-400" />
              船別・年度別 発注履歴＆予算集計
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              管理船舶別に「部品・船用品・潤滑油・廃油処理」の発注実績を自動集計。発注書作成時または本画面で登録されたデータのみが集計・表示されます（CSVから取り込まれた単なる部品単価マスタデータは自動除外されます）。
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
            <button
              onClick={() => setShowPriceRevisionModal(true)}
              type="button"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-md border border-amber-400/30"
              title="各メーカーからの価格改定PDF資料を全体共通で閲覧・添付管理"
            >
              <FileCheck className="h-4.5 w-4.5 text-amber-100" />
              価格改定PDF資料
            </button>

            <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700/80 rounded-xl p-3.5 text-right min-w-[200px]">
              <div className="text-xs text-slate-400 font-medium mb-0.5">
                {selectedShip} / {ORDER_CATEGORY_TITLE_MAP[selectedCategory]}
              </div>
              <div className="text-2xl font-extrabold text-emerald-400 font-mono tracking-tight">
                ¥ {categoryTotalAmount.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                （{selectedYear === 'ALL' ? '全年度' : `${selectedYear}年度`}{selectedMonth === 'ALL' ? '' : ` ${selectedMonth}月`} 実績合計 {filteredHistories.length}件）
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 画面用UIコンテナ（印刷時は非表示） */}
      <div className="space-y-6 print:hidden">
        {/* 1. 船の選択一覧カード */}
        <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-indigo-600" />
            対象の船舶を選択（全{activeShipNames.length}隻）
          </h3>

          <button
            type="button"
            onClick={() => setShowShipManagementModal(true)}
            className="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-indigo-200/80 transition-all cursor-pointer shadow-2xs"
            title="管理船舶の追加や削除（退役・管理終了）を行います"
          >
            <Settings className="h-3.5 w-3.5 text-indigo-600" />
            <span>船名の管理（追加・削除）</span>
          </button>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2">
          {activeShipNames.map(ship => {
            const isSelected = selectedShip === ship;
            const total = shipSummaries[ship] || 0;

            return (
              <button
                key={ship}
                onClick={() => setSelectedShip(ship)}
                type="button"
                className={`p-2.5 rounded-xl text-left transition-all cursor-pointer relative flex flex-col justify-between border ${
                  isSelected 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-300' 
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                <div>
                  <div className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                    {ship}
                  </div>
                </div>
                <div className={`text-[10px] font-mono mt-1 font-semibold ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                  {total > 0 ? `¥${(total / 10000).toFixed(0)}万` : '¥0'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. 選択された船の アコーディオン/カテゴリー選択 & 年度フィルターバー */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 text-indigo-700 p-2.5 rounded-xl border border-indigo-100">
              <Ship className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">{selectedShip}</h3>
                <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  発注履歴
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                以下の4つの分類を切り替えて予算と過去の注文実績を確認・修正できます。
              </p>
            </div>
          </div>

          {/* 右側：年度＆月フィルタードロップダウン & アクション */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 年度フィルター */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-2xs">
              <Calendar className="h-4 w-4 text-slate-500" />
              <label className="text-xs font-semibold text-slate-600">年度:</label>
              <select
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
              >
                <option value="ALL">全ての年度</option>
                {availableYears.map(yr => (
                  <option key={yr} value={String(yr)}>{yr}年度 (令和{yr - 2018}年度)</option>
                ))}
              </select>
            </div>

            {/* 月フィルター（新規追加） */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-2xs">
              <label className="text-xs font-semibold text-slate-600">月:</label>
              <select
                className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              >
                <option value="ALL">全期間 (すべての月)</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                  <option key={m} value={String(m)}>{m}月</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowPriceRevisionModal(true)}
              type="button"
              className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer shadow-sm"
              title="各メーカーからの価格改定PDFを閲覧・保管"
            >
              <FileCheck className="h-3.5 w-3.5 text-amber-100" />
              価格改定PDF資料
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              type="button"
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              実績を手動追加
            </button>

            <button
              onClick={() => setShowPrintModal(true)}
              type="button"
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              <Printer className="h-3.5 w-3.5" />
              予算集計表を印刷/PDF保存
            </button>

            <button
              onClick={handleCleanUnorderedMasterData}
              type="button"
              className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer shadow-sm"
              title="CSV等で取り込んだ未発注のマスタデータを完全に消去・除外します"
            >
              <Trash2 className="h-3.5 w-3.5 text-amber-600" />
              未発注マスタ消去
            </button>

            <button
              onClick={handleClearAll}
              type="button"
              className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer shadow-sm"
              title="予算集計・発注履歴の全データを初期化削除します"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
              全履歴クリア
            </button>
          </div>
        </div>

        {/* 4つのカテゴリタブ (部品 / 船用品 / 潤滑油 / 廃油処理) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {(['部品', '船用品', '潤滑油', '廃油処理'] as OrderCategory[]).map(cat => {
            const isCatSelected = selectedCategory === cat;
            const catCount = actualOrders.filter(h => {
              const shipMatch = h.shipName === selectedShip || (selectedShip === '未指定' && (!h.shipName || h.shipName === '未指定'));
              if (!shipMatch) return false;
              if ((h.category || '部品') !== cat) return false;
              if (selectedYear !== 'ALL' && getFiscalYear(h.orderDate) !== Number(selectedYear)) return false;
              if (selectedMonth !== 'ALL') {
                if (!h.orderDate) return false;
                const normalizedDateStr = h.orderDate.replace(/\//g, '-');
                const dateObj = new Date(normalizedDateStr);
                let monthNum: number | null = null;
                if (!isNaN(dateObj.getTime())) {
                  monthNum = dateObj.getMonth() + 1;
                } else {
                  const parts = normalizedDateStr.split('-');
                  if (parts.length >= 2) monthNum = parseInt(parts[1], 10);
                }
                if (monthNum !== Number(selectedMonth)) return false;
              }
              return true;
            }).length;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                type="button"
                className={`py-3 px-4 rounded-xl font-bold text-sm transition-all cursor-pointer flex items-center justify-between border ${
                  isCatSelected
                    ? 'bg-indigo-50/80 text-indigo-950 border-indigo-300 ring-2 ring-indigo-500/20 shadow-sm'
                    : 'bg-slate-50/60 hover:bg-slate-100/80 text-slate-700 border-slate-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isCatSelected ? 'bg-indigo-600' : 'bg-slate-400'}`}></span>
                  {ORDER_CATEGORY_TITLE_MAP[cat]}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  isCatSelected ? 'bg-indigo-200 text-indigo-900' : 'bg-slate-200 text-slate-600'
                }`}>
                  {catCount}件
                </span>
              </button>
            );
          })}
        </div>

        {/* 発注履歴・金額一覧テーブル */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2">
              <span>【{selectedShip}】</span>
              <span className="text-indigo-700">{ORDER_CATEGORY_TITLE_MAP[selectedCategory]}</span>
              <span>{selectedYear === 'ALL' ? '全年度' : `${selectedYear}年度`}{selectedMonth === 'ALL' ? ' (全期間)' : ` ${selectedMonth}月`} 発注明細一覧</span>
            </h4>

            <span className="text-xs font-semibold text-slate-500">
              合計 {filteredHistories.length} 件 | 小計: <span className="text-indigo-900 font-mono font-bold text-sm">¥{categoryTotalAmount.toLocaleString()}</span>
            </span>
          </div>

          {filteredHistories.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white">
              <FileSpreadsheet className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold">該当する発注履歴データがまだありません</p>
              <p className="text-xs text-slate-400 mt-1">「注文書作成」タブから発注書を作成すると自動保存されます。</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-2.5 px-3">発注日</th>
                    <th className="py-2.5 px-3">発注No.</th>
                    <th className="py-2.5 px-3">機器名</th>
                    <th className="py-2.5 px-3">品名</th>
                    <th className="py-2.5 px-3">部品番号・規格</th>
                    <th className="py-2.5 px-3">メーカー</th>
                    <th className="py-2.5 px-3 text-right">数量</th>
                    <th className="py-2.5 px-3 text-right">単価 (円)</th>
                    <th className="py-2.5 px-3 text-right">金額 (円)</th>
                    <th className="py-2.5 px-3">備考</th>
                    <th className="py-2.5 px-3 text-center">後入力・編集</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredHistories.map(item => {
                    const isEditing = editingId === item.id;
                    const qty = isEditing ? (typeof editQty === 'number' ? editQty : 0) : (item.quantity || 1);
                    const price = isEditing ? (typeof editPrice === 'number' ? editPrice : 0) : (item.unitPrice || 0);
                    const amount = qty * price;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                          {item.orderDate || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                          {item.orderNo || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {item.equipmentName || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {item.partName}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {item.partNumber || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {item.manufacturer || '-'}
                        </td>
                        
                        {/* 数量 */}
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                          {isEditing ? (
                            <input
                              type="number"
                              className="w-16 rounded border-indigo-300 px-1.5 py-1 text-right font-bold text-indigo-950 bg-indigo-50/50"
                              value={editQty}
                              onChange={e => setEditQty(e.target.value === '' ? '' : Number(e.target.value))}
                            />
                          ) : (
                            `${qty} ${item.unit || '個'}`
                          )}
                        </td>

                        {/* 単価（後入力・編集） */}
                        <td className="py-2.5 px-3 text-right font-mono font-semibold">
                          {isEditing ? (
                            <input
                              type="number"
                              placeholder="単価を入力"
                              className="w-24 rounded border-indigo-300 px-1.5 py-1 text-right font-bold text-indigo-950 bg-indigo-50/50"
                              value={editPrice}
                              onChange={e => setEditPrice(e.target.value === '' ? '' : Number(e.target.value))}
                            />
                          ) : (
                            <span className={price > 0 ? 'text-slate-900' : 'text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded'}>
                              {price > 0 ? `¥${price.toLocaleString()}` : '未確定 (後入力可)'}
                            </span>
                          )}
                        </td>

                        {/* 金額 */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-950">
                          ¥{amount.toLocaleString()}
                        </td>

                        {/* 備考 */}
                        <td className="py-2.5 px-3 text-slate-500 max-w-[140px] truncate">
                          {isEditing ? (
                            <input
                              type="text"
                              className="w-full rounded border-indigo-300 px-1.5 py-1 text-xs bg-indigo-50/50"
                              value={editRemark}
                              onChange={e => setEditRemark(e.target.value)}
                            />
                          ) : (
                            item.remark || '-'
                          )}
                        </td>

                        {/* 操作ボタン */}
                        <td className="py-2.5 px-3 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleSaveEdit(item.id)}
                                type="button"
                                className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors cursor-pointer shadow-xs"
                                title="確定して次回からの候補単価に反映"
                              >
                                <Save className="h-3 w-3" />
                                保存・連動
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleStartEdit(item)}
                                type="button"
                                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                                title="金額・数量を後入力/修正"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                type="button"
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="削除"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* 印刷・PDF表示用モーダル (ダイアログ) */}
      {showPrintModal && (
        <div className="budget-print-modal-overlay fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-transparent print:static print:block print:overflow-visible">
          
          {/* 印刷専用スタイル定義 */}
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 10mm 8mm 10mm 8mm;
              }

              /* 画面上部ヘッダーや操作パネル、モーダル以外の画面領域を印刷非表示 */
              header, nav, footer, .print\\:hidden {
                display: none !important;
              }

              /* html, body, #root のスクロール・高さ・固定制限解除 */
              html, body, #root {
                background: #ffffff !important;
                color: #000000 !important;
                height: auto !important;
                min-height: 0 !important;
                overflow: visible !important;
                margin: 0 !important;
                padding: 0 !important;
              }

              /* モーダル背景・外枠のリセット */
              .budget-print-modal-overlay {
                position: static !important;
                display: block !important;
                background: none !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
                backdrop-filter: none !important;
              }

              .budget-print-modal-container {
                position: static !important;
                display: block !important;
                max-width: none !important;
                max-height: none !important;
                box-shadow: none !important;
                border: none !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
              }

              #budget-print-area {
                display: block !important;
                position: static !important;
                width: 100% !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
                background: white !important;
                color: black !important;
                overflow: visible !important;
              }

              table {
                width: 100% !important;
                border-collapse: collapse !important;
                page-break-inside: auto !important;
              }

              tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }

              thead {
                display: table-header-group !important;
              }
            }
          `}</style>

          <div className="budget-print-modal-container bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:p-0 print:rounded-none print:w-full">
            
            {/* モーダル上部ヘッダー（印刷時には非表示） */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Printer className="h-5 w-5 text-indigo-600" />
                  予算集計表 プレビュー・印刷
                </h3>
                <p className="text-xs text-slate-500">
                  【{selectedShip}】{selectedYear === 'ALL' ? '全年度' : `${selectedYear}年度`}{selectedMonth === 'ALL' ? '' : ` ${selectedMonth}月`} {ORDER_CATEGORY_TITLE_MAP[selectedCategory]} 発注実績集計
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={triggerPrint}
                  type="button"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-lg inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Printer className="h-4 w-4" />
                  印刷・PDF保存を実行
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  type="button"
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3 py-2 rounded-lg cursor-pointer"
                >
                  閉じる
                </button>
              </div>
            </div>

            {/* A4 印刷プレビュー領域 */}
            <div id="budget-print-area" className="p-6 bg-white border border-slate-200 print:border-none print:p-0 text-slate-900 space-y-4">
              <div className="text-center border-b-2 border-slate-800 pb-2">
                <p className="text-[11px] font-bold text-slate-600 tracking-wider">株式会社イコーズ 船体部品・発注予算管理集計表</p>
                <h1 className="text-xl font-extrabold tracking-wider mt-0.5">
                  【{selectedShip}】 {selectedYear === 'ALL' ? '全期間' : `${selectedYear}年度`}{selectedMonth === 'ALL' ? '' : ` ${selectedMonth}月`} {ORDER_CATEGORY_TITLE_MAP[selectedCategory]} 集計表
                </h1>
              </div>

              <div className="flex justify-between text-xs text-slate-700 font-semibold">
                <div className="space-y-0.5">
                  <p>対象船舶: <span className="font-bold text-slate-900">{selectedShip}</span></p>
                  <p>分類: <span className="font-bold text-slate-900">{ORDER_CATEGORY_TITLE_MAP[selectedCategory]}</span></p>
                  <p>対象期間: <span className="font-bold text-slate-900">{selectedYear === 'ALL' ? '全年度' : `${selectedYear}年度`}{selectedMonth === 'ALL' ? ' (全期間)' : ` ${selectedMonth}月`}</span></p>
                </div>
                <div className="text-right space-y-0.5">
                  <p>出力日: {new Date().toLocaleDateString('ja-JP')}</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-1">
                    合計金額: <span className="font-mono text-base">¥{categoryTotalAmount.toLocaleString()}</span>
                  </p>
                </div>
              </div>

              {/* 明細テーブル */}
              <table className="w-full text-[11px] text-left border-collapse border border-slate-800">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 border-b border-slate-800 font-bold">
                    <th className="border border-slate-800 px-2 py-1 text-center w-8">No.</th>
                    <th className="border border-slate-800 px-2 py-1 w-20">発注日</th>
                    <th className="border border-slate-800 px-2 py-1">機器名</th>
                    <th className="border border-slate-800 px-2 py-1">品名</th>
                    <th className="border border-slate-800 px-2 py-1">部品番号・規格</th>
                    <th className="border border-slate-800 px-2 py-1">メーカー</th>
                    <th className="border border-slate-800 px-2 py-1 text-right w-14">数量</th>
                    <th className="border border-slate-800 px-2 py-1 text-right w-20">単価</th>
                    <th className="border border-slate-800 px-2 py-1 text-right w-22">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistories.map((item, index) => {
                    const qty = item.quantity || 1;
                    const price = item.unitPrice || 0;
                    const amount = qty * price;

                    return (
                      <tr key={item.id} className="border-b border-slate-300">
                        <td className="border border-slate-300 px-2 py-1 text-center font-mono text-[10px]">{index + 1}</td>
                        <td className="border border-slate-300 px-2 py-1 font-mono text-[10px]">{item.orderDate || '-'}</td>
                        <td className="border border-slate-300 px-2 py-1">{item.equipmentName || '-'}</td>
                        <td className="border border-slate-300 px-2 py-1 font-bold">{item.partName}</td>
                        <td className="border border-slate-300 px-2 py-1 font-mono text-[10px]">{item.partNumber || '-'}</td>
                        <td className="border border-slate-300 px-2 py-1">{item.manufacturer || '-'}</td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-mono">{qty} {item.unit || '個'}</td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-mono">¥{price.toLocaleString()}</td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-mono font-bold">¥{amount.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  
                  {/* 合計行 */}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-800">
                    <td colSpan={8} className="border border-slate-800 px-2 py-1.5 text-right">総合計金額:</td>
                    <td className="border border-slate-800 px-2 py-1.5 text-right font-mono text-xs">¥{categoryTotalAmount.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 手動実績追加モーダル */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-600" />
              【{selectedShip}】 発注実績の手動直接入力
            </h3>
            <p className="text-xs text-slate-500">
              過去の発注データや請求確定金額を直接登録します。（自動補完にも反映されます）
            </p>

            <form onSubmit={handleAddNewHistory} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">機器名</label>
                  <input
                    type="text"
                    placeholder="例: 主機関"
                    className="w-full rounded-md border-slate-300 px-2.5 py-1.5 text-xs"
                    value={newItem.equipmentName}
                    onChange={e => setNewItem({ ...newItem, equipmentName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">メーカー</label>
                  <input
                    type="text"
                    placeholder="例: ヤンマーエンジニアリング"
                    className="w-full rounded-md border-slate-300 px-2.5 py-1.5 text-xs"
                    value={newItem.manufacturer}
                    onChange={e => setNewItem({ ...newItem, manufacturer: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">品名 *</label>
                <input
                  type="text"
                  required
                  placeholder="例: 燃料噴射弁"
                  className="w-full rounded-md border-slate-300 px-2.5 py-1.5 text-xs font-bold"
                  value={newItem.partName}
                  onChange={e => setNewItem({ ...newItem, partName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">部品番号・規格</label>
                <input
                  type="text"
                  placeholder="例: 129612-53000"
                  className="w-full rounded-md border-slate-300 px-2.5 py-1.5 text-xs font-mono"
                  value={newItem.partNumber}
                  onChange={e => setNewItem({ ...newItem, partNumber: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">数量</label>
                  <input
                    type="number"
                    className="w-full rounded-md border-slate-300 px-2.5 py-1.5 text-xs font-bold"
                    value={newItem.quantity}
                    onChange={e => setNewItem({ ...newItem, quantity: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">単位</label>
                  <input
                    type="text"
                    className="w-full rounded-md border-slate-300 px-2.5 py-1.5 text-xs"
                    value={newItem.unit}
                    onChange={e => setNewItem({ ...newItem, unit: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">単価 (円)</label>
                  <input
                    type="number"
                    placeholder="例: 25000"
                    className="w-full rounded-md border-slate-300 px-2.5 py-1.5 text-xs font-bold text-indigo-950"
                    value={newItem.unitPrice}
                    onChange={e => setNewItem({ ...newItem, unitPrice: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">発注日付</label>
                <input
                  type="date"
                  className="w-full rounded-md border-slate-300 px-2.5 py-1.5 text-xs"
                  value={newItem.orderDate}
                  onChange={e => setNewItem({ ...newItem, orderDate: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg cursor-pointer shadow-sm"
                >
                  登録保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 価格改定PDF資料モーダル */}
      <PriceRevisionModal
        isOpen={showPriceRevisionModal}
        onClose={() => setShowPriceRevisionModal(false)}
      />

      {/* 2段階確認用パスワード保護モーダル */}
      <ProtectedActionModal
        isOpen={showClearAllModal}
        onClose={() => setShowClearAllModal(false)}
        onSuccess={executeClearAll}
        title="全発注実績・予算履歴の全クリア"
        description="予算集計および蓄積されているすべての過去発注実績データを一括消去して初期化します。"
        actionButtonText="全履歴データを消去・初期化する"
        actionButtonColor="rose"
      />

      {/* 管理船舶リスト（追加・削除）設定モーダル */}
      <ShipManagementModal
        isOpen={showShipManagementModal}
        onClose={() => setShowShipManagementModal(false)}
        shipNames={activeShipNames}
        onShipNamesChange={(newShips) => {
          if (onShipNamesChange) {
            onShipNamesChange(newShips);
          }
        }}
      />
    </div>
  );
}
