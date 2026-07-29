import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { PartHistory, OrderItem } from '../types';
import { DEFAULT_PART_HISTORIES } from '../defaultData';
import { db, collection, doc, setDoc, onSnapshot, writeBatch, handleFirestoreError, OperationType } from '../lib/firebase';

const LOCAL_STORAGE_KEY = 'ship_part_histories';

// Firestore からのリアルタイム同期用関数
export function subscribePartHistories(onUpdate: (histories: PartHistory[]) => void) {
  return onSnapshot(collection(db, 'part_histories'), (snapshot) => {
    if (!snapshot.empty) {
      const items: PartHistory[] = [];
      snapshot.forEach(d => {
        items.push(d.data() as PartHistory);
      });
      // 保持
      savePartHistories(items);
      onUpdate(items);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, 'part_histories');
  });
}

// 単一の PartHistory を Firestore と localStorage の両方に保存
export async function savePartHistoryToFirestore(item: PartHistory) {
  try {
    const docRef = doc(db, 'part_histories', item.id);
    await setDoc(docRef, item, { merge: true });
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, `part_histories/${item.id}`);
  }
}

// 大量データ（6,657件等）を Firestore に一括同期（500件単位バッチ）
export async function syncAllHistoriesToFirestore(
  histories: PartHistory[], 
  onProgress?: (current: number, total: number) => void
): Promise<number> {
  const chunkSize = 400; // 安全のため400件ずつ
  const total = histories.length;
  let count = 0;

  for (let i = 0; i < total; i += chunkSize) {
    const chunk = histories.slice(i, i + chunkSize);
    const batch = writeBatch(db);

    for (const item of chunk) {
      const docRef = doc(db, 'part_histories', item.id);
      batch.set(docRef, item, { merge: true });
    }

    try {
      await batch.commit();
      count += chunk.length;
      if (onProgress) {
        onProgress(count, total);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'part_histories (batch)');
    }
  }

  return count;
}

// 日本の年度（4月〜翌3月）を算出するヘルパー
export function getFiscalYear(dateString?: string): number {
  if (!dateString) {
    const now = new Date();
    const month = now.getMonth() + 1;
    return month >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  }
  const d = new Date(dateString);
  if (isNaN(d.getTime())) {
    const now = new Date();
    const month = now.getMonth() + 1;
    return month >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  }
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return month >= 4 ? year : year - 1;
}

// ローカルストレージから履歴データを取得
export function getPartHistories(): PartHistory[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (data) {
      const parsed: PartHistory[] = JSON.parse(data);
      // 旧デモデータ (id が 'h1' ~ 'h20' 形式) を削除・フィルタリング
      const filtered = parsed.filter(item => !/^h\d+$/.test(item.id));
      if (filtered.length !== parsed.length) {
        savePartHistories(filtered);
      }
      return filtered;
    }
  } catch (e) {
    console.error('Error reading from localStorage', e);
  }
  return [];
}

// ローカルストレージに履歴データを保存
export function savePartHistories(histories: PartHistory[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(histories));
  } catch (e) {
    console.error('Error writing to localStorage', e);
  }
}

// 履歴データを全消去・初期化
export function clearAllPartHistories(): PartHistory[] {
  savePartHistories([]);
  return [];
}

// データをリセット（空配列に初期化）
export function resetToDefault(): PartHistory[] {
  return clearAllPartHistories();
}

