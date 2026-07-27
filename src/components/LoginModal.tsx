import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { STAFF_LIST } from '../types';
import Logo from './Logo';
import { 
  ShieldCheck, 
  Mail, 
  KeyRound, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  HelpCircle, 
  Building2, 
  ArrowRight,
  AlertTriangle,
  Lock,
  UserCheck
} from 'lucide-react';

export default function LoginModal() {
  const { 
    user, 
    pendingVerification, 
    sendVerificationCode, 
    verifyCodeAndLogin, 
    isAccountExpired, 
    daysUntilExpiration,
    logout 
  } = useAuth();

  // 入力フォーム状態
  const [emailInput, setEmailInput] = useState<string>(user?.email || 'yamada@ikous.co.jp');
  const [nameInput, setNameInput] = useState<string>(user?.name || STAFF_LIST[0]);
  const [codeInput, setCodeInput] = useState<string>('');
  
  // UI メッセージ・状態
  const [step, setStep] = useState<'email' | 'code'>(pendingVerification ? 'code' : 'email');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [demoCodeNotice, setDemoCodeNotice] = useState<string | null>(pendingVerification?.code || null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  // コード送信処理
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const res = await sendVerificationCode(emailInput, nameInput);
      if (res.success) {
        setStep('code');
        setStatusMessage({ type: 'success', text: res.message });
        if (res.demoCode) {
          setDemoCodeNotice(res.demoCode);
        }
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    } catch {
      setStatusMessage({ type: 'error', text: '認証コード送信処理に失敗しました。' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // コード検証・ログイン処理
  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeInput) {
      setStatusMessage({ type: 'error', text: '6桁の認証コードを入力してください。' });
      return;
    }

    const res = verifyCodeAndLogin(codeInput);
    if (res.success) {
      setStatusMessage({ type: 'success', text: res.message });
    } else {
      setStatusMessage({ type: 'error', text: res.message });
    }
  };

  // デモコード自動入力
  const handleAutoFillDemoCode = () => {
    if (demoCodeNotice) {
      setCodeInput(demoCodeNotice);
    }
  };

  // 担当者プリセット選択
  const handleSelectPresetStaff = (staffName: string) => {
    setNameInput(staffName);
    const mockEmail = `${staffName.toLowerCase().replace(/\s+/g, '')}@ikous.co.jp`;
    setEmailInput(mockEmail);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
        
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-8 py-6 text-center relative">
          <div className="mb-3 flex justify-center">
            <Logo variant="white-card" className="h-10" />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">
            株式会社イコーズ 船体部品・予算発注管理
          </h2>
          <p className="text-xs text-indigo-200 mt-1 flex items-center justify-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-emerald-400" />
            <span>社内メールアドレス認証 （1年間有効・年次自動更新型）</span>
          </p>
        </div>

        {/* 1年経過（アカウント認証期限切れ）警告 */}
        {isAccountExpired && user && (
          <div className="bg-amber-50 border-b border-amber-200 p-4 text-amber-900 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-950">
                  ⚠️ 年次ログイン認証期限切れ（開通から1年経過）
                </p>
                <p className="mt-1 leading-relaxed">
                  アカウント（<span className="font-bold">{user.email}</span>）の1年間の認証有効期限が終了しました。
                  社内セキュリティ維持のため、再度メール認証コードを入力してアカウント有効期限を1年間更新してください。
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="p-7 space-y-6">

          {/* 通知メッセージ */}
          {statusMessage && (
            <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              statusMessage.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* ステップ1：メールアドレス・担当者名入力 */}
          {step === 'email' && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-indigo-600" />
                  <span>会社メールアドレス</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="yamada@ikous.co.jp"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  className="w-full text-xs font-semibold px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-indigo-600" />
                  <span>お名前（担当者名）</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="山田 太郎"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  className="w-full text-xs font-semibold px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-slate-50 focus:bg-white"
                />
              </div>

              {/* 担当者プリセットクイックボタン */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  社内担当者サンプル選択:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {STAFF_LIST.slice(0, 5).map(staff => (
                    <button
                      key={staff}
                      type="button"
                      onClick={() => handleSelectPresetStaff(staff)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                        nameInput === staff 
                          ? 'bg-indigo-600 text-white border-indigo-600 font-bold' 
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                      }`}
                    >
                      {staff}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md hover:shadow-indigo-500/20 text-xs cursor-pointer disabled:opacity-50"
                >
                  <Mail className="h-4 w-4" />
                  <span>{isAccountExpired ? '年次再認証コードを送信' : '認証コードをメール送信（1年間有効開通）'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          {/* ステップ2：ワンタイムコード入力 */}
          {step === 'code' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                <p className="text-slate-600">
                  送信先アドレス: <span className="font-bold text-slate-900">{emailInput}</span>
                </p>
                <p className="text-slate-500 text-[11px]">
                  ※ 認証完了後、本アカウントで <strong>1年間（365日）</strong> そのままログイン継続できます。
                </p>
              </div>

              {/* デモ環境用ワンタイムコード表示カード */}
              {demoCodeNotice && (
                <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-amber-900">【テスト用確認コード】</p>
                    <p className="text-lg font-mono font-extrabold text-amber-900 tracking-widest mt-0.5">
                      {demoCodeNotice}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoFillDemoCode}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    コードを自動入力
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <KeyRound className="h-4 w-4 text-indigo-600" />
                  <span>6桁のワンタイム認証コード</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="123456"
                  value={codeInput}
                  onChange={e => setCodeInput(e.target.value)}
                  className="w-full text-center text-lg font-mono tracking-widest font-extrabold py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  戻る
                </button>
                <button
                  type="submit"
                  className="flex-[2] py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isAccountExpired ? '年次認証を更新する' : '認証完了・ログイン'}</span>
                </button>
              </div>
            </form>
          )}

          {/* 1年更新ルール・ガイドライン */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              className="w-full flex items-center justify-between text-xs text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50/60 p-3 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2 font-semibold">
                <Clock className="h-4 w-4 text-indigo-600" />
                メール認証と1年毎の年次再認証ルールについて
              </span>
              <span className="text-[11px] underline">説明を見る</span>
            </button>
          </div>

        </div>

        {/* フッター */}
        <div className="bg-slate-100 px-6 py-3 text-center text-[11px] text-slate-500 border-t border-slate-200 flex items-center justify-between">
          <span>🔒 株式会社イコーズ 社内専用認証</span>
          <span className="font-semibold text-slate-600">有効期限: 開通より1年間</span>
        </div>

      </div>

      {/* 1年毎の年次再認証ルール解説モーダル */}
      {showGuideModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                メール認証 ＆ 1年周期再認証システム解説
              </h3>
              <button
                onClick={() => setShowGuideModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                閉じる
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
              <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-xl space-y-1">
                <h4 className="font-bold text-indigo-900 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-indigo-600" />
                  1年ごとのアカウント更新仕様
                </h4>
                <p>
                  一度メール認証を通過すると、アカウント開通日から <strong>365日間</strong> はパスワード入力等なしでシステムを利用可能です。
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-900 border-l-4 border-indigo-600 pl-2">
                  運用手順
                </h4>
                <ul className="list-disc list-inside space-y-1 pl-1 text-slate-600">
                  <li><strong>初回登録（開通）:</strong> 会社のメールアドレスを入力し、届いたワンタイム認証コードを入力することで開通完了。</li>
                  <li><strong>日常運用:</strong> 同じ端末・ブラウザからはログイン状態が維持されます（手動ログアウトも可能）。</li>
                  <li><strong>1年毎の更新:</strong> 1年が経過すると自動的に「年次更新認証画面」に切り替わります。再度メール認証コードを入力すれば、次の1年間有効期限が延期されます。</li>
                  <li><strong>安全対策:</strong> 退職者や異動者が発生した場合でも、メールアドレスが利用不可になっていれば1年更新のコードが受信できないため、自動的にアクセスが遮断されます。</li>
                </ul>
              </div>
            </div>

            <div className="text-right border-t pt-3">
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 bg-slate-800 text-white font-bold text-xs rounded-lg cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
