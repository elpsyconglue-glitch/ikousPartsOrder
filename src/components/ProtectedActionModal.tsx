import React, { useState, useEffect } from 'react';
import { Lock, ShieldAlert, AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface ProtectedActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title: string;
  description: string;
  actionButtonText: string;
  actionButtonColor?: 'rose' | 'indigo';
}

export default function ProtectedActionModal({
  isOpen,
  onClose,
  onSuccess,
  title,
  description,
  actionButtonText,
  actionButtonColor = 'rose'
}: ProtectedActionModalProps) {
  // ステップ: 'password' (PW入力) -> 'confirm' (最終確認)
  const [step, setStep] = useState<'password' | 'confirm'>('password');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // モーダルが開くたびに初期化
  useEffect(() => {
    if (isOpen) {
      setStep('password');
      setPassword('');
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // パスワード確認処理 (PW: ikous)
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim() === 'ikous') {
      setErrorMsg(null);
      setStep('confirm'); // Step 2 へ
    } else {
      setErrorMsg('パスワードが正しくありません。');
    }
  };

  // 最終実行処理
  const handleFinalConfirm = () => {
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        
        {/* モーダルヘッダー */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-400" />
            <h3 className="font-bold text-sm text-white">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          
          {/* STEP 1: パスワード入力画面 */}
          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex gap-2.5 items-start">
                <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">【ステップ 1 / 2】パスワード保護確認</p>
                  <p className="mt-0.5 text-amber-800 leading-relaxed">
                    この重要操作を実行するには、特定のパスワード（<strong>ikous</strong>）の入力が必要です。
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  特定のパスワードを入力してください (PW)
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="PWを入力 (ikous)"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="w-full text-sm px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                {errorMsg && (
                  <p className="text-xs font-bold text-rose-600 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {errorMsg}
                  </p>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                  次へ（パスワード認証）
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: 最終実行確認画面 */}
          {step === 'confirm' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-rose-800 text-sm">
                  <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                  <span>【ステップ 2 / 2】最終確認</span>
                </div>
                <p className="font-semibold text-slate-800 leading-relaxed">
                  {description}
                </p>
                <p className="font-bold text-rose-700 text-[11px] pt-1">
                  本当に実行しますか？ この操作は取り消せません。
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleFinalConfirm}
                  className={`px-5 py-2 text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer shadow-md ${
                    actionButtonColor === 'rose'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {actionButtonText}
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