// 1行のオブジェクトデータから PartHistory に変換する共通ロジック
function convertRowToPartHistory(row: any, index: number, sourcePrefix: string): PartHistory | null {
  const findValue = (keys: string[]): string => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null) return String(row[key]).trim();
      const foundKey = Object.keys(row).find(k => 
        k.toLowerCase().replace(/[\s_-]/g, '') === key.toLowerCase().replace(/[\s_-]/g, '')
      );
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
        return String(row[foundKey]).trim();
      }
    }
    return '';
  };

  const shipName = findValue(['船名', 'shipName', 'ship_name', '船', 'Vessel', '船名（Vessel）']);
  const equipmentName = findValue(['機器名', 'equipmentName', 'equipment_name', '機器', 'Equipment', '装置', '装置名']);
  const manufacturer = findValue(['発注先メーカー', 'メーカー', 'manufacturer', 'メーカー名', '発注先', 'Maker', 'Vendor', 'Supplier']);
  const model = findValue(['形式', 'model', '型式', 'Type', '形式・型式', 'モデル']);
  const partName = findValue(['品名', 'partName', 'part_name', '部品名', 'Item', 'Description', '部品']);
  const partNumber = findValue(['部品番号・規格', '部品番号', '規格', 'partNumber', 'part_number', 'PartNo', 'Specification', '図番', '図面番号']);
  const unit = findValue(['単位', 'unit', 'Unit', '個数単位']) || '個';
  const unitPriceStr = findValue(['単価', 'unitPrice', 'unit_price', 'Price', 'Rate', '仕入単価', '仕入価格']);
  const unitPrice = unitPriceStr ? parseFloat(unitPriceStr.replace(/[^0-9.]/g, '')) || 0 : 0;

  if (!partName) return null;

  return {
    id: `${sourcePrefix}-${Date.now()}-${index}`,
    shipName: shipName || '未指定',
    equipmentName: equipmentName || '未指定',
    manufacturer: manufacturer || '未指定',
    model: model || '未指定',
    partName,
    partNumber: partNumber || '-',
    unit,
    unitPrice
  };
}

// CSVおよびExcelファイル（.xlsx, .xls, .csv）を汎用に読み込んで PartHistory[] に変換
export async function parsePartHistoriesFromFile(file: File): Promise<PartHistory[]> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          const parsedData: PartHistory[] = [];
          rawRows.forEach((row, index) => {
            const item = convertRowToPartHistory(row, index, 'excel');
            if (item) parsedData.push(item);
          });

          resolve(parsedData);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  } else {
    // CSVとしてテキスト解析
    const text = await file.text();
    return parsePartHistoriesCsv(text);
  }
}

// CSVテキストから PartHistory[] に変換
export function parsePartHistoriesCsv(csvText: string): Promise<PartHistory[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedData: PartHistory[] = [];
        results.data.forEach((row: any, index) => {
          const item = convertRowToPartHistory(row, index, 'csv');
          if (item) parsedData.push(item);
        });
        resolve(parsedData);
      },
      error: (error) => reject(error)
    });
  });
}

