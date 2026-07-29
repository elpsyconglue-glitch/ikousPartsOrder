import React, { useState } from 'react';
import { useAuth, UserProfile } from '../auth/AuthContext';
import { UserRole } from '../types';
import ProtectedActionModal from './ProtectedActionModal';
import { 
  Users, 
  ShieldCheck, 
  ShieldAlert, 
  UserX, 
  UserCheck, 
  Trash2, 
  Plus, 
  Search, 
  Lock, 
  Eye,
  CheckCircle2, 
  AlertCircle,
  X,
  BadgeCheck,
  UserPlus
} from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function UserManagementModal({ onClose }: Props) {
  const { 
    user: currentUser, 
    allUsers, 
    suspendUser, 
    activateUser, 
    updateUserRole, 
    deleteUser,
    sendVerificationCode,
    toggleMyRoleForDemo
  } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'active' | 'suspended'>('ALL');
  
  // 権限剥奪の対象ユーザー
  const [targetUserToSuspend, setTargetUserToSuspend] = useState<UserProfile | null>(null);

  // 新規社員招待・登録フォーム
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newDepartment, setNewDepartment] = useState('株式会社イコーズ 工務部');
  const [newRole, setNewRole] = useState<UserRole>('閲覧のみ');
  const [addNotice, setAddNotice] = useState<string | null>(null);

  // 検索・フィルタリングされたユーザー
  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = u.name.includes(searchTerm) || u.email.toLowerCase().includes(searchTerm.toLowerCase()) || u.department.includes(searchTerm);
    const matchesStatus = filterStatus === 'ALL' || u.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newName) return;

    const res = await sendVerificationCode(newEmail, newName);
    if (res.success) {
      // 登録された新規ユーザーの初期権限を設定
      updateUserRole(newEmail, newRole);
      setAddNotice(`【招待完了】${newEmail} (${newName}様) 宛に「${newRole}」権限でアカウント開通コード (${res.demoCode}) を送信しました。`);
      setNewEmail('');
      setNewName('');
      setTimeout(() => setAddNotice(null), 5000);
      setShowAddForm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200">
        
        {/* モーダルヘッダー */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/30 text-indigo-300 rounded-xl border border-indigo-500/30">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                株式会社イコーズ 社員・アカウント権限管理コンソール
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  管理者専用
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                全社員のシステム権限（閲覧のみ / 一般ユーザー / 管理者）の変更・設定および退職者のアクセス停止管理
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* サブバー：管理者用デモ切り替え＆状態 */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="font-bold">現在の操作アカウント:</span>
            <span className="font-mono bg-white px-2 py-1 rounded border border-slate-200 text-slate-900 font-bold">
              {currentUser?.name} ({currentUser?.email})
            </span>
            <span className={`px-2.5 py-0.5 rounded-md font-bold text-[11px] ${
              currentUser?.role === '管理者' || (currentUser?.role as string) === 'システム管理者'
                ? 'bg-indigo-100 text-indigo-800 border border-indigo-300' 
                : currentUser?.role === '一般ユーザー'
                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                : 'bg-slate-200 text-slate-700 border border-slate-300'
            }`}>
              {currentUser?.role}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleMyRoleForDemo}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-[11px] shadow-xs transition-colors cursor-pointer flex items-center gap-1"
              title="ロール切り替えテスト（管理者 ➔ 一般ユーザー ➔ 閲覧のみ）"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>【テスト用】自分の権限を切替 ({currentUser?.role} ➔ 次の権限)</span>
            </button>
          </div>
        </div>

        {/* 通知エリア */}
        {addNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 p-3 px-6 text-xs text-emerald-800 font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{addNotice}</span>
          </div>
        )}

        {/* コンテンツメイン */}
        <div className="p-6 space-y-5">

          {/* 検索・フィルター・追加アクション */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="氏名、メール、部署で検索..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as any)}
                className="text-xs py-2 px-3 border border-slate-300 rounded-xl bg-white font-semibold text-slate-700"
              >
                <option value="ALL">全てのステータス ({allUsers.length})</option>
                <option value="active">利用可能のみ ({allUsers.filter(u => u.status === 'active').length})</option>
                <option value="suspended">アクセス停止済み ({allUsers.filter(u => u.status === 'suspended').length})</option>
              </select>
            </div>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <UserPlus className="h-4 w-4" />
              <span>新規社員アカウント発行・招待</span>
            </button>
          </div>

          {/* 新規ユーザー追加フォーム */}
          {showAddForm && (
            <form onSubmit={handleCreateUser} className="bg-slate-50 border border-indigo-200 p-4 rounded-xl space-y-3 animate-fadeIn">
              <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                <UserPlus className="h-4 w-4 text-indigo-600" />
                新規社員のアカウント開通登録
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">氏名</label>
                  <input
                    type="text"
                    required
                    placeholder="高橋 健太"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center justify-between">
                    <span>社内メールアドレス</span>
                    <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">@ikous.co.jp 限定</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="takahashi@ikous.co.jp"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">初期付与権限</label>
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value as UserRole)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white font-bold text-slate-800"
                  >
                    <option value="閲覧のみ">👁 閲覧のみ (見るだけ・発注不可・印刷可)</option>
                    <option value="一般ユーザー">✍️ 一般ユーザー (発注・編集・印刷可)</option>
                    <option value="管理者">👑 管理者 (全権限・船や権限の管理可)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  招待・開通コード発行
                </button>
              </div>
            </form>
          )}

          {/* 社員・アカウント一覧テーブル */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4">社員氏名 / 部署</th>
                    <th className="py-3 px-4">メールアドレス</th>
                    <th className="py-3 px-4">システム権限（ロール）</th>
                    <th className="py-3 px-4">アクセス状況</th>
                    <th className="py-3 px-4 text-center">退職時操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        該当する社員アカウントが見つかりません。
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => {
                      const isSelf = currentUser?.email.toLowerCase() === u.email.toLowerCase();
                      const isSuspended = u.status === 'suspended';
                      const currentRoleDisplay = u.role === ('システム管理者' as any) ? '管理者' : u.role;

                      return (
                        <tr key={u.email} className={`hover:bg-slate-50 transition-colors ${isSuspended ? 'bg-rose-50/40' : ''}`}>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {isSelf && (
                                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                                  あなた
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">{u.department}</div>
                          </td>

                          <td className="py-3 px-4 font-mono font-medium text-slate-700">
                            {u.email}
                          </td>

                          <td className="py-3 px-4">
                            <div className="relative inline-block">
                              <select
                                value={currentRoleDisplay}
                                onChange={e => updateUserRole(u.email, e.target.value as UserRole)}
                                className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
                                  currentRoleDisplay === '管理者'
                                    ? 'bg-indigo-50 text-indigo-900 border-indigo-300 focus:ring-2 focus:ring-indigo-500'
                                    : currentRoleDisplay === '一般ユーザー'
                                    ? 'bg-blue-50 text-blue-900 border-blue-300 focus:ring-2 focus:ring-blue-500'
                                    : 'bg-slate-100 text-slate-700 border-slate-300 focus:ring-2 focus:ring-slate-400'
                                }`}
                              >
                                <option value="閲覧のみ">👁 閲覧のみ (発注不可・印刷可)</option>
                                <option value="一般ユーザー">✍️ 一般ユーザー (発注・編集可)</option>
                                <option value="管理者">👑 管理者 (全権限管理)</option>
                              </select>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {isSuspended ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                <UserX className="h-3.5 w-3.5 text-rose-600" />
                                停止（退職・離職）
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                通常利用可能
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {/* 退職・無効化ボタン */}
                              {isSuspended ? (
                                <button
                                  onClick={() => activateUser(u.email)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                                  title="アカウントの停止を解除してアクセス再開"
                                >
                                  <UserCheck className="h-3.5 w-3.5" />
                                  <span>利用再開</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => setTargetUserToSuspend(u)}
                                  disabled={isSelf}
                                  className={`px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                                    isSelf ? 'opacity-40 cursor-not-allowed' : ''
                                  }`}
                                  title="社員退職時などにアカウントを無効化してアクセス権限を完全剥奪"
                                >
                                  <UserX className="h-3.5 w-3.5" />
                                  <span>権限剥奪（退職）</span>
                                </button>
                              )}

                              {/* アカウント完全削除ボタン */}
                              {!isSelf && (
                                <button
                                  onClick={() => {
                                    if (confirm(`${u.name} 様のアカウント情報を完全に削除しますか？`)) {
                                      deleteUser(u.email);
                                    }
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="アカウント削除"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 説明書きヘルプ */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-2">
            <p className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-indigo-600" />
              システム権限（ロール）の定義・区分一覧
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="bg-white border border-slate-200 p-2.5 rounded-lg space-y-1">
                <span className="font-bold text-slate-800 block">👁 閲覧のみ (Viewer)</span>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  データの閲覧、および予算発注履歴の印刷・PDF保存のみ可能。発注書の新規作成・内容編集・注文送信・手動実績追加はできません。
                </p>
              </div>
              <div className="bg-white border border-slate-200 p-2.5 rounded-lg space-y-1">
                <span className="font-bold text-blue-900 block">✍️ 一般ユーザー (User)</span>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  発注書の作成・印刷・編集、および手動実績追加・削除など通常業務すべて可能。船の追加/削除および権限管理は不可。
                </p>
              </div>
              <div className="bg-white border border-indigo-200 p-2.5 rounded-lg space-y-1">
                <span className="font-bold text-indigo-900 block">👑 管理者 (Admin)</span>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  全ての操作が可能。船の新規登録・削除、およびこの権限管理画面で全ユーザーの権限（ロール）を自由に設定変更・昇降格できます。
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* モーダルフッター */}
        <div className="bg-slate-100 px-6 py-3 text-right border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>

      </div>

      {/* 2段階確認用パスワード保護モーダル */}
      <ProtectedActionModal
        isOpen={!!targetUserToSuspend}
        onClose={() => setTargetUserToSuspend(null)}
        onSuccess={() => {
          if (targetUserToSuspend) {
            suspendUser(targetUserToSuspend.email);
            setTargetUserToSuspend(null);
          }
        }}
        title="社員アカウントのアクセス権限剥奪（退職処理）"
        description={`${targetUserToSuspend?.name} 様 (${targetUserToSuspend?.email}) のアカウントを無効化し、システムへのアクセス権限およびメール認証を完全停止します。`}
        actionButtonText="権限を剥奪（アカウント停止）"
        actionButtonColor="rose"
      />
    </div>
  );
}

