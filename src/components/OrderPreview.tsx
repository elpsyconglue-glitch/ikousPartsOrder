import React, { useMemo, useRef } from 'react';
import { OrderItem, OrderHeader, OrderCategory, PartHistory, ORDER_CATEGORY_TITLE_MAP } from '../types';
import { Printer, ChevronLeft, Download, AlertCircle, Lock } from 'lucide-react';
import { generateOrderNo } from '../utils/orderNoHelper';
import { registerNewItemsToHistories, getPartHistories } from '../utils/csvHelper';
import { saveVesselCaptain, saveVesselChiefEngineer, saveVesselHistories } from '../utils/vesselStorage';
import { useAuth } from '../auth/AuthContext';

interface OrderPreviewProps {
  header: OrderHeader;
  items: OrderItem[];
  histories: PartHistory[];
  onHistoriesChange: (newHistories: PartHistory[]) => void;
  onBackClick: () => void;
}

interface OrderGroup {
  key: string;
  manufacturer: string;
  category: OrderCategory;
  shipName: string;
  orderNo: string;
  items: OrderItem[];
}

export default function OrderPreview({ header, items, histories, onHistoriesChange, onBackClick }: OrderPreviewProps) {
  const { canPrint } = useAuth();
  // 金額・単価を表示するかどうかの状態（デフォルトは true）
  const [showPrice, setShowPrice] = React.useState<boolean>(true);
  // 特定の1枚のみを印刷対象にするキー
  const [singlePrintKey, setSinglePrintKey] = React.useState<string | null>(null);

  // コンポーネントマウント時の histories スナップショットを保持し、無限ループを防止
  const initialHistoriesRef = useRef(histories);
  const hasSavedRef = useRef(false);

  // メーカー（発注先）、注文分類（カテゴリ）、船名ごとに明細行をグループ化＆個別発注書Noを安定固定で採番
  const orderGroups = useMemo<OrderGroup[]>(() => {
    const groupsMap = new Map<string, {
      key: string;
      manufacturer: string;
      category: OrderCategory;
      shipName: string;
      items: OrderItem[];
    }>();

    items.forEach(item => {
      const mfg = item.manufacturer.trim() || '（手入力用発注先）';
      const category: OrderCategory = item.orderCategory || header.orderCategory || '部品';
      const shipName = item.shipName || '未指定';
      const groupKey = `${mfg}___${category}___${shipName}`;

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          key: groupKey,
          manufacturer: mfg,
          category,
          shipName,
          items: []
        });
      }
      groupsMap.get(groupKey)!.items.push(item);
    });

    const rawGroups = Array.from(groupsMap.values());

    // 同一の（船名 × 注文分類）のグループ数をカウントして offset 連番を計算
    const shipCategoryCounts = new Map<string, number>();

    return rawGroups.map(group => {
      const shipCategoryKey = `${group.shipName}___${group.category}`;
      const currentOffset = shipCategoryCounts.get(shipCategoryKey) || 0;
      shipCategoryCounts.set(shipCategoryKey, currentOffset + 1);

      // 手入力による指定があればそれをベースにし、無ければ【Run2026-B1】形式を自動生成
      let assignedOrderNo = header.orderNo.trim();
      if (!assignedOrderNo) {
        assignedOrderNo = generateOrderNo(
          initialHistoriesRef.current,
          group.shipName,
          group.category,
          header.date,
          currentOffset
        );
      } else if (rawGroups.length > 1) {
        assignedOrderNo = `${assignedOrderNo}-${currentOffset + 1}`;
      }

      return {
        ...group,
        orderNo: assignedOrderNo
      };
    });
  }, [items, header]);

  // 印刷時に1度だけ発注書No付きで予算集計（履歴）へ保存登録する（金額あり/なし両方押しても重複追加しない）
  const saveToHistories = () => {
    if (hasSavedRef.current) return;

    const itemsWithGroupOrderNo: OrderItem[] = [];
    orderGroups.forEach(group => {
      group.items.forEach(item => {
        itemsWithGroupOrderNo.push({
          ...item,
          orderNo: group.orderNo
        });
      });
    });

    if (itemsWithGroupOrderNo.length > 0) {
      hasSavedRef.current = true;
      const currentHistories = getPartHistories();
      const updated = registerNewItemsToHistories(currentHistories, itemsWithGroupOrderNo, header.date);
      onHistoriesChange(updated);

      // 印刷実行（確定）のタイミングでのみ船専用ローカルDBにも正式登録
      const currentShip = items.find(i => i.shipName)?.shipName || header.shipName;
      if (currentShip) {
        if (header.captain) saveVesselCaptain(currentShip, header.captain);
        if (header.chiefEngineer) saveVesselChiefEngineer(currentShip, header.chiefEngineer);
        saveVesselHistories(currentShip, itemsWithGroupOrderNo, header.date);
      }
    }
  };

  // 全枚まとめて印刷・PDF出力（金額あり）
  const handlePrintWithPrice = () => {
    if (!canPrint) {
      alert('ゲストアカウントは閲覧専用のため、発注書の印刷・PDF保存はできません。');
      return;
    }
    saveToHistories();
    setShowPrice(true);
    setSinglePrintKey(null);
    setTimeout(() => {
      window.print();
    }, 50);
  };

  // 全枚まとめて印刷・PDF出力（金額なし）
  const handlePrintWithoutPrice = () => {
    if (!canPrint) {
      alert('ゲストアカウントは閲覧専用のため、発注書の印刷・PDF保存はできません。');
      return;
    }
    saveToHistories();
    setShowPrice(false);
    setSinglePrintKey(null);
    setTimeout(() => {
      window.print();
    }, 50);
  };

  // 指定された特定の発注書1枚のみを印刷・PDF出力
  const handlePrintSingle = (groupKey: string, withPrice: boolean) => {
    if (!canPrint) {
      alert('ゲストアカウントは閲覧専用のため、発注書の印刷・PDF保存はできません。');
      return;
    }
    saveToHistories();
    setShowPrice(withPrice);
    setSinglePrintKey(groupKey);
    setTimeout(() => {
      window.print();
      setSinglePrintKey(null);
    }, 50);
  };

  return (
    <div className="space-y-6">
      {/* 操作バー（画面上のみ表示） */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 print:hidden space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <button
            type="button"
            onClick={onBackClick}
            className="inline-flex items-center gap-1.5 rounded-md bg-white border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
            入力画面に戻る
          </button>

          {/* 表示切り替え ＆ 印刷・PDF保存ボタン群 */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* 金額ありボタン */}
            <button
              type="button"
              onClick={handlePrintWithPrice}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold shadow-sm transition-all ${
                !canPrint
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                  : showPrice
                  ? 'bg-indigo-600 text-white hover:bg-indigo-500 ring-2 ring-indigo-600 ring-offset-1 cursor-pointer'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 cursor-pointer'
              }`}
            >
              {canPrint ? <Printer className="h-4 w-4" /> : <Lock className="h-4 w-4 text-amber-600" />}
              <span>【金額を入れる】印刷 / PDF保存</span>
            </button>

            {/* 金額なし（空欄）ボタン */}
            <button
              type="button"
              onClick={handlePrintWithoutPrice}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold shadow-sm transition-all ${
                !canPrint
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                  : !showPrice
                  ? 'bg-slate-800 text-white hover:bg-slate-700 ring-2 ring-slate-800 ring-offset-1 cursor-pointer'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 cursor-pointer'
              }`}
            >
              {canPrint ? <Printer className="h-4 w-4" /> : <Lock className="h-4 w-4 text-amber-600" />}
              <span>【金額を入れない (空欄)】印刷 / PDF保存</span>
            </button>
          </div>
        </div>

        {/* ガイドメッセージ */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">💡 印刷およびPDFとして保存する方法</p>
            <p className="leading-relaxed">
              上のボタンを押すとブラウザの印刷画面が開きます。
              <strong className="underline decoration-amber-500 underline-offset-2 ml-1">
                送信先（プリンター）を「PDFに保存」
              </strong>
              に変更すると、パソコン内にPDFファイルとして保存できます。プリンターを選択すればそのまま紙に印刷されます。
            </p>
            <p className="text-[11px] text-amber-800">
              ※【印刷 / PDF保存】ボタンを押したタイミングで「発注履歴＆予算集計」へ自動記録されます。金額あり・なしのどちらを何度押しても重複して登録されることはありません。
            </p>
          </div>
        </div>
      </div>

      {/* メーカー・分類別の発注書プレビューエリア */}
      <div id="order-preview-print-area" className="space-y-8 print:space-y-0">
        {orderGroups.map((group, groupIndex) => {
          const mfg = group.manufacturer;
          const category = group.category;
          const mfgItems = group.items;
          
          // この発注書における合計金額の計算
          const totalAmount = mfgItems.reduce((sum, item) => {
            const qty = Number(item.quantity) || 0;
            const price = Number(item.unitPrice) || 0;
            return sum + qty * price;
          }, 0);

          // 船名、機器名、形式の一意な値を抽出して表示
          const uniqueShips = Array.from(new Set(mfgItems.map(i => i.shipName).filter(Boolean)));
          const uniqueEquipments = Array.from(new Set(mfgItems.map(i => i.equipmentName).filter(Boolean)));
          const uniqueModels = Array.from(new Set(mfgItems.map(i => i.model).filter(Boolean)));

          const displayShip = uniqueShips.length > 0 ? uniqueShips.join(' / ') : '';
          const displayEquipment = uniqueEquipments.length > 0 ? uniqueEquipments.join(' / ') : '';
          const displayModel = uniqueModels.length > 0 ? uniqueModels.join(' / ') : '';

          // PDFの用紙の合計行数を再現（A4 1枚に完璧に収まるよう12行に調整）
          const TOTAL_ROWS = 12;
          const emptyRowsCount = Math.max(0, TOTAL_ROWS - mfgItems.length);
          const emptyRows = Array.from({ length: emptyRowsCount });

          const isHiddenInPrint = singlePrintKey !== null && singlePrintKey !== group.key;

          return (
            <div 
              key={group.key} 
              className={`bg-white rounded-xl border border-slate-300 shadow-md p-6 max-w-[840px] mx-auto relative overflow-hidden print:shadow-none print:border-none print:p-0 print:m-0 print:rounded-none print:max-w-none print:bg-transparent page-break order-sheet-page ${
                isHiddenInPrint ? 'print:hidden' : ''
              }`}
              style={{ 
                pageBreakAfter: (groupIndex < orderGroups.length - 1 && singlePrintKey === null) ? 'always' : 'avoid',
                breakAfter: (groupIndex < orderGroups.length - 1 && singlePrintKey === null) ? 'page' : 'avoid'
              }}
            >
              {/* 各発注書ごとの個別印刷・PDF出力ヘッダーバー（画面表示時のみ） */}
              <div className="mb-4 pb-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2.5 print:hidden bg-slate-50 -mx-6 -mt-6 p-4 rounded-t-xl">
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shrink-0">
                    {groupIndex + 1} / {orderGroups.length}枚目
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    【{mfg} - {ORDER_CATEGORY_TITLE_MAP[category] || '部品注文書'}】
                  </span>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handlePrintSingle(group.key, true)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md border shadow-sm transition-all cursor-pointer ${
                      !canPrint
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed border-slate-300'
                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200'
                    }`}
                    title="この発注書1枚のみを金額ありで印刷/PDF保存"
                  >
                    {canPrint ? <Printer className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5 text-amber-600" />}
                    <span>この1枚のみ印刷 (金額あり)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePrintSingle(group.key, false)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md border shadow-sm transition-all cursor-pointer ${
                      !canPrint
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed border-slate-300'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                    }`}
                    title="この発注書1枚のみを金額空欄で印刷/PDF保存"
                  >
                    {canPrint ? <Printer className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5 text-amber-600" />}
                    <span>この1枚のみ印刷 (金額なし)</span>
                  </button>
                </div>
              </div>

              {/* PDF再現部 */}
              <div className="text-slate-900 font-sans leading-snug" style={{ fontSize: '12px' }}>
                
                {/* 1. タイトル ＆ 管理文書番号 */}
                <div className="mb-4 relative pt-3">
                  {/* 管理文書番号 */}
                  <div className="absolute left-0 top-0 text-[10px] font-semibold text-slate-800 tracking-wider">
                    管理文書番号Ikous 08 I 04
                  </div>

                  {(header.isUrgent || mfgItems.some(i => i.isUrgent)) && (
                    <div className="absolute left-0 top-5 text-red-600 font-bold border-2 border-red-600 px-2.5 py-0.5 text-xs rounded tracking-wider rotate-[-5deg] print:border-red-600 print:text-red-600">
                      至急
                    </div>
                  )}

                  <div className="text-center">
                    <h1 className="text-xl font-bold tracking-[0.2em] inline-block pb-1 border-b-4 border-double border-slate-900">
                      {ORDER_CATEGORY_TITLE_MAP[category] || '部品注文書'}
                    </h1>
                  </div>
                </div>

                {/* 2. 宛名・自社情報・発注情報ヘッダー */}
                <div className="grid grid-cols-12 gap-3 mb-3">
                  {/* 左上: 宛名・TEL/FAX */}
                  <div className="col-span-7 space-y-1.5">
                    <div className="border-b-2 border-slate-900 pb-0.5 flex items-end">
                      <span className="text-base font-bold mr-2">{mfg}</span>
                      <span className="text-sm font-semibold">御中</span>
                    </div>
                    <div className="text-[11px] space-y-0.5">
                      <div>TEL：0896-28-1755　FAX：0896-28-1713</div>
                      <div className="font-semibold text-slate-800">下記の通り発注いたします。</div>
                    </div>

                    {/* 船名などの情報エリア (PDFそっくりの二重線・ドット罫線) */}
                    <div className="space-y-0.5 pt-0.5 text-[11px]">
                      <div className="flex border-b border-dotted border-slate-400 pb-0.5">
                        <span className="w-16 shrink-0 font-medium">船名：</span>
                        <span className="font-semibold text-slate-800">{displayShip}</span>
                      </div>
                      <div className="flex border-b border-dotted border-slate-400 pb-0.5">
                        <span className="w-16 shrink-0 font-medium">機器名：</span>
                        <span className="font-semibold text-slate-800">{displayEquipment}</span>
                      </div>
                      <div className="flex border-b border-dotted border-slate-400 pb-0.5">
                        <span className="w-16 shrink-0 font-medium">ﾒｰｶｰ：</span>
                        <span className="font-semibold text-slate-800">{mfg}</span>
                      </div>
                      <div className="flex border-b border-dotted border-slate-400 pb-0.5">
                        <span className="w-16 shrink-0 font-medium">形式：</span>
                        <span className="font-semibold text-slate-800">{displayModel}</span>
                      </div>
                      <div className="flex border-b-2 border-slate-900 pb-0.5 font-bold">
                        <span className="w-16 shrink-0">合計金額：</span>
                        {showPrice ? (
                          <span className="text-xs">¥{totalAmount.toLocaleString()} -</span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-normal">（※業者様にてご記入ください）</span>
                        )}
                      </div>
                      <div className="flex border-b border-dotted border-slate-400 pb-0.5">
                        <span className="w-16 shrink-0 font-medium">納品期限：</span>
                        <span>{header.limitDate && header.limitDate.trim() !== '' ? header.limitDate : '-'}</span>
                      </div>
                      <div className="flex border-b-2 border-slate-900 pb-0.5">
                        <span className="w-16 shrink-0 font-medium">納品場所：</span>
                        <span>{header.place && header.place.trim() !== '' ? header.place : '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* 右上: 発注日・発注書No・自社ロゴ */}
                  <div className="col-span-5 flex flex-col justify-between pl-2">
                    {/* 発注日・No枠 */}
                    <table className="w-full border-collapse border border-slate-900 text-[11px] text-center mb-2">
                      <tbody>
                        <tr>
                          <td className="border border-slate-900 bg-slate-50 px-1.5 py-0.5 font-medium w-1/3">発注年月日</td>
                          <td className="border border-slate-900 px-1.5 py-0.5">{header.date || '-'}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-900 bg-slate-50 px-1.5 py-0.5 font-medium">
                            {header.captain ? '船長' : '発注書No.'}
                          </td>
                          <td className="border border-slate-900 px-1.5 py-0.5 font-bold">
                            {header.captain || group.orderNo}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* 自社住所 */}
                    <div className="border border-dashed border-slate-900 p-2 rounded bg-white text-[11px] space-y-0.5">
                      <div className="font-bold text-xs">株式会社 イコーズ</div>
                      <div className="text-slate-600 text-[10px]">
                        住所：〒745-0034<br />
                        <span className="pl-7">山口県周南市御幸通2-12秋本ビル4F</span>
                      </div>
                      <div className="text-[10px]">TEL： 0834-27-6551</div>
                      <div className="text-[10px]">FAX： 0834-27-6545</div>
                      <div className="font-medium flex items-center pt-0.5 border-t border-dashed border-slate-200">
                        <span>{header.chiefEngineer ? '機関長：' : '担当：'}</span>
                        <span className="text-xs font-bold border-b border-slate-900 px-1 flex-1">
                          {header.chiefEngineer || header.staff || '大野隆太'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. 明細テーブル */}
                <table className="w-full border-collapse border-2 border-slate-950 text-[11px] table-fixed">
                  <thead>
                    <tr className="bg-slate-100 text-center border-b-2 border-slate-950">
                      <th className="border border-slate-900 py-1 font-bold text-[10px]" style={{ width: '4%' }}>No.</th>
                      <th className="border border-slate-900 py-1 font-bold text-[10px]" style={{ width: '29%' }}>品名</th>
                      <th className="border border-slate-900 py-1 font-bold text-[10px]" style={{ width: '23%' }}>部品番号・規格</th>
                      <th className="border border-slate-900 py-1 font-bold text-[10px]" style={{ width: '7%' }}>数量</th>
                      <th className="border border-slate-900 py-1 font-bold text-[10px]" style={{ width: '10%' }}>単位</th>
                      <th className="border border-slate-900 py-1 font-bold text-[10px]" style={{ width: '12%' }}>単価</th>
                      <th className="border border-slate-900 py-1 font-bold text-[10px]" style={{ width: '13%' }}>金額</th>
                      <th className="border border-slate-900 py-1 font-bold text-[10px]" style={{ width: '12%' }}>備考</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 実データ行 */}
                    {mfgItems.map((item, idx) => {
                      const amount = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                      return (
                        <tr key={item.id} className="text-slate-800 hover:bg-slate-50/50">
                          <td className="border border-slate-400 py-0.5 text-center font-medium">{idx + 1}</td>
                          <td className="border border-slate-400 px-1.5 py-0.5 truncate font-medium text-[10px]">{item.partName}</td>
                          <td className="border border-slate-400 px-1.5 py-0.5 truncate font-mono text-[9px]">{item.partNumber || '-'}</td>
                          <td className="border border-slate-400 py-0.5 text-right pr-1.5 font-medium">{item.quantity || ''}</td>
                          <td className="border border-slate-400 py-0.5 px-0.5 text-center font-semibold text-[10px] text-slate-900 whitespace-nowrap">{item.unit || ''}</td>
                          <td className="border border-slate-400 py-0.5 text-right pr-1.5 font-mono text-[10px]">
                            {showPrice && item.unitPrice !== '' ? Number(item.unitPrice).toLocaleString() : ''}
                          </td>
                          <td className="border border-slate-400 py-0.5 text-right pr-1.5 font-mono font-medium text-[10px]">
                            {showPrice ? (amount > 0 ? amount.toLocaleString() : '0') : ''}
                          </td>
                          <td className={`border border-slate-400 px-1.5 py-0.5 truncate text-[9px] ${item.isUrgent ? 'text-red-600 font-bold' : ''}`}>
                            {item.isUrgent && <span className="text-red-600 font-bold mr-0.5 inline-block">【至急】</span>}
                            {item.remark || ''}
                          </td>
                        </tr>
                      );
                    })}

                    {/* A4高さを補う空の罫線行（PDFのデザインを模写） */}
                    {emptyRows.map((_, idx) => {
                      const rowNum = mfgItems.length + idx + 1;
                      return (
                        <tr key={`empty-${idx}`} className="h-[21px]">
                          <td className="border border-slate-300 text-center text-slate-300 text-[9px]">{rowNum}</td>
                          <td className="border border-slate-300 px-1.5 py-0.5"></td>
                          <td className="border border-slate-300 px-1.5 py-0.5"></td>
                          <td className="border border-slate-300 py-0.5"></td>
                          <td className="border border-slate-300 py-0.5"></td>
                          <td className="border border-slate-300 py-0.5"></td>
                          <td className="border border-slate-300 py-0.5"></td>
                          <td className="border border-slate-300 px-1.5 py-0.5"></td>
                        </tr>
                      );
                    })}

                    {/* 合計金額フッター行 */}
                    <tr className="border-t-2 border-slate-950 font-bold bg-slate-50">
                      <td colSpan={5} className="border border-slate-900 text-right pr-3 py-1 text-xs">
                        合計金額
                      </td>
                      <td colSpan={2} className="border border-slate-900 text-right pr-2 py-1 text-xs text-slate-900 font-mono">
                        {showPrice ? `¥${totalAmount.toLocaleString()}` : ''}
                      </td>
                      <td className="border border-slate-900"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* 印刷用CSSの差し込み (PDFレイアウトの最適化) */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          body * {
            visibility: hidden !important;
          }
          #order-preview-print-area, #order-preview-print-area * {
            visibility: visible !important;
          }
          #order-preview-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          /* 改ページの設定 */
          .order-sheet-page {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: always !important;
            break-after: page !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
            min-height: 0 !important;
            background: transparent !important;
            box-sizing: border-box !important;
            overflow: visible !important;
          }
          .order-sheet-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          /* テーブルやフォントの調整 */
          table {
            border-collapse: collapse !important;
          }
          th, td {
            border-color: #000 !important;
          }
        }
      `}</style>
    </div>
  );
}