// 履歴データをExcelファイル (.xlsx) としてダウンロード作成
export function exportPartHistoriesToExcel(histories: PartHistory[], filename = '部品発注履歴データベース.xlsx'): void {
  const exportData = histories.map(h => ({
    '船名': h.shipName,
    '機器名': h.equipmentName,
    '発注先メーカー': h.manufacturer,
    '形式': h.model,
    '品名': h.partName,
    '部品番号・規格': h.partNumber,
    '単位': h.unit,
    '単価': h.unitPrice
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '部品履歴');
  XLSX.writeFile(workbook, filename);
}

// 履歴データをCSV文字列に変換（エクスポート用）
export function exportPartHistoriesToCsv(histories: PartHistory[]): string {
  const exportData = histories.map(h => ({
    '船名': h.shipName,
    '機器名': h.equipmentName,
    '発注先メーカー': h.manufacturer,
    '形式': h.model,
    '品名': h.partName,
    '部品番号・規格': h.partNumber,
    '単位': h.unit,
    '単価': h.unitPrice
  }));
  return Papa.unparse(exportData);
}

// 発注作成時にアイテムを履歴データベース（localStorage）に追加・更新保存する
export function registerNewItemsToHistories(
  currentHistories: PartHistory[],
  items: OrderItem[],
  headerOrderDate?: string,
  headerOrderNo?: string
): PartHistory[] {
  let updatedHistories = [...currentHistories];

  items.forEach((item, idx) => {
    if (!item.partName || !item.partName.trim()) return;

    const trimmedPartName = item.partName.trim();
    const trimmedPartNumber = (item.partNumber || '').trim();
    const trimmedShipName = (item.shipName || '').trim();
    const trimmedEquipmentName = (item.equipmentName || '').trim();
    const trimmedManufacturer = (item.manufacturer || '').trim();
    const trimmedModel = (item.model || '').trim();
    const trimmedUnit = (item.unit || '').trim() || '個';
    const unitPriceNum = Number(item.unitPrice) || 0;
    const quantityNum = Number(item.quantity) || 1;
    const orderCategory = item.orderCategory || '部品';
    const targetOrderNo = (item.orderNo || headerOrderNo || '').trim();

    // 1. 同一の発注書No + 品名 + 船名の重複を検索（同じ発注書の再印刷・金額あり/なし切り替え時など）
    const existingSameOrderIndex = targetOrderNo ? updatedHistories.findIndex(h =>
      (h.orderNo || '').trim() === targetOrderNo &&
      h.partName.trim().toLowerCase() === trimmedPartName.toLowerCase() &&
      (h.shipName || '').trim().toLowerCase() === trimmedShipName.toLowerCase()
    ) : -1;

    if (existingSameOrderIndex >= 0) {
      // 既に同じ発注書No・品名で登録済みの場合はその情報を更新（重複追加防止）
      const existing = updatedHistories[existingSameOrderIndex];
      const updatedItem = {
        ...existing,
        unitPrice: unitPriceNum > 0 ? unitPriceNum : existing.unitPrice,
        quantity: quantityNum,
        category: orderCategory,
        orderDate: headerOrderDate || existing.orderDate || new Date().toISOString().split('T')[0],
        orderNo: targetOrderNo,
        remark: item.remark || existing.remark
      };
      updatedHistories[existingSameOrderIndex] = updatedItem;
      savePartHistoryToFirestore(updatedItem);
    } else {
      // 2. 新規レコードとして追加
      const newHistory: PartHistory = {
        id: `auto-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        shipName: trimmedShipName || '未指定',
        equipmentName: trimmedEquipmentName || '未指定',
        manufacturer: trimmedManufacturer || '未指定',
        model: trimmedModel || '未指定',
        partName: trimmedPartName,
        partNumber: trimmedPartNumber || '-',
        unit: trimmedUnit,
        unitPrice: unitPriceNum,
        category: orderCategory,
        quantity: quantityNum,
        orderDate: headerOrderDate || new Date().toISOString().split('T')[0],
        orderNo: targetOrderNo,
        remark: item.remark || ''
      };
      updatedHistories = [newHistory, ...updatedHistories];
      savePartHistoryToFirestore(newHistory);
    }
  });

  savePartHistories(updatedHistories);
  return updatedHistories;
}

// 予算管理画面等で、特定履歴の単価・金額・発注書番号を後から更新し、同じ品名・部品番号のマスター単価にも次回反映されるよう同期する
export function updateHistoryUnitPrice(
  currentHistories: PartHistory[],
  historyId: string,
  newUnitPrice: number,
  newQuantity?: number,
  newRemark?: string,
  newOrderNo?: string
): PartHistory[] {
  const targetItem = currentHistories.find(h => h.id === historyId);
  if (!targetItem) return currentHistories;

  const targetPartName = targetItem.partName.trim().toLowerCase();
  const targetPartNumber = (targetItem.partNumber || '').trim().toLowerCase();

  const updatedHistories = currentHistories.map(h => {
    if (h.id === historyId) {
      return {
        ...h,
        unitPrice: newUnitPrice,
        quantity: newQuantity !== undefined ? newQuantity : h.quantity,
        remark: newRemark !== undefined ? newRemark : h.remark,
        orderNo: newOrderNo !== undefined ? newOrderNo : h.orderNo
      };
    }
    // 同一の品名・部品番号（および船名・機器）のレコードがあれば次回候補のために単価を連動更新
    if (
      h.partName.trim().toLowerCase() === targetPartName &&
      (h.partNumber || '').trim().toLowerCase() === targetPartNumber
    ) {
      return {
        ...h,
        unitPrice: newUnitPrice
      };
    }
    return h;
  });

  savePartHistories(updatedHistories);
  return updatedHistories;
}

