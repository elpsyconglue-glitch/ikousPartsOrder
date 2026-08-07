export type UserRole = '管理者' | '一般ユーザー' | '閲覧のみ' | 'ゲスト';

export interface GuestAccessLog {
  id: string;
  guestId: string;
  guestName: string;
  email: string;
  loginAt: string;
  formattedLoginAt: string;
  userAgent?: string;
}

export interface PartHistory {
  id: string;
  shipName: string;       // 船名
  equipmentName: string;  // 機器名
  manufacturer: string;   // メーカー (発注先)
  model: string;          // 形式
  partName: string;       // 品名
  partNumber: string;     // 部品番号・規格
  unit: string;           // 単位
  unitPrice: number;      // 単価
  category?: OrderCategory; // 注文の分類 (船用品 | 部品 | 潤滑油 | 廃油処理)
  quantity?: number;      // 発注数量
  orderDate?: string;     // 発注年月日 (YYYY-MM-DD)
  orderNo?: string;       // 発注番号
  remark?: string;        // 備考
  isUserCreated?: boolean; // サイト上での発注作成・手動追加実績フラグ (マスター置換時も削除保護)
}

export interface OrderItem {
  id: string;
  partName: string;
  partNumber: string;
  quantity: number | "";
  unit: string;
  unitPrice: number | "";
  remark: string;
  isUrgent?: boolean; // 急ぎチェックボックス
  orderCategory?: OrderCategory; // 行ごとの分類 (船用品 | 部品 | 潤滑油 | 廃油処理)
  // 自動補完・手動調整される船舶・機器情報 (行ごとに保持し、メーカー分割に利用)
  shipName: string;
  equipmentName: string;
  manufacturer: string;
  model: string;
  orderNo?: string;
}

export type OrderCategory = '船用品' | '部品' | '潤滑油' | '廃油処理';

export const ORDER_CATEGORY_TITLE_MAP: Record<OrderCategory, string> = {
  '部品': '部品注文書',
  '船用品': '船用品注文書',
  '潤滑油': '潤滑油注文書',
  '廃油処理': '廃油陸揚依頼書'
};

export const ORDER_CATEGORY_CODE_MAP: Record<OrderCategory, string> = {
  '部品': 'B',
  '船用品': 'S',
  '潤滑油': 'OIL',
  '廃油処理': 'WO'
};

export interface OrderHeader {
  date: string;           // 発注年月日
  orderNo: string;        // 発注書No
  staff: string;          // 担当 (大野隆太, 伊坂博樹, 村上愛子, 三輪大真)
  shipName?: string;      // 船名 (基本情報一括設定用)
  captain?: string;       // 船長 (船員モード用)
  chiefEngineer?: string; // 機関長 (船員モード用)
  limitDate: string;      // 納品期限
  place: string;          // 納品場所
  orderCategory: OrderCategory; // 注文の分類 (船用品 | 部品 | 潤滑油 | 廃油処理)
  isUrgent?: boolean;     // 全体急ぎフラグ
}

export type StaffName = '大野隆太' | '伊坂博樹' | '村上愛子' | '三輪大真';

export const STAFF_LIST: StaffName[] = ['大野隆太', '伊坂博樹', '村上愛子', '三輪大真'];

export interface PriceRevisionDoc {
  id: string;
  title: string;          // タイトル (例: 阪神価格改定)
  manufacturer: string;   // メーカー名
  effectiveDate?: string; // 改定年月・適用日
  fileName: string;       // ファイル名
  fileDataUrl: string;    // PDFのBase64 Data URL
  fileSize?: number;      // バイト数
  updatedAt: string;      // 登録・更新日時
  remark?: string;        // 備考
}

