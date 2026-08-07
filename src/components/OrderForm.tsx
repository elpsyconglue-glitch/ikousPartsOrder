import React, { useState, useEffect, useMemo } from 'react';
import { PartHistory, OrderItem, OrderHeader, STAFF_LIST, StaffName, OrderCategory, ORDER_CATEGORY_TITLE_MAP } from '../types';
import { DEFAULT_SHIP_NAMES } from '../defaultData';
import { Plus, Trash2, Settings, HelpCircle, ChevronDown, ChevronUp, RefreshCw, FileText, Lock, AlertCircle, Ship } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

import { 
  getVesselCaptains, 
  saveVesselCaptain, 
  getVesselChiefEngineers, 
  saveVesselChiefEngineer, 
  getVesselHistories, 
  saveVesselHistories 
} from '../utils/vesselStorage';
import { 
  findModelByShipAndEquipment, 
  getEquipmentNamesForShip, 
  getModelSuggestions, 
  VESSEL_EQUIPMENT_MASTER 
} from '../utils/vesselEquipmentMaster';

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
  const { isReadOnly, canPrint, isGuest, isVesselUser, user } = useAuth();
  const assignedShip = user?.assignedShip;
  const currentShipName = assignedShip || items.find(i => i.shipName)?.shipName || '';
  const isVesselMode = isVesselUser || !!assignedShip;

  const [activeRowDetails, setActiveRowDetails] = useState<string | null>(null);
  const [partNameSuggestions, setPartNameSuggestions] = useState<string[]>([]);
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);

  // 船員モード用の船長・機関長候補履歴
  const [captainHistory, setCaptainHistory] = useState<string[]>([]);
  const [chiefEngineerHistory, setChiefEngineerHistory] = useState<string[]>([]);

  // 船名に対応する船専用ローカルデータを読み込み
  useEffect(() => {
    if (currentShipName) {
      setCaptainHistory(getVesselCaptains(currentShipName));
      setChiefEngineerHistory(getVesselChiefEngineers(currentShipName));
    }
  }, [currentShipName]);

  // 船ログイン時、明細行の船名を自動固定セット
  useEffect(() => {
    if (assignedShip) {
      const needsUpdate = items.some(item => !item.shipName || item.shipName !== assignedShip);
      if (needsUpdate) {
        const updated = items.map(item => ({
          ...item,
          shipName: assignedShip
        }));
        onItemsChange(updated);
      }
    }
  }, [assignedShip]);

  // 発注履歴DBとサジェスト用参照元を常に統一
  const sourceHistories = histories;

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
  const uniqueEquipmentNames = Array.from(new Set([
    ...VESSEL_EQUIPMENT_MASTER.map(r => r.equipmentName),
    ...sourceHistories.map(h => h.equipmentName).filter(Boolean)
  ])) as string[];
  const uniqueManufacturerNames = Array.from(new Set(sourceHistories.map(h => h.manufacturer).filter(Boolean))) as string[];
  const uniqueModelNames = Array.from(new Set([
    ...VESSEL_EQUIPMENT_MASTER.map(r => r.model),
    ...sourceHistories.map(h => h.model).filter(Boolean)
  ])) as string[];
  const uniqueUnits = Array.from(new Set(sourceHistories.map(h => h.unit).filter(Boolean))) as string[];
  const allPartNumbers = Array.from(new Set(sourceHistories.map(h => h.partNumber).filter(Boolean))) as string[];

  // 一意の品名リストをあらかじめ抽出してサジェストに利用
  useEffect(() => {
    const names = Array.from(new Set(sourceHistories.map(h => h.partName)));
    setPartNameSuggestions(names);
  }, [sourceHistories]);

  // 新規行を1行追加（直前行の機器名・メーカー・型式・船名・分類を自動コピー引き継ぎ）
  const handleAddRow = () => {
    const lastItem = items.length > 0 ? items[items.length - 1] : null;
    const currentShip = lastItem?.shipName || header.shipName || currentShipName || assignedShip || '';
    const currentEquipment = lastItem?.equipmentName || '';
    const autoModel = currentEquipment ? (findModelByShipAndEquipment(currentShip, currentEquipment) || lastItem?.model || '') : (lastItem?.model || '');

    const newItem: OrderItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      partName: '',
      partNumber: '',
      quantity: '',
      unit: '',
      unitPrice: '',
      remark: '',
      isUrgent: false,
      orderCategory: lastItem?.orderCategory || '部品',
      shipName: currentShip,
      equipmentName: currentEquipment,
      manufacturer: lastItem?.manufacturer || '',
      model: autoModel
    };
    onItemsChange([...items, newItem]);
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

  // 船名の変更：ヘッダーおよび全アイテムの船名を一括更新＆機器名に応じた型式の一括自動連動
  const handleShipNameChange = (newShipName: string) => {
    onHeaderChange({ ...header, shipName: newShipName });
    const updated = items.map(item => {
      const matchedModel = findModelByShipAndEquipment(newShipName, item.equipmentName);
      return {
        ...item,
        shipName: newShipName,
        model: matchedModel || item.model
      };
    });
    onItemsChange(updated);
  };
  const sanitizeValue = (val: string | undefined | null): string => {
    if (!val) return '';
    const trimmed = val.trim();
    if (
      trimmed === '未指定' ||
      trimmed === '-' ||
      trimmed === 'ー' ||
      trimmed === '（未指定）' ||
      trimmed === 'メーカー未指定'
    ) {
      return '';
    }
    return trimmed;
  };

  // フォーカス時に「未指定」や「-」であれば全消去、それ以外の文字なら全選択してストレスなく直接上書きできるようにする
  const handleFocusAutoSelect = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (
      val === '未指定' ||
      val === '-' ||
      val === 'ー' ||
      val === '（未指定）' ||
      val === 'メーカー未指定'
    ) {
      e.target.value = '';
    } else {
      e.target.select();
    }
  };

  // 各セルの値変更
  const handleCellChange = (id: string, field: keyof OrderItem, value: any) => {
    // 船名の変更の場合：一回の注文で船名は統一されるため、全行の船名を一括更新
    if (field === 'shipName') {
      const updated = items.map(item => {
        const matchedModel = findModelByShipAndEquipment(value, item.equipmentName);
        return {
          ...item,
          shipName: value,
          model: matchedModel || item.model
        };
      });
      onItemsChange(updated);
      return;
    }

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

        // 機器名(equipmentName)変更時: 船名と機器名から型式(model)を自動検索してセット
        if (field === 'equipmentName') {
          const currentShip = item.shipName || header.shipName || currentShipName || assignedShip || '';
          const matchedModel = findModelByShipAndEquipment(currentShip, value);
          if (matchedModel) {
            updatedItem.model = matchedModel;
          }
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
    const matchingHistories = sourceHistories.filter(
      h => h.partName.toLowerCase().trim() === partName.toLowerCase().trim()
    );

    // 一度の注文で統一されている現在の船名を把握（上書き防止）
    const currentShip = items.find(i => i.shipName)?.shipName || assignedShip || '';

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
            partNumber: sanitizeValue(match.partNumber),
            unit: sanitizeValue(match.unit) || '個',
            unitPrice: match.unitPrice ?? '',
            // 船名は既に設定されている船名を絶対優先（変わらないように保持）
            shipName: currentShip || sanitizeValue(match.shipName),
            equipmentName: sanitizeValue(match.equipmentName) || item.equipmentName,
            manufacturer: sanitizeValue(match.manufacturer) || item.manufacturer,
            model: sanitizeValue(match.model) || item.model
          };
        } else if (partNumbers.length > 1) {
          // 部品番号の候補が複数ある場合
          const firstMatch = matchingHistories[0];
          return {
            ...baseItem,
            partNumber: '', // ユーザーにドロップダウンから選択してもらう
            unit: sanitizeValue(firstMatch.unit) || '個',
            unitPrice: firstMatch.unitPrice ?? '',
            // 船名は既に設定されている船名を絶対優先（変わらないように保持）
            shipName: currentShip || sanitizeValue(firstMatch.shipName),
            equipmentName: sanitizeValue(firstMatch.equipmentName) || item.equipmentName,
            manufacturer: sanitizeValue(firstMatch.manufacturer) || item.manufacturer,
            model: sanitizeValue(firstMatch.model) || item.model
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

    const currentShip = items.find(i => i.shipName)?.shipName || assignedShip || '';

    // 品名と部品番号が両方一致する履歴レコードを検索
    const match = sourceHistories.find(
      h => h.partName.toLowerCase().trim() === currentItem.partName.toLowerCase().trim() &&
           h.partNumber === partNumber
    );

    if (match) {
      const updated = items.map((item): OrderItem => {
        if (item.id === id) {
          return {
            ...item,
            partNumber: sanitizeValue(partNumber),
            unit: sanitizeValue(match.unit) || item.unit || '個',
            unitPrice: match.unitPrice ?? item.unitPrice ?? '',
            shipName: currentShip || sanitizeValue(match.shipName) || item.shipName,
            equipmentName: sanitizeValue(match.equipmentName) || item.equipmentName,
            manufacturer: sanitizeValue(match.manufacturer) || item.manufacturer,
            model: sanitizeValue(match.model) || item.model
          };
        }
        return item;
      });
      onItemsChange(updated);
    } else {
      // マッチがなくても、手動入力された部品番号を反映
      handleCellChange(id, 'partNumber', sanitizeValue(partNumber));
    }
  };

  // 行に紐づく品名の部品番号候補リストを取得
  const getPartNumberOptions = (partName: string): string[] => {
    if (!partName) return [];
    const matches = sourceHistories.filter(h => h.partName.toLowerCase().trim() === partName.toLowerCase().trim());
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

  const handlePreviewClickWithSave = () => {
    if (!canPrint) {
      alert('ゲストアカウントは閲覧専用のため、発注書の印刷・PDFプレビュー出力はできません。');
      return;
    }
    onPreviewClick();
  };

  return (
    <div className="space-y-6">
      {/* 閲覧のみ/ゲスト権限バナー */}
      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center justify-between text-amber-900 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-200 text-amber-800 rounded-lg">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs flex items-center gap-2">
                <span>{isGuest ? '【ゲストアクセス権限】' : '【閲覧のみ権限モード】'}</span>
                <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-mono">
                  {isGuest ? 'ゲスト (印刷制限)' : '閲覧のみ'}
                </span>
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                {isGuest 
                  ? '現在ゲストアカウントでログイン中です。全データの閲覧は可能ですが、発注入力・編集および印刷・PDF出力は禁止されています。'
                  : '現在のアカウントは「閲覧のみ」権限です。発注書の新規作成・内容編集はできません。印刷プレビューおよび履歴管理の閲覧・印刷機能をご利用いただけます。'}
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

          {isVesselMode ? (
            /* 船員用モード: 発注書No. ➔ 船長, 担当者 ➔ 機関長 */
            <>
              {/* 船長 (発注書Noの代わりに手入力＆クリックで選択) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1 font-bold text-slate-800">
                    <Ship className="h-3.5 w-3.5 text-emerald-600" />
                    船長名
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    船専用DB蓄積
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="船長名を入力/選択..."
                  list="vessel-captain-list"
                  className="block w-full rounded-md border-emerald-300 px-2 py-1.5 text-xs text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 bg-emerald-50/20 font-medium cursor-pointer"
                  value={header.captain || ''}
                  onChange={e => {
                    const val = e.target.value;
                    onHeaderChange({ ...header, captain: val });
                    if (currentShipName) saveVesselCaptain(currentShipName, val);
                  }}
                  onBlur={e => {
                    if (currentShipName) saveVesselCaptain(currentShipName, e.target.value);
                  }}
                />
                <datalist id="vessel-captain-list">
                  {captainHistory.map((opt, i) => (
                    <option key={`cap-${i}`} value={opt} />
                  ))}
                </datalist>
              </div>

              {/* 機関長 (担当者の代わりに手入力＆クリックで選択) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1 font-bold text-slate-800">
                    <Ship className="h-3.5 w-3.5 text-emerald-600" />
                    機関長名
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    船専用DB蓄積
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="機関長名を入力/選択..."
                  list="vessel-chief-engineer-list"
                  className="block w-full rounded-md border-emerald-300 px-2 py-1.5 text-xs text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 bg-emerald-50/20 font-medium cursor-pointer"
                  value={header.chiefEngineer || ''}
                  onChange={e => {
                    const val = e.target.value;
                    onHeaderChange({ ...header, chiefEngineer: val });
                    if (currentShipName) saveVesselChiefEngineer(currentShipName, val);
                  }}
                  onBlur={e => {
                    if (currentShipName) saveVesselChiefEngineer(currentShipName, e.target.value);
                  }}
                />
                <datalist id="vessel-chief-engineer-list">
                  {chiefEngineerHistory.map((opt, i) => (
                    <option key={`ce-${i}`} value={opt} />
                  ))}
                </datalist>
              </div>
            </>
          ) : (
            /* 通常陸上モード: 船名 & 担当者 */
            <>
              {/* 船名 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1 font-bold text-slate-800">
                    <Ship className="h-3.5 w-3.5 text-indigo-600" />
                    船名 <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[10px] text-indigo-600 font-semibold">(選択/手入力)</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="船名を入力/選択..."
                  list="header-ship-names-list"
                  className="block w-full rounded-md border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white"
                  value={header.shipName ?? (items[0]?.shipName || currentShipName || '')}
                  onChange={e => handleShipNameChange(e.target.value)}
                  onFocus={handleFocusAutoSelect}
                />
                <datalist id="header-ship-names-list">
                  {shipNames.map(name => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
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
            </>
          )}

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
        <div className="border-b border-slate-100 bg-slate-50/50 px-4 sm:px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-semibold text-slate-800 text-base">発注部品明細入力</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isVesselMode
                ? '品名を入力すると、本船で過去に発注された項目（機器・メーカー・規格等）から自動候補が表示されます。'
                : '品名を入力すると、過去の発注履歴（船・機器・メーカー・規格等）を自動分析して補完します。'
              }
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddRow}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors cursor-pointer w-full sm:w-auto justify-center"
          >
            <Plus className="h-4 w-4" />
            行を追加する
          </button>
        </div>

        {/* 【スマホ・モバイル用】カードスタイル入力一覧 (md:hidden) */}
        <div className="block md:hidden p-4 space-y-4 bg-slate-50/70">
          {items.map((item, index) => {
            const partNoOptions = getPartNumberOptions(item.partName);
            const lineAmount = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);

            return (
              <div key={`mobile-${item.id}`} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
                {/* ヘッダー: 行番号, 至急, 分類, 削除 */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-800 text-white font-mono text-xs font-bold px-2 py-0.5 rounded-md">
                      #{index + 1}
                    </span>
                    <label className="flex items-center gap-1 cursor-pointer bg-rose-50 border border-rose-200 text-rose-700 px-2 py-0.5 rounded text-xs font-bold">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                        checked={!!item.isUrgent}
                        onChange={e => handleCellChange(item.id, 'isUrgent', e.target.checked)}
                      />
                      <span>至急</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      className="rounded border-indigo-200 text-xs font-bold text-indigo-900 bg-indigo-50 px-2 py-1"
                      value={item.orderCategory || '部品'}
                      onChange={e => handleCellChange(item.id, 'orderCategory', e.target.value as OrderCategory)}
                    >
                      <option value="船用品">船用品</option>
                      <option value="部品">部品</option>
                      <option value="潤滑油">潤滑油</option>
                      <option value="廃油処理">廃油処理</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleRemoveRow(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="行を削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* 品名 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    品名 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="例: インペラ, Oリング..."
                    className="block w-full rounded-md border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white font-medium"
                    value={item.partName}
                    onChange={e => {
                      handleCellChange(item.id, 'partName', e.target.value);
                      handlePartNameSelect(item.id, e.target.value);
                    }}
                    onFocus={handleFocusAutoSelect}
                    list={`mobile-part-names-${item.id}`}
                  />
                  <datalist id={`mobile-part-names-${item.id}`}>
                    {partNameSuggestions.map(name => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>

                {/* 部品番号・規格 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    部品番号・規格
                  </label>
                  <input
                    type="text"
                    placeholder="例: P-24, 12345-6789..."
                    className="block w-full rounded-md border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white"
                    value={item.partNumber}
                    onChange={e => handleCellChange(item.id, 'partNumber', e.target.value)}
                    onFocus={handleFocusAutoSelect}
                    list={`mobile-part-numbers-${item.id}`}
                  />
                  <datalist id={`mobile-part-numbers-${item.id}`}>
                    {partNoOptions.map(opt => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
                </div>

                {/* 数量 / 単位 / 単価 */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">数量</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="1"
                      className="block w-full rounded-md border-slate-300 px-2 py-1.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-right"
                      value={item.quantity}
                      onChange={e => handleCellChange(item.id, 'quantity', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">単位</label>
                    <input
                      type="text"
                      placeholder="個"
                      className="block w-full rounded-md border-slate-300 px-2 py-1.5 text-sm text-center text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      value={item.unit}
                      onChange={e => handleCellChange(item.id, 'unit', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">単価(円)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      className="block w-full rounded-md border-slate-300 px-2 py-1.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-right"
                      value={item.unitPrice}
                      onChange={e => handleCellChange(item.id, 'unitPrice', e.target.value)}
                    />
                  </div>
                </div>

                {/* 小計金額 & 備考 */}
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg text-xs">
                  <span className="text-slate-500 font-semibold">小計金額:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">¥{lineAmount.toLocaleString()}</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">備考</label>
                  <input
                    type="text"
                    placeholder="例: 予備用"
                    className="block w-full rounded-md border-slate-300 px-3 py-1.5 text-xs text-slate-800"
                    value={item.remark}
                    onChange={e => handleCellChange(item.id, 'remark', e.target.value)}
                  />
                </div>

                {/* 詳細情報 (常時表示) */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3 text-xs">
                  <div className="text-[11px] font-bold text-indigo-900 border-b border-slate-200 pb-1 flex items-center justify-between">
                    <span>📋 機器名・型式・メーカー</span>
                    <span className="text-[10px] text-slate-500 font-normal">常時入力</span>
                  </div>

                  {/* 1. 機器名 */}
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">機器名</label>
                    <input
                      type="text"
                      placeholder="例: 主機関"
                      className="w-full rounded border-slate-300 p-2 text-xs bg-white"
                      value={item.equipmentName}
                      onChange={e => handleCellChange(item.id, 'equipmentName', e.target.value)}
                      onFocus={handleFocusAutoSelect}
                    />
                  </div>

                  {/* 2. 型式 */}
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">型式</label>
                    <input
                      type="text"
                      placeholder="例: 6EY26W"
                      className="w-full rounded border-slate-300 p-2 text-xs bg-white"
                      value={item.model}
                      onChange={e => handleCellChange(item.id, 'model', e.target.value)}
                      onFocus={handleFocusAutoSelect}
                    />
                  </div>

                  {/* 3. メーカー (発注先) */}
                  <div>
                    <label className="block font-bold text-slate-600 mb-1">メーカー (発注先)</label>
                    <input
                      type="text"
                      placeholder="例: ヤンマー"
                      className="w-full rounded border-slate-300 p-2 text-xs bg-white font-semibold"
                      value={item.manufacturer}
                      onChange={e => handleCellChange(item.id, 'manufacturer', e.target.value)}
                      onFocus={handleFocusAutoSelect}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={handleAddRow}
            className="w-full py-3 bg-white border-2 border-dashed border-indigo-300 text-indigo-700 font-bold rounded-xl text-xs hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>明細行をさらに追加する</span>
          </button>
        </div>

        {/* 【デスクトップ・PC用】テーブル表示 (hidden md:block) */}
        <div className="hidden md:block overflow-x-auto">
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
                <th scope="col" className="w-16 px-2 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">削除</th>
              </tr>
            </thead>
            
            <tbody className="bg-white divide-y-0">
              {items.map((item, index) => {
                const partNoOptions = getPartNumberOptions(item.partName);
                const showPartNoDropdown = partNoOptions.length > 1;
                const lineAmount = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                const isOdd = index % 2 === 1;
                // 1項目（メイン＋サブ）全体で統一する背景色
                const rowBgClass = focusedRowId === item.id 
                  ? 'bg-indigo-50/40' 
                  : (isOdd ? 'bg-slate-50/80' : 'bg-white');

                return (
                  <React.Fragment key={item.id}>
                    {/* メイン入力行 (1段目) */}
                    <tr className={`${rowBgClass} transition-colors`}>
                      {/* 行番号 */}
                      <td className="px-2 py-2.5 text-center font-bold text-slate-600 text-xs font-mono border-t border-slate-200">
                        No.{index + 1}
                      </td>

                      {/* 至急チェックボックス */}
                      <td className="px-1 py-2.5 text-center border-t border-slate-200">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                          checked={!!item.isUrgent}
                          onChange={e => handleCellChange(item.id, 'isUrgent', e.target.checked)}
                          title="この部品を至急発注にする"
                        />
                      </td>

                      {/* 注文の分類 */}
                      <td className="px-1.5 py-2.5 border-t border-slate-200">
                        <select
                          className="block w-full rounded border-slate-300 px-1.5 py-1 text-xs font-semibold text-indigo-950 bg-white shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
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
                      <td className="px-2.5 py-2.5 border-t border-slate-200">
                        <div className="relative">
                          <input
                            type="text"
                            required
                            placeholder="品名を入力してください..."
                            className="block w-full rounded-md border-slate-300 px-2 py-1 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white font-medium"
                            value={item.partName}
                            onChange={e => {
                              handleCellChange(item.id, 'partName', e.target.value);
                              handlePartNameSelect(item.id, e.target.value);
                            }}
                            onFocus={(e) => {
                              handleFocusAutoSelect(e);
                              setFocusedRowId(item.id);
                            }}
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
                      <td className="px-2.5 py-2.5 border-t border-slate-200">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder={partNoOptions.length > 0 ? `規格候補${partNoOptions.length}件` : "自動入力または手入力..."}
                            className={`block w-full rounded-md px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 ${
                              partNoOptions.length > 1
                                ? 'border-indigo-400 bg-indigo-50/50 text-indigo-950 font-medium'
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
                            onFocus={(e) => {
                              handleFocusAutoSelect(e);
                              setFocusedRowId(item.id);
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
                        </div>
                      </td>

                      {/* 数量 */}
                      <td className="px-2 py-2.5 border-t border-slate-200">
                        <input
                          type="number"
                          required
                          min="1"
                          placeholder="数量"
                          className="block w-full rounded-md border-slate-300 px-2 py-1 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-right bg-white"
                          value={item.quantity}
                          onChange={e => handleCellChange(item.id, 'quantity', e.target.value)}
                          onFocus={(e) => {
                            handleFocusAutoSelect(e);
                            setFocusedRowId(item.id);
                          }}
                        />
                      </td>

                      {/* 単位 */}
                      <td className="px-1.5 py-2.5 border-t border-slate-200">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="個,セット等"
                            className="block w-full rounded-md border-slate-300 px-1 py-1 text-sm font-semibold text-center text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white"
                            value={item.unit}
                            onChange={e => handleCellChange(item.id, 'unit', e.target.value)}
                            onFocus={(e) => {
                              handleFocusAutoSelect(e);
                              setFocusedRowId(item.id);
                            }}
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
                      <td className="px-2 py-2.5 border-t border-slate-200">
                        <input
                          type="number"
                          min="0"
                          placeholder="単価 (円)"
                          className="block w-full rounded-md border-slate-300 px-2 py-1 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-right bg-white"
                          value={item.unitPrice}
                          onChange={e => handleCellChange(item.id, 'unitPrice', e.target.value)}
                          onFocus={(e) => {
                            handleFocusAutoSelect(e);
                            setFocusedRowId(item.id);
                          }}
                        />
                      </td>

                      {/* 金額 */}
                      <td className="px-2 py-2.5 text-right font-bold text-slate-800 bg-slate-100/40 border-t border-slate-200">
                        ¥{lineAmount.toLocaleString()}
                      </td>

                      {/* 備考 */}
                      <td className="px-2 py-2.5 border-t border-slate-200">
                        <input
                          type="text"
                          placeholder="例: 予備用"
                          className="block w-full rounded-md border-slate-300 px-2 py-1 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white"
                          value={item.remark}
                          onChange={e => handleCellChange(item.id, 'remark', e.target.value)}
                          onFocus={(e) => {
                            handleFocusAutoSelect(e);
                            setFocusedRowId(item.id);
                          }}
                        />
                      </td>

                      {/* 行削除ボタン */}
                      <td className="px-2 py-2.5 text-center border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(item.id)}
                          className="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="この明細行を削除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>

                    {/* 2段目サブ入力行 (機器名・型式・メーカー) - メイン行と一体化 */}
                    <tr className={`${rowBgClass} border-b-2 border-slate-300 transition-colors`}>
                      <td className="px-2 py-2 text-center text-slate-300 font-mono text-xs select-none">
                      </td>
                      <td colSpan={10} className="px-3 pb-3 pt-0.5">
                        <div className="bg-slate-100/70 p-2.5 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* 1. 機器名 */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                              機器名
                            </label>
                            <input
                              type="text"
                              placeholder="例: 主機関"
                              className="block w-full rounded border-slate-300 px-2.5 py-1 text-xs text-slate-800 bg-white shadow-sm focus:ring-1 focus:ring-indigo-500"
                              value={item.equipmentName}
                              onChange={e => handleCellChange(item.id, 'equipmentName', e.target.value)}
                              onFocus={(e) => {
                                handleFocusAutoSelect(e);
                                setFocusedRowId(item.id);
                              }}
                              list={`equipment-names-${item.id}`}
                            />
                            <datalist id={`equipment-names-${item.id}`}>
                              {uniqueEquipmentNames.map(name => (
                                <option key={name} value={name} />
                              ))}
                            </datalist>
                          </div>

                          {/* 2. 型式 */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                              型式
                            </label>
                            <input
                              type="text"
                              placeholder="例: 6EY26W"
                              className="block w-full rounded border-slate-300 px-2.5 py-1 text-xs text-slate-800 bg-white shadow-sm focus:ring-1 focus:ring-indigo-500"
                              value={item.model}
                              onChange={e => handleCellChange(item.id, 'model', e.target.value)}
                              onFocus={(e) => {
                                handleFocusAutoSelect(e);
                                setFocusedRowId(item.id);
                              }}
                              list={`model-names-${item.id}`}
                            />
                            <datalist id={`model-names-${item.id}`}>
                              {uniqueModelNames.map(name => (
                                <option key={name} value={name} />
                              ))}
                            </datalist>
                          </div>

                          {/* 3. メーカー (発注先) */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                              メーカー (発注先)
                            </label>
                            <input
                              type="text"
                              placeholder="例: ヤンマー"
                              className="block w-full rounded border-slate-300 px-2.5 py-1 text-xs text-slate-800 bg-white shadow-sm focus:ring-1 focus:ring-indigo-500 font-medium"
                              value={item.manufacturer}
                              onChange={e => handleCellChange(item.id, 'manufacturer', e.target.value)}
                              onFocus={(e) => {
                                handleFocusAutoSelect(e);
                                setFocusedRowId(item.id);
                              }}
                              list={`manufacturer-names-${item.id}`}
                            />
                            <datalist id={`manufacturer-names-${item.id}`}>
                              {uniqueManufacturerNames.map(name => (
                                <option key={name} value={name} />
                              ))}
                            </datalist>
                          </div>
                        </div>
                      </td>
                    </tr>
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

        <div className="shrink-0 text-right">
          <button
            type="button"
            onClick={handlePreviewClickWithSave}
            disabled={items.some(i => !i.partName)}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold shadow-sm transition-all disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed ${
              canPrint
                ? 'bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer'
                : 'bg-slate-700 text-slate-300 border border-slate-600 cursor-pointer'
            }`}
          >
            {canPrint ? <FileText className="h-5 w-5" /> : <Lock className="h-5 w-5 text-amber-400" />}
            <span>{canPrint ? '発注書を分割プレビューする' : '発注書プレビュー (ゲスト制限中)'}</span>
          </button>
          {!canPrint && (
            <p className="text-[10px] text-amber-300 text-center md:text-right mt-1.5">
              ※ゲスト権限のため印刷・PDFプレビュー出力はできません
            </p>
          )}
          {canPrint && items.some(i => !i.partName) && (
            <p className="text-[10px] text-rose-400 text-center md:text-right mt-1.5">※すべての行に品名を入力してください</p>
          )}
        </div>
      </div>
    </div>
  );
}
