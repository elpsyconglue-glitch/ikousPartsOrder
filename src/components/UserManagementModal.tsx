import React, { useState, useEffect } from 'react';
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
  UserPlus,
  RefreshCw,
  Clock
} from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function UserManagementModal({ onClose }: Props) {
  const { 
    user: currentUser, 
    allUsers, 
    guestAccessLogs,
    suspendUser, 
    activateUser, 
    updateUserRole, 
    deleteUser,
    sendVerificationCode,
    clearGuestLogs,
    refreshUsersAndLogs
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'USERS' | 'GUEST_LOGS'>('USERS');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'active' | 'suspended'>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');

  // ユーザーごとの未適用（変更中）権限
  const [pendingRoles, setPendingRoles] = useState<{ [email: string]: UserRole }>({});

  // モーダルが開いたタイミングで最新データをリアルタイム同期・リフレッシュ
  useEffect(() => {
    handleManualRefresh();
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshUsersAndLogs();
    const now = new Date();
    setLastRefreshedAt(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // 権限変更の適用処理（押した瞬間に全アカウントへ即時同期）
  const handleApplyRoleChange = async (targetEmail: string, userName: string) => {
    const newRole = pendingRoles[targetEmail];
    if (!newRole) return;

    await updateUserRole(targetEmail, newRole);

    setPendingRoles(prev => {
      const next = { ...prev };
      delete next[targetEmail];
      return next;
    });

    setAddNotice(`【権限変更適用】${userName} 様 (${targetEmail}) の権限を「${newRole}」に更新し、全アカウントへ即時反映しました。`);
    setTimeout(() => setAddNotice(null), 5000);
  };

  // オンライン・最終アクセスのフォーマット関数
  const getOnlineStatus = (u: UserProfile) => {
    const isSelf = currentUser?.email.toLowerCase() === u.email.toLowerCase();
    if (u.status === 'suspended') {
      return { isOnline: false, label: '停止中（退職等）', badgeColor: 'bg-rose-100 text-rose-800 border-rose-300' };
    }

    if (isSelf) {
      return { isOnline: true, label: 'ログイン中 (自端末)', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300 ring-2 ring-emerald-400/30' };
    }

    if (!u.lastActiveAt) {
      return { isOnline: false, label: '登録済み (オフライン)', badgeColor: 'bg-slate-100 text-slate-600 border-slate-300' };
    }

    const lastActiveTime = new Date(u.lastActiveAt).getTime();
    const nowTime = Date.now();
    const diffMinutes = Math.floor((nowTime - lastActiveTime) / (1000 * 60));

    // 3分以内にアクティブであれば「ログイン中（オンライン）」と判定
    if (diffMinutes <= 3) {
      return { isOnline: true, label: '🟢 ログイン中 (オンライン)', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    } else if (diffMinutes < 60) {
      return { isOnline: false, label: `${diffMinutes}分前にアクセス`, badgeColor: 'bg-amber-50 text-amber-900 border-amber-300' };
    } else if (diffMinutes < 24 * 60) {
      const hours = Math.floor(diffMinutes / 60);
      return { isOnline: false, label: `${hours}時間前にアクセス`, badgeColor: 'bg-slate-100 text-slate-700 border-slate-300' };
    } else {
      const dateStr = new Date(u.lastActiveAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return { isOnline: false, label: `最終: ${dateStr}`, badgeColor: 'bg-slate-100 text-slate-600 border-slate-300' };
    }
  };

  // 権限剥奪の対象ユーザー
  const [targetUserToSuspend, setTargetUserToSuspend] = useState<UserProfile | null>(null);

  // 新規社員招待・登録フォーム
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
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
      setAddNotice(`【招待完了】${newEmail} (${newName}様) 宛に「${newRole}」権限でアカウントを開通しました。`);
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

        {/* サブバー：管理者情報 & 手動更新ボタン & モード切り替えタブ */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-3 text-slate-700">
            <div className="flex items-center gap-1.5 font-bold">
              <span>操作管理者:</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-900 font-bold">
                {currentUser?.name} ({currentUser?.email})
              </span>
              <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-300">
                {currentUser?.role}
              </span>
            </div>

            {/* 手動更新ボタン */}
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg shadow-2xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              title="押した瞬間の最新のメンバー状態・ゲストアクセス状況を再読み込み"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-indigo-600 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>最新状況に更新</span>
              {lastRefreshedAt && (
                <span className="text-[10px] font-mono text-slate-400 font-normal">({lastRefreshedAt})</span>
              )}
            </button>
          </div>

          {/* タブ切り替えボタン */}
          <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('USERS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'USERS'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="h-4 w-4 text-indigo-600" />
              <span>社員アカウント・権限設定 ({allUsers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('GUEST_LOGS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'GUEST_LOGS'
                  ? 'bg-white text-emerald-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="h-4 w-4 text-emerald-600" />
              <span>ゲストアクセス閲覧ログ ({guestAccessLogs.length})</span>
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

          {/* USERS タブ */}
          {activeTab === 'USERS' && (
            <div className="space-y-5 animate-fadeIn">
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
                      招待・アカウント発行
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
                        <th className="py-3 px-4">社員氏名 / ログイン名</th>
                        <th className="py-3 px-4">メールアドレス（ログインID）</th>
                        <th className="py-3 px-4">所属部署</th>
                        <th className="py-3 px-4">システム権限（ロール）</th>
                        <th className="py-3 px-4">アクセス状況</th>
                        <th className="py-3 px-4 text-center">退職・権限操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            該当する社員アカウントが見つかりません。
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map(u => {
                          const isSelf = currentUser?.email.toLowerCase() === u.email.toLowerCase();
                          const isSuspended = u.status === 'suspended';
                          const currentRoleDisplay = u.role === ('システム管理者' as any) ? '管理者' : u.role;
                          const selectedRole = pendingRoles[u.email] !== undefined ? pendingRoles[u.email] : currentRoleDisplay;
                          const isRoleChanged = selectedRole !== currentRoleDisplay;

                          return (
                            <tr key={u.email} className={`hover:bg-slate-50 transition-colors ${isSuspended ? 'bg-rose-50/40' : ''}`}>
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <span>{u.name}</span>
                                  {isSelf && (
                                    <span className="text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-200 px-1.5 py-0.2 rounded font-bold">
                                      あなた (自端末)
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-4 font-mono font-medium text-slate-700">
                                {u.email}
                              </td>

                              <td className="py-3 px-4 text-slate-600 font-medium">
                                {u.department || '未設定'}
                              </td>

                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <select
                                    value={selectedRole}
                                    onChange={e => {
                                      const val = e.target.value as UserRole;
                                      setPendingRoles(prev => ({ ...prev, [u.email]: val }));
                                    }}
                                    className={`text-xs px-2.5 py-1.5 rounded-lg font-bold border transition-all cursor-pointer ${
                                      isRoleChanged
                                        ? 'bg-amber-50 text-amber-900 border-amber-400 ring-2 ring-amber-300'
                                        : selectedRole === '管理者'
                                        ? 'bg-indigo-50 text-indigo-900 border-indigo-300 focus:ring-2 focus:ring-indigo-500'
                                        : selectedRole === '一般ユーザー'
                                        ? 'bg-blue-50 text-blue-900 border-blue-300 focus:ring-2 focus:ring-blue-500'
                                        : 'bg-slate-100 text-slate-700 border-slate-300 focus:ring-2 focus:ring-slate-400'
                                    }`}
                                  >
                                    <option value="閲覧のみ">👁 閲覧のみ (発注不可・印刷可)</option>
                                    <option value="一般ユーザー">✍️ 一般ユーザー (発注・編集可)</option>
                                    <option value="管理者">👑 管理者 (全権限管理)</option>
                                  </select>

                                  <button
                                    onClick={() => handleApplyRoleChange(u.email, u.name)}
                                    disabled={!isRoleChanged}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                      isRoleChanged
                                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md active:scale-95 cursor-pointer ring-2 ring-indigo-400/50'
                                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                    }`}
                                    title={isRoleChanged ? '変更した権限を確定して全アカウントへ即時同期' : '権限を変更すると「適用」ボタンが点灯します'}
                                  >
                                    <CheckCircle2 className={`h-3.5 w-3.5 ${isRoleChanged ? 'text-white' : 'text-slate-400'}`} />
                                    <span>適用</span>
                                  </button>
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                {(() => {
                                  const statusInfo = getOnlineStatus(u);
                                  return (
                                    <div className="flex flex-col gap-1 items-start">
                                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusInfo.badgeColor}`}>
                                        {statusInfo.isOnline && (
                                          <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                          </span>
                                        )}
                                        <span>{statusInfo.label}</span>
                                      </span>
                                    </div>
                                  );
                                })()}
                              </td>

                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-2">
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
          )}

          {/* GUEST_LOGS タブ */}
          {activeTab === 'GUEST_LOGS' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs">
                <div>
                  <h3 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                    <Eye className="h-4 w-4 text-emerald-600" />
                    <span>簡易ゲストログイン 監査アクセスログ</span>
                  </h3>
                  <p className="text-slate-500 mt-0.5 text-[11px]">
                    何時何分に誰（どんな表示名・識別用アドレス）がゲストとしてログインしたかの全記録です。
                  </p>
                </div>

                {guestAccessLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('ゲストアクセスログの全履歴を消去しますか？')) {
                        clearGuestLogs();
                      }
                    }}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>ログ全件消去</span>
                  </button>
                )}
              </div>

              {/* ログテーブル */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="py-3 px-4">アクセス日時 (何時何分)</th>
                        <th className="py-3 px-4">ゲスト表示名</th>
                        <th className="py-3 px-4">識別アドレス</th>
                        <th className="py-3 px-4">権限レベル</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {guestAccessLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-slate-400">
                            ゲストアクセスの履歴はまだありません。
                          </td>
                        </tr>
                      ) : (
                        guestAccessLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900 flex items-center gap-1.5">
                              <BadgeCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                              <span>{log.formattedLoginAt || log.loginAt}</span>
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-800">
                              {log.guestName}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                              {log.email}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                🔒 ゲスト（閲覧専用・印刷不可）
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

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

