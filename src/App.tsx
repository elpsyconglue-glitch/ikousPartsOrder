/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { PartHistory, OrderItem, OrderHeader } from './types';
import { getPartHistories, subscribePartHistories } from './utils/csvHelper';
import { getShipNames } from './utils/shipHelper';
import CsvManager from './components/CsvManager';
import OrderForm from './components/OrderForm';
import OrderPreview from './components/OrderPreview';
import BudgetManager from './components/BudgetManager';
import { Ship, Database, FileText, PieChart, FileCheck, Info, UserCheck, LogOut, ShieldCheck, Users } from 'lucide-react';
import PriceRevisionModal from './components/PriceRevisionModal';
import { AuthProvider, useAuth } from './auth/AuthContext';
import LoginModal from './components/LoginModal';
import UserManagementModal from './components/UserManagementModal';
import Logo from './components/Logo';

function AppContent() {
  const { isAuthenticated, user, logout, daysUntilExpiration, simulateExpireAccount, isAdmin, isReadOnly } = useAuth();

  const [histories, setHistories] = useState<PartHistory[]>([]);
  const [shipNames, setShipNames] = useState<string[]>(() => getShipNames());
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [activeTab, setActiveTab] = useState<'form' | 'budget' | 'db'>('form');
  const [showPriceRevisionModal, setShowPriceRevisionModal] = useState<boolean>(false);
  const [showUserManagementModal, setShowUserManagementModal] = useState<boolean>(false);

  // 発注書基本ヘッダーの初期状態（日付は今日、期限・場所は空欄）
  const [header, setHeader] = useState<OrderHeader>({
    date: new Date().toISOString().slice(0, 10),
    orderNo: '',
    staff: '',
    limitDate: '',
    place: '',
    orderCategory: '部品'
  });

  // 発注書明細行の初期状態
  const [items, setItems] = useState<OrderItem[]>([
    {
      id: 'init-1',
      partName: '',
      partNumber: '',
      quantity: '',
      unit: '',
      unitPrice: '',
      remark: '',
      orderCategory: '部品',
      shipName: '',
      equipmentName: '',
      manufacturer: '',
      model: ''
    }
  ]);

  // 初期読み込み & Firestore からのリアルタイム同期バインド
  useEffect(() => {
    const loadedHistories = getPartHistories();
    setHistories(loadedHistories);

    // Firestore リアルタイム同期
    const unsub = subscribePartHistories((updated) => {
      setHistories(updated);
    });

    return () => unsub();
  }, []);

  // プレビュー画面への遷移
  const handlePreviewClick = () => {
    setViewMode('preview');
  };

  if (!isAuthenticated) {
    return <LoginModal />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* 共通アプリケーションヘッダー（印刷時は非表示） */}
      <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-md border-b border-indigo-900 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Logo variant="white-card" className="h-9" />
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
                <span className="font-mono text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-indigo-200 to-white text-xl sm:text-2xl">
                  IKOUS Parts Order
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-900/90 text-indigo-200 border border-indigo-700/60 hidden md:inline-block">
                  船舶部品・資材・予算発注管理
                </span>
              </h1>
              <p className="text-xs text-indigo-200/90 hidden sm:block">
                株式会社イコーズ 全16隻対応 | 部品・船用品・潤滑油・廃油処理 発注書作成 ＆ 予算自動集計
              </p>
            </div>
          </div>

          {/* 右側：ログインユーザー＆ナビゲーション */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* ログインユーザー情報＆権限バッジ */}
            {user && (
              <div className="flex items-center gap-2 bg-slate-800/90 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-xs">
                <UserCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <div className="leading-tight">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white">{user.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                      isAdmin 
                        ? 'bg-indigo-900 text-indigo-200 border border-indigo-700' 
                        : isReadOnly
                        ? 'bg-slate-700 text-slate-300 border border-slate-600'
                        : 'bg-blue-900 text-blue-200 border border-blue-700'
                    }`}>
                      {user.role}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">{user.email}</p>
                </div>

                {/* 1年経過状態を疑似テストするデモボタン */}
                <button
                  type="button"
                  onClick={simulateExpireAccount}
                  className="ml-1 px-2 py-0.5 bg-amber-900/60 hover:bg-amber-800 text-amber-200 border border-amber-700/60 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                  title="【テスト用】アカウントを人工的に開通から1年経過（期限切れ）状態にして年次再認証画面を確認"
                >
                  1年経過テスト
                </button>

                <button
                  onClick={logout}
                  className="p-1 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                  title="ログアウト"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* 価格改定PDFボタン */}
            <button
              onClick={() => setShowPriceRevisionModal(true)}
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all cursor-pointer border border-amber-400/30"
              title="各メーカーからの価格改定PDF資料を全体共通で管理・添付閲覧"
            >
              <FileCheck className="h-4 w-4 text-amber-100" />
              価格改定PDF資料
            </button>

            {/* 社員・アカウント権限管理ボタン (管理者・担当者用) */}
            <button
              onClick={() => {
                if (!isAdmin) {
                  alert('【権限エラー】社員・アカウント権限管理画面を開くには「管理者」権限が必要です。（大野様など管理者が変更可能です）');
                  return;
                }
                setShowUserManagementModal(true);
              }}
              type="button"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                isAdmin
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
              title={isAdmin ? "退職者アカウントの停止や各社員の権限設定（閲覧のみ/一般/管理者）を変更" : "権限管理コンソール（管理者限定）"}
            >
              <Users className="h-4 w-4 text-indigo-300" />
              <span>社員・権限管理</span>
              {isAdmin && (
                <span className="text-[9px] bg-indigo-900 text-indigo-200 px-1.5 py-0.2 rounded font-mono">
                  管理者
                </span>
              )}
            </button>

            {/* タブグループ */}
            <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/80">
              <button
                onClick={() => { setActiveTab('form'); setViewMode('edit'); }}
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'form' && viewMode === 'edit'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <FileText className="h-4 w-4" />
                発注書作成
              </button>

              <button
                onClick={() => { setActiveTab('budget'); setViewMode('edit'); }}
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'budget'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <PieChart className="h-4 w-4 text-emerald-400" />
                船別・予算発注履歴
              </button>

              <button
                onClick={() => { setActiveTab('db'); setViewMode('edit'); }}
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'db'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Database className="h-4 w-4" />
                履歴DB/CSV管理 ({histories.length})
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* プレビュー表示時 */}
        {viewMode === 'preview' ? (
          <OrderPreview
            header={header}
            items={items}
            histories={histories}
            onHistoriesChange={setHistories}
            onBackClick={() => setViewMode('edit')}
          />
        ) : (
          <>
            {/* 各タブの切り替え */}
            {activeTab === 'form' && (
              <div className="space-y-6">
                {/* ユーザーガイド（PCのみ表示、モバイルでは非表示） */}
                <div className="hidden md:flex bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 gap-3 text-sm text-indigo-900 print:hidden">
                  <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-bold">💡 発注書作成ガイド</h4>
                    <ul className="list-disc pl-5 text-xs text-indigo-800 space-y-1 leading-relaxed">
                      <li>
                        <strong>船別・分類別・メーカー別の発注書自動分割 & 発注書No.採番:</strong> 分類（部品=B, 船用品=S, 潤滑油=OIL, 廃油処理=WO）と発注先メーカーごとに発注書が自動分割されます。
                      </li>
                      <li>
                        <strong>船ごとの個別連番規則【Run西暦年ー分類コード＋連番】:</strong> 船ごとに連番が独立管理されます（例: A丸の部品3回目は<code>Run2026-B3</code>、B丸の部品2回目は<code>Run2026-B2</code>）。同時の複数発注でも順次連番（B1, B2...）が自動割り振りされます。
                      </li>
                      <li>
                        <strong>自動学習・予算連携:</strong> プレビュー画面で<strong>【印刷/PDF保存】（金額あり・なし）ボタンを押したタイミング</strong>で「船別・予算発注履歴」に自動記録されます。金額あり・なしのどちらを何度押しても<strong>重複して登録されることはありません</strong>。
                      </li>
                    </ul>
                  </div>
                </div>

                <OrderForm
                  histories={histories}
                  items={items}
                  onItemsChange={setItems}
                  header={header}
                  onHeaderChange={setHeader}
                  onPreviewClick={handlePreviewClick}
                  shipNames={shipNames}
                />
              </div>
            )}

            {activeTab === 'budget' && (
              <BudgetManager
                histories={histories}
                onHistoriesChange={setHistories}
                shipNames={shipNames}
                onShipNamesChange={setShipNames}
              />
            )}

            {activeTab === 'db' && (
              <CsvManager
                histories={histories}
                onHistoriesChange={setHistories}
              />
            )}
          </>
        )}
      </main>

      {/* 全画面共通: メーカー価格改定PDF資料モーダル */}
      <PriceRevisionModal
        isOpen={showPriceRevisionModal}
        onClose={() => setShowPriceRevisionModal(false)}
      />

      {/* 管理者用: 社員アカウント・権限管理モーダル */}
      {showUserManagementModal && (
        <UserManagementModal
          onClose={() => setShowUserManagementModal(false)}
        />
      )}

      {/* フッター（印刷時は非表示） */}
      <footer className="bg-slate-900 text-slate-400 py-4 text-center text-xs border-t border-slate-800 print:hidden mt-12">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 株式会社 イコーズ (ikous Co., Ltd.) - 船用部品発注・予算分析システム</p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}


