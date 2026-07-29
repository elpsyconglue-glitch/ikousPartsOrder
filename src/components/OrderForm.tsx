import React, { useState, useEffect } from 'react';
import { PartHistory, OrderItem, OrderHeader, STAFF_LIST, StaffName, OrderCategory, ORDER_CATEGORY_TITLE_MAP } from '../types';
import { DEFAULT_SHIP_NAMES } from '../defaultData';
import { Plus, Trash2, Settings, HelpCircle, ChevronDown, ChevronUp, RefreshCw, FileText, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

import { generateOrderNo as createAutoOrderNo } from '../utils/orderNoHelper';

interface OrderFormProps {
  histories: PartHistory[];
  items: OrderItem[];
  onItemsChange: (items: OrderItem[]) => void;
  header: OrderHeader;
  onHeaderChange: (header: OrderHeader) => void;
  onPreviewClick: () => void;
  shipNames?: string[];
}

export default function OrderForm({
  histories,
  items,
  onItemsChange,
  header,
  onHeaderChange,
  onPreviewClick,
  shipNames = DEFAULT_SHIP_NAMES
}: OrderFormProps) {
  const { isReadOnly } = useAuth();
  const [activeRowDetails, setActiveRowDetails] = useState<string | null>(null);
  const [partNameSuggestions, setPartNameSuggestions] = useState<string[]>([]);
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);

  // 納品期限・納品場所の自動学習・履歴管理
  const [limitDateHistory, setLimitDateHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ikous_limit_date_history');
      return saved ? JSON.parse(saved) : ['注文後約2週間', '注文後1ヶ月以内', '即納希望', '別途相談'];
    } catch {
      return ['注文後約2週間', '注文後1ヶ月以内', '即納希望', '別途相談'];
    }
  });

  const [placeHistory, setPlaceHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ikous_place_history');
      return saved ? JSON.parse(saved) : ['門司港渡し', '神戸港本船渡し', '博多港渡し', '水島港本船渡し', '本社倉庫着'];
    } catch {
      return ['門司港渡し', '神戸港本船渡し', '博多港渡し', '水島港本船渡し', '本社倉庫着'];
    }
  });

  // 新規入力値を履歴に自動追加・保存する処理
  const saveLimitDateToHistory = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    if (!limitDateHistory.includes(trimmed)) {
      const updated = [trimmed, ...limitDateHistory];
      setLimitDateHistory(updated);
      try {
        localStorage.setItem('ikous_limit_date_history', JSON.stringify(updated));
      } catch {}
    }
  };

  const savePlaceToHistory = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    if (!placeHistory.includes(trimmed)) {
      const updated = [trimmed, ...placeHistory];
      setPlaceHistory(updated);
      try {
        localStorage.setItem('ikous_place_history', JSON.stringify(updated));
      } catch {}
    }
  };

  const uniqueShipNames = DEFAULT_SHIP_NAMES;
  const uniqueEquipmentNames = Array.from(new Set(histories.map(h => h.equipmentName).filter(Boolean)));
  const uniqueManufacturerNames = Array.from(new Set(histories.map(h => h.manufacturer).filter(Boolean)));
  const uniqueModelNames = Array.from(new Set(histories.map(h => h.model).filter(Boolean)));
  const uniqueUnits = Array.from(new Set(histories.map(h => h.unit).filter(Boolean)));
  const allPartNumbers = Array.from(new Set(histories.map(h => h.partNumber).filter(Boolean)));

  // 一意の品名リストをあらかじめ抽出してサジェストに利用
  useEffect(() => {
    const names = Array.from(new Set(histories.map(h => h.partName)));
    setPartNameSuggestions(names);
  }, [histories]);

  // 新規行を1行追加
  const handleAddRow = () => {
    const newItem: OrderItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      partName: '',
      partNumber: '',
      quantity: '',
      unit: '',
      unitPrice: '',
      remark: '',
      isUrgent: false,
      orderCategory: '部品',
      shipName: '',
      equipmentName: '',
      manufacturer: '',
      model: ''
    };
    onItemsChange([...items, newItem]);
    // 新しい行の詳細を開く
    setActiveRowDetails(newItem.id);
  };

  // 1行削除
  const handleRemoveRow = (id: string) => {
    if (items.length <= 1) {
      // 1行しかない場合は消さずにクリアする
      const resetItem: OrderItem = {
        id: items[0].id,
        partName: '',
        partNumber: '',
        quantity: '',
        unit: '',
        unitPrice: '',
        remark: '',
        isUrgent: false,
        orderCategory: '部品',
        shipName: '',
        equipmentName: '',
        manufacturer: '',
        model: ''
      };
      onItemsChange([resetItem]);
      return;
    }
    const filtered = items.filter(item => item.id !== id);
    onItemsChange(filtered);
    if (activeRowDetails === id) {
      setActiveRowDetails(null);
    }
  };

  // 各セルの値変更
  const handleCellChange = (id: string, field: keyof OrderItem, value: any) => {
    const updated = items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };

        // 数量と単価の数値化
        if (field === 'quantity') {
          updatedItem.quantity = value === '' ? '' : Number(value);
        }
        if (field === 'unitPrice') {
          updatedItem.unitPrice = value === '' ? '' : Number(value);
        }

        return updatedItem;
      }
      return item;
    });
    onItemsChange(updated);
  };

  // 品名が入力・選択された際の自動補完・分析ロジック
  const handlePartNameSelect = (id: string, partName: string) => {
    // データベースから品名が一致する履歴をすべて抽出
    const matchingHistories = histories.filter(
      h => h.partName.toLowerCase().trim() === partName.toLowerCase().trim()
    );

    const updated = items.map((item): OrderItem => {
      if (item.id === id) {
        const baseItem = { ...item, partName };

        if (matchingHistories.length === 0) {
          // 履歴に一致するものがない新規の品名
          return baseItem;
        }

        // 部品番号・規格(partNumber)のユニークな候補リストを作成
        const partNumbers = Array.from(new Set(matchingHistories.map(h => h.partNumber).filter(Boolean)));

        if (partNumbers.length === 1) {
          // 部品番号の候補が1つだけなら、すべて自動入力
          const match = matchingHistories[0];
          return {
            ...baseItem,
            partNumber: match.partNumber,
            unit: match.unit || '個',
            unitPrice: match.unitPrice ?? '',
            shipName: match.shipName,
            equipmentName: match.equipmentName,
            manufacturer: match.manufacturer,
            model: match.model
          };
        } else if (partNumbers.length > 1) {
          // 部品番号の候補が複数ある場合
          // 最初のマッチの情報を暫定的に入れておき、部品番号を「選択してください」状態、または最初の候補にする
          const firstMatch = matchingHistories[0];
          return {
            ...baseItem,
            partNumber: '', // ユーザーにドロップダウンから選択してもらう
            unit: firstMatch.unit || '個',
            unitPrice: firstMatch.unitPrice ?? '',
            shipName: firstMatch.shipName,
            equipmentName: firstMatch.equipmentName,
            manufacturer: firstMatch.manufacturer,
            model: firstMatch.model
          };
        }

        return baseItem;
      }
      return item;
    });

    onItemsChange(updated);
  };

  // 部品番号が複数候補から選択された際の自動補完
  const handlePartNumberSelect = (id: string, partNumber: string) => {
    if (!partNumber) return;

    const currentItem = items.find(item => item.id === id);
    if (!currentItem) return;

    // 品名と部品番号が両方一致する履歴レコードを検索
    const match = histories.find(
      h => h.partName.toLowerCase().trim() === currentItem.partName.toLowerCase().trim() &&
           h.partNumber === partNumber
    );

    if (match) {
      const updated = items.map((item): OrderItem => {
        if (item.id === id) {
          return {
            ...item,
            partNumber,
            unit: match.unit || item.unit || '個',
            unitPrice: match.unitPrice ?? item.unitPrice ?? '',
            shipName: match.shipName,
            equipmentName: match.equipmentName,
            manufacturer: match.manufacturer,
            model: match.model
          };
        }
        return item;
      });
      onItemsChange(updated);
    } else {
      // マッチがなくても、手動入力された部品番号を反映
      handleCellChange(id, 'partNumber', partNumber);
    }
  };

  // 行に紐づく品名の部品番号候補リストを取得
  const getPartNumberOptions = (partName: string): string[] => {
    if (!partName) return [];
    const matches = histories.filter(h => h.partName.toLowerCase().trim() === partName.toLowerCase().trim());
    return Array.from(new Set(matches.map(h => h.partNumber).filter(Boolean)));
  };

  // 入力中のメーカー・分類別発注書の分割情報を計算
  const getSplittedOrdersSummary = () => {
    const groups: { [key: string]: { count: number; manufacturer: string; category: OrderCategory } } = {};
    items.forEach(item => {
      const mfg = item.manufacturer.trim() || '（手入力用発注先）';
      const cat: OrderCategory = item.orderCategory || '部品';
      const key = `${mfg}___${cat}`;
      if (!groups[key]) {
        groups[key] = { count: 0, manufacturer: mfg, category: cat };
      }
      groups[key].count += 1;
    });
    return Object.values(groups);
  };

  const orderSplitList = getSplittedOrdersSummary();

  // 今日日付の設定
  const setTodayDate = () => {
    const today = new Date().toISOString().slice(0, 10);
    onHeaderChange({ ...header, date: today });
  };

  // 発注書Noの自動生成例セット
  const generateOrderNo = () => {
    const firstItem = items[0];
    const ship = firstItem?.shipName || '未指定';
    const cat = firstItem?.orderCategory || header.orderCategory || '部品';
    const autoNo = createAutoOrderNo(histories, ship, cat, header.date, 0);
    onHeaderChange({ ...header, orderNo: autoNo });
  };

  const handlePreviewClickWithSave = () => {
    if (header.limitDate) saveLimitDateToHistory(header.limitDate);
    if (header.place) savePlaceToHistory(header.place);
    onPreviewClick();
  };

  return (
    <div className="space-y-6">
      {/* 閲覧のみ権限バナー */}
      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center justify-between text-amber-900 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-200 text-amber-800 rounded-lg">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs flex items-center gap-2">
                <span>【閲覧のみ権限モード】</span>
                <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-mono">
                  閲覧のみアカウント
                </span>
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                現在のアカウントは「閲覧のみ」権限です。発注書の新規作成・内容編集はできません。印刷プレビューおよび履歴管理の閲覧・印刷機能をご利用いただけます。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onPreviewClick}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
          >
            現在の発注書を印刷・プレビュー
          </button>
        </div>
      )}

      {/* 1. 共通基本情報フォーム */}
      <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-6 ${isReadOnly ? 'opacity-80 pointer-events-none' : ''}`}>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-indigo-600" />
            発注基本情報設定
          </h2>
          {header.isUrgent && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 animate-pulse border border-rose-200">
              至急発注設定中
            </span>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 発注年月日 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              発注年月日 <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-1">
              <input
                type="date"
                required
                className="block w-full rounded-md border-slate-300 px-2 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white"
                value={header.date}
                onChange={e => onHeaderChange({ ...header, date: e.target.value })}
              />
              <button
                type="button"
                onClick={setTodayDate}
                className="px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md hover:bg-indigo-100 transition-colors shrink-0"
                title="今日の日付をセット"
              >
                今日
              </button>
            </div>
          </div>

          {/* 発注書No. */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>発注書No.</span>
              <span className="text-[10px] text-slate-500 font-normal">（空欄で自動採番）</span>
            </label>
            <div className="flex gap-1">
              <input
                type="text"
                placeholder="例: Run2026-B1 (自動分割採番)"
                className="block w-full rounded-md border-slate-300 px-2 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                value={header.orderNo}
                onChange={e => onHeaderChange({ ...header, orderNo: e.target.value })}
              />
              <button
                type="button"
                onClick={generateOrderNo}
                className="px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md hover:bg-indigo-100 transition-colors shrink-0"
                title="船・分類に基づく自動採番サンプルを生成"
              >
                例生成
              </button>
            </div>
          </div>

          {/* 担当者 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              担当者 <span className="text-rose-500">*</span>
            </label>
            <select
              required
              className="block w-full rounded-md border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white"
              value={header.staff}
              onChange={e => onHeaderChange({ ...header, staff: e.target.value })}
            >
              <option value="">-- 担当を選択 --</option>
              {STAFF_LIST.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* 納品期限 & 納品場所 (入力履歴・サジェスト対応) */}
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>納品期限</span>
                <span className="text-[10px] text-slate-400 font-normal">(空欄時【-】)</span>
              </label>
              <input
                type="text"
                placeholder="直接入力または選択..."
                list="limit-date-history-list"
                className="block w-full rounded-md border-slate-300 px-1.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white"
                value={header.limitDate}
                onChange={e => {
                  const val = e.target.value;
                  onHeaderChange({ ...header, limitDate: val });
                  saveLimitDateToHistory(val);
                }}
                onBlur={e => saveLimitDateToHistory(e.target.value)}
              />
              <datalist id="limit-date-history-list">
                {limitDateHistory.map((opt, i) => (
                  <option key={`ld-${i}`} value={opt} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>納品場所</span>
                <span className="text-[10px] text-slate-400 font-normal">(空欄時【-】)</span>
              </label>
              <input
                type="text"
                placeholder="直接入力または選択..."
                list="place-history-list"
                className="block w-full rounded-md border-slate-300 px-1.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white"
                value={header.place}
                onChange={e => {
                  const val = e.target.value;
                  onHeaderChange({ ...header, place: val });
                  savePlaceToHistory(val);
                }}
                onBlur={e => savePlaceToHistory(e.target.value)}
              />
              <datalist id="place-history-list">
                {placeHistory.map((opt, i) => (
                  <option key={`pl-${i}`} value={opt} />
                ))}
              </datalist>
            </div>
          </div>

          {/* 急ぎ・至急オプション */}
          <div className="flex flex-col justify-end">
            <label className="flex items-center justify-center gap-1.5 cursor-pointer bg-rose-50/50 hover:bg-rose-50 border border-rose-200/60 rounded-md px-2 py-1.5 text-xs text-rose-700 transition-colors font-semibold h-[34px] mb-0.5">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                checked={!!header.isUrgent}
                onChange={e => onHeaderChange({ ...header, isUrgent: e.target.checked })}
              />
              <span>⚠️ 至急発注 (全体)</span>
            </label>
          </div>
        </div>
      </div>

      {/* 2. 部品明細入力フォーム */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="font-semibold text-slate-800 text-base">発注部品明細入力</h3>
            <p className="text-xs text-slate-500 mt-0.5">品名を入力すると、過去の発注履歴（船・機器・メーカー・規格等）を自動分析して補完します。</p>
          </div>
          <button
            type="button"
            onClick={handleAddRow}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            行を追加する
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="w-10 px-2 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">No.</th>
                <th scope="col" className="w-12 px-1 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">至急</th>
                <th scope="col" className="w-28 px-2 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">注文の分類</th>
                <th scope="col" className="min-w-[170px] px-2 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">品名 (候補サジェスト)</th>
                <th scope="col" className="min-w-[160px] px-2 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">部品番号・規格</th>
                <th scope="col" className="w-20 px-2 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">数量</th>
                <th scope="col" className="w-28 px-2 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">単位</th>
                <th scope="col" className="w-24 px-2 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">単価 (円)</th>
                <th scope="col" className="w-24 px-2 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">金額 (円)</th>
                <th scope="col" className="min-w-[85px] px-2 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">備考</th>
                <th scope="col" className="w-20 px-2 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">詳細/削除</th>
              </tr>
            </thead>
            
            <tbody className="bg-white divide-y divide-slate-200">
              {items.map((item, index) => {
                const partNoOptions = getPartNumberOptions(item.partName);
                const showPartNoDropdown = partNoOptions.length > 1;
                const lineAmount = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);

                return (
                  <React.Fragment key={item.id}>
                    <tr className={`hover:bg-slate-50/50 transition-colors ${focusedRowId === item.id ? 'bg-indigo-50/20' : ''}`}>
                      {/* 行番号 */}
                      <td className="px-2 py-3.5 text-center font-medium text-slate-400 text-xs">
                        {index + 1}
                      </td>

                      {/* 至急チェックボックス */}
                      <td className="px-1 py-3.5 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                          checked={!!item.isUrgent}
                          onChange={e => handleCellChange(item.id, 'isUrgent', e.target.checked)}
                          title="この部品を至急発注にする"
                        />
                      </td>

                      {/* 注文の分類 */}
                      <td className="px-1.5 py-3.5">
                        <select
                          className="block w-full rounded border-slate-300 px-1.5 py-1.5 text-xs font-semibold text-indigo-950 bg-indigo-50/30 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                          value={item.orderCategory || '部品'}
                          onChange={e => handleCellChange(item.id, 'orderCategory', e.target.value as OrderCategory)}
                        >
                          <option value="船用品">船用品</option>
                          <option value="部品">部品</option>
                          <option value="潤滑油">潤滑油</option>
                          <option value="廃油処理">廃油処理</option>
                        </select>
                      </td>

                      {/* 品名 (オートコンプリート) */}
                      <td className="px-3 py-3.5">
                        <div className="relative">
                          <input
                            type="text"
                            required
                            placeholder="品名を入力してください..."
                            className="block w-full rounded-md border-slate-300 px-2 py-1.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white"
                            value={item.partName}
                            onChange={e => {
                              handleCellChange(item.id, 'partName', e.target.value);
                              // リアルタイムに候補を検索して補完
                              handlePartNameSelect(item.id, e.target.value);
                            }}
                            onFocus={() => setFocusedRowId(item.id)}
                            list={`part-names-${item.id}`}
                          />
                          <datalist id={`part-names-${item.id}`}>
                            {partNameSuggestions.map(name => (
                              <option key={name} value={name} />
                            ))}
                          </datalist>
                        </div>
                      </td>

                      {/* 部品番号・規格 */}
                      <td className="px-3 py-3.5">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder={partNoOptions.length > 0 ? `規格候補${partNoOptions.length}件あり (選択/手入力)` : "自動入力または手入力..."}
                            className={`block w-full rounded-md px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 ${
                              partNoOptions.length > 1
                                ? 'border-indigo-400 bg-indigo-50/40 text-indigo-950 font-medium'
                                : 'border-slate-300 text-slate-800 bg-white'
                            }`}
                            value={item.partNumber}
                            onChange={e => {
                              const val = e.target.value;
                              handleCellChange(item.id, 'partNumber', val);
                              if (partNoOptions.includes(val)) {
                                handlePartNumberSelect(item.id, val);
                              }
                            }}
                            list={`part-numbers-${item.id}`}
                          />
                          <datalist id={`part-numbers-${item.id}`}>
                            {partNoOptions.map(opt => (
                              <option key={opt} value={opt} />
                            ))}
                            {allPartNumbers.filter(pn => !partNoOptions.includes(pn)).map(opt => (
                              <option key={opt} value={opt} />
                            ))}
                          </datalist>
                          {partNoOptions.length > 1 && !item.partNumber && (
                            <span className="text-[10px] text-indigo-600 font-semibold mt-0.5 block">
                              ⚠️ 候補 {partNoOptions.length}件 (選択または直接入力)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 数量 */}
                      <td className="px-3 py-3.5">
                        <input
                          type="number"
                          required
                          min="1"
                          placeholder="数量"
                          className="block w-full rounded-md border-slate-300 px-2 py-1.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-right"
                          value={item.quantity}
                          onChange={e => handleCellChange(item.id, 'quantity', e.target.value)}
                        />
                      </td>

                      {/* 単位 */}
                      <td className="px-1.5 py-3.5">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="個,セット等"
                            className="block w-full rounded-md border-slate-300 px-1.5 py-1.5 text-sm font-semibold text-center text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white"
                            value={item.unit}
                            onChange={e => handleCellChange(item.id, 'unit', e.target.value)}
                            list={`units-${item.id}`}
                          />
                          <datalist id={`units-${item.id}`}>
                            {uniqueUnits.map(unit => (
                              <option key={unit} value={unit} />
                            ))}
                          </datalist>
                        </div>
                      </td>

                      {/* 単価 */}
                      <td className="px-3 py-3.5">
                        <input
                          type="number"
                          min="0"
                          placeholder="単価 (円)"
                          className="block w-full rounded-md border-slate-300 px-2 py-1.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-right"
                          value={item.unitPrice}
                          onChange={e => handleCellChange(item.id, 'unitPrice', e.target.value)}
                        />
                      </td>

                      {/* 金額 */}
                      <td className="px-3 py-3.5 text-right font-medium text-slate-700 bg-slate-50/30">
                        ¥{lineAmount.toLocaleString()}
                      </td>

                      {/* 備考 */}
                      <td className="px-3 py-3.5">
                        <input
                          type="text"
                          placeholder="例: 予備用"
                          className="block w-full rounded-md border-slate-300 px-2 py-1.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                          value={item.remark}
                          onChange={e => handleCellChange(item.id, 'remark', e.target.value)}
                        />
                      </td>

                      {/* アクション (詳細 / 削除) */}
                      <td className="px-3 py-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setActiveRowDetails(activeRowDetails === item.id ? null : item.id)}
                            className={`p-1.5 rounded hover:bg-slate-100 transition-colors ${activeRowDetails === item.id ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}
                            title="船名、メーカーなどの自動補完詳細を開く"
                          >
                            {activeRowDetails === item.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(item.id)}
                            className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                            title="この行を削除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* 詳細トグル行 (船名、機器名、メーカー、形式) */}
                    {activeRowDetails === item.id && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={11} className="px-6 py-4 border-l-2 border-l-indigo-500">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                            {/* 注文の分類 */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                注文の分類
                              </label>
                              <select
                                className="block w-full rounded border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 bg-white font-semibold shadow-sm focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                value={item.orderCategory || '部品'}
                                onChange={e => handleCellChange(item.id, 'orderCategory', e.target.value as OrderCategory)}
                              >
                                <option value="船用品">船用品 (船用品注文書)</option>
                                <option value="部品">部品 (部品注文書)</option>
                                <option value="潤滑油">潤滑油 (潤滑油注文書)</option>
                                <option value="廃油処理">廃油処理 (廃油陸揚依頼書)</option>
                              </select>
                            </div>

                            {/* 船名 */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                船名 <span className="text-indigo-600 font-semibold">(ドロップダウン選択)</span>
                              </label>
                              <div className="space-y-1">
                                <select
                                  className="block w-full rounded border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 bg-white font-medium shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                  value={shipNames.includes(item.shipName) ? item.shipName : (item.shipName ? 'OTHER' : '')}
                                  onChange={e => {
                                    const val = e.target.value;
                                    if (val === 'OTHER') {
                                      if (shipNames.includes(item.shipName)) {
                                        handleCellChange(item.id, 'shipName', '');
                                      }
                                    } else {
                                      handleCellChange(item.id, 'shipName', val);
                                    }
                                  }}
                                >
                                  <option value="">-- 船名を選択してください --</option>
                                  {shipNames.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                  ))}
                                  <option value="OTHER">✏️ その他（直接手入力する）</option>
                                </select>

                                {(!shipNames.includes(item.shipName) || item.shipName === '') && (
                                  <input
                                    type="text"
                                    placeholder="船名を直接入力..."
                                    className="block w-full rounded border-indigo-300 px-2.5 py-1.5 text-xs text-slate-800 bg-indigo-50/20 shadow-sm focus:ring-1 focus:ring-indigo-500 mt-1"
                                    value={item.shipName}
                                    onChange={e => handleCellChange(item.id, 'shipName', e.target.value)}
                                  />
                                )}
                              </div>
                            </div>

                            {/* 機器名 */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                機器名 <span className="text-indigo-600 font-normal">(候補選択または手入力)</span>
                              </label>
                              <input
                                type="text"
                                placeholder="候補から選択または手入力..."
                                className="block w-full rounded border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 bg-white shadow-sm focus:ring-1 focus:ring-indigo-500"
                                value={item.equipmentName}
                                onChange={e => handleCellChange(item.id, 'equipmentName', e.target.value)}
                                list={`equipment-names-${item.id}`}
                              />
                              <datalist id={`equipment-names-${item.id}`}>
                                {uniqueEquipmentNames.map(name => (
                                  <option key={name} value={name} />
                                ))}
                              </datalist>
                            </div>

                            {/* メーカー (発注先) */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                メーカー (発注先) <span className="text-indigo-600 font-normal">(候補選択または手入力)</span>
                              </label>
                              <input
                                type="text"
                                placeholder="候補から選択または手入力..."
                                className="block w-full rounded border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 bg-white shadow-sm focus:ring-1 focus:ring-indigo-500 font-medium"
                                value={item.manufacturer}
                                onChange={e => handleCellChange(item.id, 'manufacturer', e.target.value)}
                                list={`manufacturer-names-${item.id}`}
                              />
                              <datalist id={`manufacturer-names-${item.id}`}>
                                {uniqueManufacturerNames.map(name => (
                                  <option key={name} value={name} />
                                ))}
                              </datalist>
                              <p className="text-[10px] text-slate-400 mt-0.5">※メーカーが異なる場合、発注書が個別に分かれます。</p>
                            </div>

                            {/* 形式 */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                形式 <span className="text-indigo-600 font-normal">(候補選択または手入力)</span>
                              </label>
                              <input
                                type="text"
                                placeholder="候補から選択または手入力..."
                                className="block w-full rounded border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 bg-white shadow-sm focus:ring-1 focus:ring-indigo-500"
                                value={item.model}
                                onChange={e => handleCellChange(item.id, 'model', e.target.value)}
                                list={`model-names-${item.id}`}
                              />
                              <datalist id={`model-names-${item.id}`}>
                                {uniqueModelNames.map(name => (
                                  <option key={name} value={name} />
                                ))}
                              </datalist>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. 分割発注のシミュレーター＆印刷ナビゲーション */}
      <div className="bg-slate-900 text-white rounded-xl shadow-lg p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="font-semibold text-base mb-1.5 flex items-center gap-2">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            発注先・分類別 発注書自動分割システム起動中
          </h3>
          <p className="text-xs text-slate-400 max-w-xl">
            異なる発注先（メーカー）や注文分類が含まれる場合、それぞれの組み合わせごとに部品を自動仕分けし、個別の発注書（御中）を自動発行します：
          </p>
          
          <div className="flex flex-wrap gap-2 mt-3.5">
            {orderSplitList.map(({ manufacturer, category, count }) => (
              <span
                key={`${manufacturer}-${category}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 border border-slate-700 shadow-sm"
              >
                <span className="font-bold text-indigo-400">{manufacturer} 御中</span>
                <span className="text-slate-600">|</span>
                <span className="text-emerald-400 font-semibold">{ORDER_CATEGORY_TITLE_MAP[category]}</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-300 font-bold">{count}点</span>
              </span>
            ))}
          </div>
        </div>

        <div className="shrink-0">
          <button
            type="button"
            onClick={handlePreviewClickWithSave}
            disabled={items.some(i => !i.partName)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer"
          >
            <FileText className="h-5 w-5" />
            発注書を分割プレビューする
          </button>
          {items.some(i => !i.partName) && (
            <p className="text-[10px] text-rose-400 text-center mt-1.5">※すべての行に品名を入力してください</p>
          )}
        </div>
      </div>
    </div>
  );
}
