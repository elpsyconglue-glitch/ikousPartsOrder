import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { STAFF_LIST } from '../types';
import { VESSEL_ACCOUNTS, getEmailByShipName } from '../utils/vesselAccounts';
import Logo from './Logo';
import { 
  ShieldCheck, 
  Mail, 
  KeyRound, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  Building2, 
  ArrowRight,
  AlertTriangle,
  Lock,
  UserCheck,
  UserPlus,
  LogIn,
  Ship,
  Anchor
} from 'lucide-react';

export default function LoginModal() {
  const { 
    user, 
    signUpWithFirebase,
    signInWithFirebase,
    loginAsVessel,
    sendPasswordReset,
    loginAsGuest,
    isAccountExpired, 
  } = useAuth();

  // URLパラメータチェック (?mode=vessel や ?vessel=true または ?ship=いくた 等)
  const [isVesselUrlMode, setIsVesselUrlMode] = useState<boolean>(false);
  const [selectedVesselShip, setSelectedVesselShip] = useState<string>('いくた');
  const [vesselPasswordInput, setVesselPasswordInput] = useState<string>('IKOUS');

  // モード選択 ('signin' | 'signup' | 'guest' | 'reset' | 'vessel')
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'guest' | 'reset' | 'vessel'>('signin');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      const vesselParam = params.get('vessel');
      const shipParam = params.get('ship');

      if (mode === 'vessel' || vesselParam === 'true' || vesselParam === '1' || shipParam) {
        setIsVesselUrlMode(true);
        setAuthMode('vessel');

        if (shipParam) {
          const match = VESSEL_ACCOUNTS.find(v => v.shipName === shipParam || v.shipName.includes(shipParam));
          if (match) {
            setSelectedVesselShip(match.shipName);
          }
        }
      }
    }
  }, []);

  // 入力フォーム状態
  const [emailInput, setEmailInput] = useState<string>(user?.email || '');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [nameInput, setNameInput] = useState<string>(user?.name || '');
  const [departmentInput, setDepartmentInput] = useState<string>('株式会社イコーズ 工務部');
  const [guestNameInput, setGuestNameInput] = useState<string>('');
  
  // UI メッセージ・状態
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  // 船員専用ログイン処理
  const handleVesselLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const targetEmail = getEmailByShipName(selectedVesselShip) || '';
      const res = await loginAsVessel(targetEmail || selectedVesselShip, vesselPasswordInput);
      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message });
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    } catch {
      setStatusMessage({ type: 'error', text: '船員ログイン処理に失敗しました。' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Firebase 新規アカウント作成
  const handleFirebaseSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const res = await signUpWithFirebase(emailInput, passwordInput, nameInput, departmentInput);
      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message });
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'アカウント登録中にエラーが発生しました。' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Firebase ログイン
  const handleFirebaseSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const res = await signInWithFirebase(emailInput, passwordInput);
      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message });
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'ログイン処理中にエラーが発生しました。' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. パスワード再設定メール送信
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const res = await sendPasswordReset(emailInput);
      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message });
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'パスワード再設定メールの送信に失敗しました。' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. ゲスト簡易ログイン処理
  const handleGuestLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const res = await loginAsGuest(guestNameInput);
      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message });
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'ゲストログイン処理に失敗しました。' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
        
        {/* ヘッダー */}
        <div className={`px-8 py-6 text-center relative transition-all duration-300 ${
          authMode === 'vessel' 
            ? 'bg-gradient-to-r from-emerald-950 via-teal-900 to-emerald-950 text-white'
            : 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white'
        }`}>
          <div className="mb-3 flex justify-center">
            <Logo variant="white-card" className="h-10" />
          </div>
          {authMode === 'vessel' ? (
            <>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-800/60 border border-emerald-500/40 text-emerald-200 text-xs font-bold mb-2">
                <Ship className="h-4 w-4 text-emerald-400" />
                <span>船員様・本船専用 注文依頼ポータル</span>
              </div>
              <h2 className="text-xl font-black tracking-tight font-sans text-white">
                乗組員様 ログイン画面
              </h2>
              <p className="text-xs text-emerald-200/90 mt-1 flex items-center justify-center gap-1.5 font-sans">
                <span>乗船されている船名を選んでログインボタンを押してください</span>
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-black tracking-tight font-mono text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-indigo-200 to-white">
                IKOUS Parts Order
              </h2>
              <p className="text-xs text-indigo-200 mt-1 flex items-center justify-center gap-1.5 font-sans">
                <Lock className="h-3.5 w-3.5 text-emerald-400" />
                <span>株式会社イコーズ 社内専用 船舶部品・資材・予算発注システム</span>
              </p>
            </>
          )}
        </div>

        {/* 認証モード切り替えタブ */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600">
          <button
            type="button"
            onClick={() => { setAuthMode('vessel'); setStatusMessage(null); }}
            className={`flex-1 py-3 px-2 flex items-center justify-center gap-1 border-b-2 transition-all cursor-pointer ${
              authMode === 'vessel'
                ? 'border-emerald-600 text-emerald-700 font-extrabold bg-emerald-50/80'
                : 'border-transparent hover:bg-slate-100 text-emerald-800'
            }`}
          >
            <Ship className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="flex items-center gap-1">
              船員用 🚢 
              <span className="text-[9px] bg-amber-200 text-amber-900 font-bold px-1 py-0.5 rounded leading-none shrink-0">開発中</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('signin'); setStatusMessage(null); }}
            className={`flex-1 py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              authMode === 'signin'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent hover:bg-slate-100'
            }`}
          >
            <LogIn className="h-4 w-4" />
            <span>陸側ログイン</span>
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('signup'); setStatusMessage(null); }}
            className={`flex-1 py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              authMode === 'signup'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent hover:bg-slate-100'
            }`}
          >
            <UserPlus className="h-4 w-4 text-slate-500" />
            <span>新規登録</span>
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('guest'); setStatusMessage(null); }}
            className={`flex-1 py-3 px-2 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              authMode === 'guest'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent hover:bg-slate-100 text-slate-500'
            }`}
          >
            <UserCheck className="h-4 w-4 text-slate-500" />
            <span>ゲスト</span>
          </button>
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
                  パスワードまたは認証コードでログインし、有効期限を更新してください。
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="p-7 space-y-5">

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

          {/* 0. 船員専用ログインモード */}
          {authMode === 'vessel' && (
            <form onSubmit={handleVesselLoginSubmit} className="space-y-4">
              {/* 開発中注意バナー */}
              <div className="bg-amber-50 border-2 border-amber-300 p-3.5 rounded-xl text-amber-950 text-xs shadow-sm">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-extrabold text-amber-950 text-xs">
                      ⚠️ 【現在開発中】船員用ログインはテスト開発中の機能です
                    </p>
                    <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                      現在調整中のため、一般ユーザー様はお手を触れないようお願いいたします。（※テスト試用・動作検証自体は可能です）
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50/90 border border-emerald-200 p-4 rounded-xl space-y-3">
                <div>
                  <label className="block text-xs font-bold text-emerald-950 mb-1.5 flex items-center gap-1.5">
                    <Ship className="h-4 w-4 text-emerald-700" />
                    <span>乗船中の船名を選択してください</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedVesselShip}
                    onChange={e => setSelectedVesselShip(e.target.value)}
                    className="w-full text-sm font-bold text-slate-800 px-4 py-3 border-2 border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white shadow-sm cursor-pointer"
                  >
                    {VESSEL_ACCOUNTS.map(v => (
                      <option key={v.shipName} value={v.shipName}>
                        🚢 {v.shipName} ({v.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-1 text-xs text-emerald-900 flex items-center justify-between border-t border-emerald-200/60">
                  <span>登録メールアドレス:</span>
                  <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-emerald-200">
                    {getEmailByShipName(selectedVesselShip)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lock className="h-4 w-4 text-emerald-700" />
                    <span>船用ログインパスワード</span>
                    <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[11px] text-emerald-700 font-semibold">初期共通: IKOUS</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="IKOUS"
                  value={vesselPasswordInput}
                  onChange={e => setVesselPasswordInput(e.target.value)}
                  className="w-full text-sm font-mono font-bold px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-700/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    <span>ログイン認証中...</span>
                  </>
                ) : (
                  <>
                    <Ship className="h-5 w-5" />
                    <span>【{selectedVesselShip}】専用発注画面へログイン</span>
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* 1. ログインモード (メール & パスワード) */}
          {authMode === 'signin' && (
            <form onSubmit={handleFirebaseSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-indigo-600" />
                  <span>メールアドレス</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="yourname@ikous.co.jp"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  className="w-full text-xs font-semibold px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lock className="h-4 w-4 text-indigo-600" />
                    <span>パスワード</span>
                    <span className="text-rose-500">*</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('reset'); setStatusMessage(null); }}
                    className="text-[11px] text-indigo-600 hover:underline font-semibold"
                  >
                    パスワードをお忘れですか？
                  </button>
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  className="w-full text-xs font-semibold px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md hover:shadow-indigo-500/20 text-xs cursor-pointer disabled:opacity-50"
                >
                  <LogIn className="h-4 w-4" />
                  <span>ログイン</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          {/* 2. 新規アカウント作成モード */}
          {authMode === 'signup' && (
            <form onSubmit={handleFirebaseSignUp} className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs text-emerald-950 leading-relaxed shadow-xs space-y-1">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>【社内専用】@ikous.co.jp アカウント専用</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-normal">
                  セキュリティ保護のため、アカウント登録は社内ドメイン（<strong className="text-indigo-700">@ikous.co.jp</strong>）のメールアドレスのみ可能です。登録後、その場で即時開通・ログイン完了します。
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-indigo-600" />
                    <span>メールアドレス</span>
                    <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[10px] font-mono text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    @ikous.co.jp 限定
                  </span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="yourname@ikous.co.jp"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  className="w-full text-xs font-semibold px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Lock className="h-4 w-4 text-indigo-600" />
                  <span>パスワード (6文字以上)</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="6文字以上で設定"
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  className="w-full text-xs font-semibold px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-indigo-600" />
                  <span>お名前（氏名）</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="例: 大野 隆太"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  className="w-full text-xs font-semibold px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                  <span>部署名</span>
                </label>
                <input
                  type="text"
                  placeholder="株式会社イコーズ 工務部"
                  value={departmentInput}
                  onChange={e => setDepartmentInput(e.target.value)}
                  className="w-full text-xs font-semibold px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md text-xs cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>新規アカウントを作成してログイン</span>
                </button>
              </div>
            </form>
          )}

          {/* 3. パスワード再設定モード */}
          {authMode === 'reset' && (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="text-xs text-slate-600">
                ご登録のメールアドレスを入力してください。パスワード再設定用のリンクをメールでお送りします。
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-indigo-600" />
                  <span>メールアドレス</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="yourname@ikous.co.jp"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  className="w-full text-xs font-semibold px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setAuthMode('signin'); setStatusMessage(null); }}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  戻る
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shadow-md cursor-pointer disabled:opacity-50"
                >
                  再設定メールを送信
                </button>
              </div>
            </form>
          )}

          {/* 4. 簡易ゲストログインモード */}
          {authMode === 'guest' && (
            <form onSubmit={handleGuestLoginSubmit} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-xs text-slate-700 leading-relaxed shadow-xs space-y-2">
                <div className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                  <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>パスワード不要・1クリック即時ログイン</span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  ID・パスワードなしでどなたでもゲストとして画面・予算データを閲覧できます。
                </p>
                <div className="bg-amber-50 border border-amber-200 text-amber-900 text-[11px] p-2.5 rounded-lg font-medium space-y-1">
                  <p className="font-bold text-amber-950 flex items-center gap-1">
                    <span>⚠️ ゲスト権限の制限事項</span>
                  </p>
                  <p>・発注書の作成および内容の編集・削除はできません。</p>
                  <p className="font-bold text-rose-800">・印刷・PDFプレビュー出力はできません（画面閲覧のみ）。</p>
                  <p>・ログイン日時および識別アドレスは管理者の監査ログに自動記録されます。</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  お名前・部署名（任意入力）
                </label>
                <input
                  type="text"
                  placeholder="例: 見学ゲスト / 横浜営業所"
                  value={guestNameInput}
                  onChange={e => setGuestNameInput(e.target.value)}
                  className="w-full text-xs font-semibold px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md text-xs cursor-pointer disabled:opacity-50"
                >
                  <UserCheck className="h-4 w-4 text-emerald-400" />
                  <span>ゲストとしてログイン（閲覧専用）</span>
                  <ArrowRight className="h-4 w-4" />
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
                アカウント認証仕様と1年周期再認証ルール
              </span>
              <span className="text-[11px] underline">説明を見る</span>
            </button>
          </div>

        </div>

        {/* フッター */}
        <div className="bg-slate-100 px-6 py-3 text-center text-[11px] text-slate-500 border-t border-slate-200 flex items-center justify-between">
          <span>🔒 株式会社イコーズ クラウド認証システム</span>
          <span className="font-semibold text-slate-600">Firebase セキュリティ統合</span>
        </div>

      </div>

      {/* 1年毎の年次再認証ルール解説モーダル */}
      {showGuideModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                Firebase認証 ＆ 年次アカウント管理解説
              </h3>
              <button
                onClick={() => setShowGuideModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                閉じる
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
              <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-xl space-y-1">
                <h4 className="font-bold text-indigo-900 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-indigo-600" />
                  リアルメールアカウント機能
                </h4>
                <p>
                  ご自身のメールアドレスとパスワードでアカウントを作成・保持できます。登録情報はFirebase Auth & Firestoreクラウドデータベースに同期されます。
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-900 border-l-4 border-indigo-600 pl-2">
                  主なポイント
                </h4>
                <ul className="list-disc list-inside space-y-1 pl-1 text-slate-600">
                  <li><strong>新規アカウント作成:</strong> 「新規アカウント作成」タブからリアルなメールアドレスとパスワードを設定してご自身のアカウントを作成できます。</li>
                  <li><strong>ログイン:</strong> 登録したメールアドレスとパスワードで安全にログインできます。</li>
                  <li><strong>安全対策:</strong> 退職者や無効化対象のアカウントは、管理者画面から瞬時に停止処理が可能です。</li>
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

