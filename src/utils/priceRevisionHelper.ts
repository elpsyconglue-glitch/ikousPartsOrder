import { PriceRevisionDoc } from '../types';

const PRICE_REVISION_STORAGE_KEY = 'price_revision_docs_v1';

/**
 * 価格改定ドキュメント一覧を localStorage から取得
 */
export function getPriceRevisionDocs(): PriceRevisionDoc[] {
  try {
    const data = localStorage.getItem(PRICE_REVISION_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load price revision docs from localStorage', e);
  }
  return [];
}

/**
 * 価格改定ドキュメント一覧を localStorage に保存
 */
export function savePriceRevisionDocs(docs: PriceRevisionDoc[]): void {
  try {
    localStorage.setItem(PRICE_REVISION_STORAGE_KEY, JSON.stringify(docs));
  } catch (e) {
    console.error('Failed to save price revision docs to localStorage', e);
    alert('ストレージ容量が上限に達したため、PDFを保存できませんでした。不要な資料を削除するか、容量の小さいPDFをご利用ください。');
  }
}

/**
 * ファイルを Base64 Data URL に変換するヘルパー関数
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = (error) => {
      reject(error);
    };
    reader.readAsDataURL(file);
  });
}
