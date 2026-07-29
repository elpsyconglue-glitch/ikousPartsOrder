import { PriceRevisionDoc } from '../types';
import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  handleFirestoreError, 
  OperationType 
} from '../lib/firebase';

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
  }
}

/**
 * Firestore の `price_revisions` コレクションをリアルタイム監視
 */
export function subscribePriceRevisionDocs(onUpdate: (docs: PriceRevisionDoc[]) => void): () => void {
  // まず localStorage のローカルデータを即時返却
  const localDocs = getPriceRevisionDocs();
  if (localDocs.length > 0) {
    onUpdate(localDocs);
  }

  try {
    const collectionRef = collection(db, 'price_revisions');
    const unsubscribe = onSnapshot(
      collectionRef,
      (snapshot) => {
        const firestoreDocs: PriceRevisionDoc[] = [];
        snapshot.forEach((docSnap) => {
          firestoreDocs.push(docSnap.data() as PriceRevisionDoc);
        });

        // 日付降順などでソート
        firestoreDocs.sort((a, b) => new Date(b.effectiveDate || b.updatedAt).getTime() - new Date(a.effectiveDate || a.updatedAt).getTime());

        // クラウドデータが存在すれば localStorage にもキャッシュして通知
        if (firestoreDocs.length > 0) {
          savePriceRevisionDocs(firestoreDocs);
          onUpdate(firestoreDocs);
        } else if (localDocs.length > 0) {
          // Firestoreにまだ何も無ければ、ローカルデータを自動アップロード同期
          localDocs.forEach(d => savePriceRevisionDocToFirestore(d));
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'price_revisions');
        // エラー時はローカルデータにフォールバック
        onUpdate(getPriceRevisionDocs());
      }
    );
    return unsubscribe;
  } catch (err) {
    console.error('Failed to subscribe to price_revisions', err);
    return () => {};
  }
}

/**
 * 価格改定ドキュメントを Firestore & localStorage に保存
 */
export async function savePriceRevisionDocToFirestore(item: PriceRevisionDoc): Promise<void> {
  // localStorage の更新
  const current = getPriceRevisionDocs();
  const existingIdx = current.findIndex(d => d.id === item.id);
  let updatedList: PriceRevisionDoc[];
  if (existingIdx >= 0) {
    updatedList = [...current];
    updatedList[existingIdx] = item;
  } else {
    updatedList = [item, ...current];
  }
  savePriceRevisionDocs(updatedList);

  // Firestore の更新
  try {
    const docRef = doc(db, 'price_revisions', item.id);
    await setDoc(docRef, item, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `price_revisions/${item.id}`);
    throw error;
  }
}

/**
 * 価格改定ドキュメントを Firestore & localStorage から削除
 */
export async function deletePriceRevisionDocFromFirestore(id: string): Promise<void> {
  // localStorage の削除
  const current = getPriceRevisionDocs();
  const updatedList = current.filter(d => d.id !== id);
  savePriceRevisionDocs(updatedList);

  // Firestore の削除
  try {
    const docRef = doc(db, 'price_revisions', id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `price_revisions/${id}`);
    throw error;
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

