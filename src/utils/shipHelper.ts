import { DEFAULT_SHIP_NAMES } from '../defaultData';

const LOCAL_STORAGE_SHIP_KEY = 'ikous_ship_names_v1';

/**
 * ローカルストレージから船名一覧を取得（未保存時はデフォルト船名一覧を返却）
 */
export function getShipNames(): string[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_SHIP_KEY);
    if (saved) {
      const parsed: string[] = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading ship names from localStorage', e);
  }
  return DEFAULT_SHIP_NAMES;
}

/**
 * ローカルストレージに船名一覧を保存
 */
export function saveShipNames(ships: string[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_SHIP_KEY, JSON.stringify(ships));
  } catch (e) {
    console.error('Error saving ship names to localStorage', e);
  }
}
