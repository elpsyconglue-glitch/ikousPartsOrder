import { OrderItem, PartHistory } from '../types';

const CAPTAINS_KEY_PREFIX = 'vessel_captains_';
const CHIEF_ENGINEERS_KEY_PREFIX = 'vessel_chief_engineers_';
const HISTORIES_KEY_PREFIX = 'vessel_db_';

/**
 * 指定した船の船長履歴を取得
 */
export function getVesselCaptains(shipName: string): string[] {
  if (!shipName) return [];
  try {
    const raw = localStorage.getItem(`${CAPTAINS_KEY_PREFIX}${shipName}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load vessel captains:', e);
  }
  return [];
}

/**
 * 指定した船の船長名を履歴に保存（重複排除）
 */
export function saveVesselCaptain(shipName: string, captainName: string) {
  if (!shipName || !captainName || !captainName.trim()) return;
  const trimmed = captainName.trim();
  const current = getVesselCaptains(shipName);
  if (!current.includes(trimmed)) {
    const updated = [trimmed, ...current].slice(0, 20); // 最新20件保持
    try {
      localStorage.setItem(`${CAPTAINS_KEY_PREFIX}${shipName}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save vessel captain:', e);
    }
  }
}

/**
 * 指定した船の機関長履歴を取得
 */
export function getVesselChiefEngineers(shipName: string): string[] {
  if (!shipName) return [];
  try {
    const raw = localStorage.getItem(`${CHIEF_ENGINEERS_KEY_PREFIX}${shipName}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load vessel chief engineers:', e);
  }
  return [];
}

/**
 * 指定した船の機関長名を履歴に保存（重複排除）
 */
export function saveVesselChiefEngineer(shipName: string, chiefEngineerName: string) {
  if (!shipName || !chiefEngineerName || !chiefEngineerName.trim()) return;
  const trimmed = chiefEngineerName.trim();
  const current = getVesselChiefEngineers(shipName);
  if (!current.includes(trimmed)) {
    const updated = [trimmed, ...current].slice(0, 20); // 最新20件保持
    try {
      localStorage.setItem(`${CHIEF_ENGINEERS_KEY_PREFIX}${shipName}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save vessel chief engineer:', e);
    }
  }
}

/**
 * 船独自のパーツ・発注履歴データベースを取得
 */
export function getVesselHistories(shipName: string): PartHistory[] {
  if (!shipName) return [];
  try {
    const raw = localStorage.getItem(`${HISTORIES_KEY_PREFIX}${shipName}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load vessel histories:', e);
  }
  return [];
}

/**
 * 船独自のパーツ・発注履歴データベースに発注アイテムを蓄積保存
 */
export function saveVesselHistories(shipName: string, items: OrderItem[], orderDate: string): PartHistory[] {
  if (!shipName || items.length === 0) return [];
  const current = getVesselHistories(shipName);
  const updated = [...current];

  items.forEach(item => {
    if (!item.partName || !item.partName.trim()) return;

    // 同一機器名・品名・型式が存在するか確認
    const existingIndex = updated.findIndex(
      h => h.equipmentName === item.equipmentName &&
           h.partName === item.partName &&
           h.model === item.model
    );

    const newRecord: PartHistory = {
      id: `vessel_h_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      shipName,
      equipmentName: item.equipmentName || '',
      manufacturer: item.manufacturer || '',
      model: item.model || '',
      partName: item.partName,
      partNumber: item.partNumber || '',
      unit: item.unit || '個',
      unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : 0,
      category: item.orderCategory || '部品',
      quantity: typeof item.quantity === 'number' ? item.quantity : undefined,
      orderDate: orderDate || new Date().toISOString().split('T')[0],
      orderNo: item.orderNo || '',
      remark: item.remark || ''
    };

    if (existingIndex >= 0) {
      // 既存の単価や規格が更新されていれば最新情報でアップデート
      updated[existingIndex] = {
        ...updated[existingIndex],
        ...newRecord,
        id: updated[existingIndex].id // ID保持
      };
    } else {
      updated.unshift(newRecord);
    }
  });

  try {
    localStorage.setItem(`${HISTORIES_KEY_PREFIX}${shipName}`, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save vessel histories:', e);
  }

  return updated;
}
