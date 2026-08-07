import { PartHistory, OrderCategory, ORDER_CATEGORY_CODE_MAP } from '../types';

/**
 * 船名・注文分類・発注年・過去履歴をもとに、ルールに基づいた発注書番号を自動採番する。
 * ルール: Run<西暦年>-<分類コード><連番>
 * 例: Run2026-B1, Run2026-B2, Run2026-S1, Run2026-OIL1, Run2026-WO1
 * カウント単位: 船ごと × 年ごと × 注文分類ごと
 */
export function generateOrderNo(
  histories: PartHistory[],
  shipName: string,
  category: OrderCategory,
  dateStr?: string,
  offsetCount: number = 0
): string {
  const ship = (shipName || '未指定').trim();
  const code = ORDER_CATEGORY_CODE_MAP[category] || 'B';

  // 西暦年の算出 (未指定またはパース不可なら現在年)
  let year = new Date().getFullYear();
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      year = d.getFullYear();
    } else {
      const match = dateStr.match(/\b(20\d\d)\b/);
      if (match) {
        year = parseInt(match[1], 10);
      }
    }
  }

  // 検索対象のプレフィックスと正規表現
  const prefix = `Run${year}-${code}`;
  
  // 正規表現: Run2026-B1, Run2026-B-1, Run2026-B001 などに対応
  const regex = new RegExp(`^Run${year}-?${code}-?(\\d+)$`, 'i');

  let maxNum = 0;

  // 過去履歴の中から、同船名・同分類コードの最大連番を検索
  histories.forEach(h => {
    const hShip = (h.shipName || '').trim();
    const isShipMatch = hShip === ship || (ship === '未指定' && (!hShip || hShip === '未指定'));

    if (isShipMatch && h.orderNo) {
      const trimmedNo = h.orderNo.trim();
      const match = trimmedNo.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  });

  const nextNum = maxNum + 1 + offsetCount;
  return `${prefix}${nextNum}`;
}


