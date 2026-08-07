export interface VesselEquipmentRecord {
  shipName: string;
  equipmentName: string;
  model: string;
}

// ユーザー提供の船名・機器名・型式マスターデータ
export const VESSEL_EQUIPMENT_MASTER: VesselEquipmentRecord[] = [
  { shipName: '大島百合丸', equipmentName: '主機', model: 'A-34C' },
  { shipName: '大島百合丸', equipmentName: '発電機', model: '6HAL2-HTN' },
  { shipName: 'ひよどり', equipmentName: '主機', model: 'LH38LG' },
  { shipName: 'ひよどり', equipmentName: '発電機', model: '6NY16L-HN' },
  { shipName: 'てんま', equipmentName: '主機', model: '6M34NT-G' },
  { shipName: 'てんま', equipmentName: '発電機', model: '6HAL2-DTN' },
  { shipName: '南新丸', equipmentName: '主機', model: 'AX-31' },
  { shipName: '南新丸', equipmentName: '発電機', model: '6HAL2-WHT' },
  { shipName: '大島一丸', equipmentName: '主機', model: 'A-34C' },
  { shipName: '大島一丸', equipmentName: '発電機', model: '6HAL2-HTN' },
  { shipName: '第八力司丸', equipmentName: '主機', model: 'LH34-LA' },
  { shipName: '第八力司丸', equipmentName: '発電機', model: '6HAL2-HTN' },
  { shipName: '第十二興洋丸', equipmentName: '主機', model: 'LH28G' },
  { shipName: '第十二興洋丸', equipmentName: '発電機', model: '6HAL2-DTN' },
  { shipName: '第12興洋丸', equipmentName: '主機', model: 'LH28G' },
  { shipName: '第12興洋丸', equipmentName: '発電機', model: '6HAL2-DTN' },
  { shipName: 'エリエール2', equipmentName: '主機', model: 'A-34C' },
  { shipName: 'エリエール2', equipmentName: '発電機', model: '6HAL2-HTN' },
  { shipName: 'すざく', equipmentName: '主機', model: 'LH38LG' },
  { shipName: 'すざく', equipmentName: '発電機', model: '6NY16L-HW' },
  { shipName: 'こはく', equipmentName: '主機', model: 'LH38L' },
  { shipName: 'こはく', equipmentName: '発電機', model: '6NY16L-W' },
  { shipName: '松栄丸', equipmentName: '主機', model: 'AX33B' },
  { shipName: '松栄丸', equipmentName: '発電機', model: '6NY16L-UW' },
  { shipName: 'げんぶ', equipmentName: '主機', model: '6UEC35LSE-Eco-C1' },
  { shipName: 'げんぶ', equipmentName: '発電機', model: '6EY22ALW' }
];

/**
 * 船名と機器名の文字列を標準化する関数
 */
function normalizeShipName(name: string): string {
  if (!name) return '';
  let normalized = name.trim();
  if (normalized === '第12興洋丸') normalized = '第十二興洋丸';
  return normalized;
}

function normalizeEquipmentName(name: string): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (trimmed === '主機関' || trimmed === 'メインエンジン' || trimmed === '主エンジン') return '主機';
  if (trimmed === '発電機関' || trimmed === 'サブエンジン' || trimmed === '補機') return '発電機';
  return trimmed;
}

/**
 * 船名と機器名から該当する型式(model)を検索・取得する
 */
export function findModelByShipAndEquipment(shipName: string, equipmentName: string): string | null {
  const normShip = normalizeShipName(shipName);
  const normEq = normalizeEquipmentName(equipmentName);

  if (!normShip || !normEq) return null;

  // 完全一致を優先検索
  const exact = VESSEL_EQUIPMENT_MASTER.find(
    r => normalizeShipName(r.shipName) === normShip && normalizeEquipmentName(r.equipmentName) === normEq
  );
  if (exact) return exact.model;

  // 部分一致（「主機」が含まれているなど）を検索
  const partial = VESSEL_EQUIPMENT_MASTER.find(r => {
    const rShip = normalizeShipName(r.shipName);
    const rEq = normalizeEquipmentName(r.equipmentName);
    return rShip === normShip && (normEq.includes(rEq) || rEq.includes(normEq));
  });

  return partial ? partial.model : null;
}

/**
 * 指定された船名に対応する機器名の一覧を取得する
 */
export function getEquipmentNamesForShip(shipName: string): string[] {
  const normShip = normalizeShipName(shipName);
  if (!normShip) return Array.from(new Set(VESSEL_EQUIPMENT_MASTER.map(r => r.equipmentName)));

  const matched = VESSEL_EQUIPMENT_MASTER
    .filter(r => normalizeShipName(r.shipName) === normShip)
    .map(r => r.equipmentName);

  if (matched.length === 0) {
    return Array.from(new Set(VESSEL_EQUIPMENT_MASTER.map(r => r.equipmentName)));
  }

  return Array.from(new Set(matched));
}

/**
 * 指定された船名および機器名に対応する型式の候補一覧を取得する
 */
export function getModelSuggestions(shipName: string, equipmentName: string): string[] {
  const model = findModelByShipAndEquipment(shipName, equipmentName);
  const allModels = Array.from(new Set(VESSEL_EQUIPMENT_MASTER.map(r => r.model)));

  if (model) {
    return [model, ...allModels.filter(m => m !== model)];
  }
  return allModels;
}
