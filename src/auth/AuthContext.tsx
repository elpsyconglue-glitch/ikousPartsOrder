import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  department: string;
  role: 'システム管理者' | '一般ユーザー';
  status: 'active' | 'suspended'; // active: 通常利用可能, suspended: 離職・異動等による停止
  createdAt: string;     // アカウント開通日 (ISO string)
  lastVerifiedAt: string;// 最終メール認証日 (ISO string)
  expiresAt: string;     // 年次認証期限 (1年後 ISO string)
}

interface PendingVerification {
  email: string;
  name: string;
  code: string;
  sentAt: number;
  isAnnualRenewal?: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserProfile | null;
  allUsers: UserProfile[];
  pendingVerification: PendingVerification | null;
  sendVerificationCode: (email: string, name?: string) => Promise<{ success: boolean; message: string; demoCode?: string }>;
  verifyCodeAndLogin: (code: string) => { success: boolean; message: string };
  logout: () => void;
  renewAnnualAccount: () => void;
  simulateExpireAccount: () => void;
  isAccountExpired: boolean;
  daysUntilExpiration: number | null;
  
  // 管理者専用機能
  suspendUser: (email: string) => void;
  activateUser: (email: string) => void;
  toggleAdminRole: (email: string) => void;
  deleteUser: (email: string) => void;
  toggleMyRoleForDemo: () => void; // テスト用ロール切替
}

const STORAGE_KEY_USER = 'ikous_auth_user';
const STORAGE_KEY_ALL_USERS = 'ikous_all_users_list';

// 初期デフォルトユーザーリスト（サンプル）
const INITIAL_USERS: UserProfile[] = [
  {
    id: 'usr_admin',
    name: '井本 尚',
    email: 'imoto@ikous.co.jp',
    department: '株式会社イコーズ 役員・管理部',
    role: 'システム管理者',
    status: 'active',
    createdAt: new Date('2026-01-01').toISOString(),
    lastVerifiedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'usr_yamada',
    name: '山田 太郎',
    email: 'yamada@ikous.co.jp',
    department: '株式会社イコーズ 工務部',
    role: '一般ユーザー',
    status: 'active',
    createdAt: new Date('2026-02-15').toISOString(),
    lastVerifiedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'usr_sato',
    name: '佐藤 次郎',
    email: 'sato@ikous.co.jp',
    department: '株式会社イコーズ 運航部',
    role: '一般ユーザー',
    status: 'active',
    createdAt: new Date('2026-03-01').toISOString(),
    lastVerifiedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  }
];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 全登録ユーザーリストの保持
  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ALL_USERS);
      return saved ? JSON.parse(saved) : INITIAL_USERS;
    } catch {
      return INITIAL_USERS;
    }
  });

  // 現在ログイン中のユーザー
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);

  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

  // 全ユーザーリストの変更をストレージに同期
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ALL_USERS, JSON.stringify(allUsers));
    // ログイン中のユーザーの状態（無効化など）が変更されたら反映
    if (user) {
      const updatedSelf = allUsers.find(u => u.email.toLowerCase() === user.email.toLowerCase());
      if (updatedSelf) {
        setUser(updatedSelf);
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedSelf));
      }
    }
  }, [allUsers]);

  // アカウントが1年経過して期限切れかどうかチェック
  const isAccountExpired = React.useMemo(() => {
    if (!user || !user.expiresAt) return false;
    const now = new Date().getTime();
    const expiry = new Date(user.expiresAt).getTime();
    return now >= expiry;
  }, [user]);

  // 有効期限までの残り日数
  const daysUntilExpiration = React.useMemo(() => {
    if (!user || !user.expiresAt) return null;
    const now = new Date().getTime();
    const expiry = new Date(user.expiresAt).getTime();
    const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [user]);

  // メール認証コードの送信
  const sendVerificationCode = async (email: string, name?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    
    if (!cleanEmail.includes('@')) {
      return { success: false, message: '有効なメールアドレスを入力してください。' };
    }

    // アカウントの停止状態をあらかじめチェック
    const existing = allUsers.find(u => u.email.toLowerCase() === cleanEmail);
    if (existing && existing.status === 'suspended') {
      return {
        success: false,
        message: '【アクセス拒否】このアカウントは管理者により無効化・停止されています。社内のシステム管理者にお問い合わせください。'
      };
    }

    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    const userName = name || (existing ? existing.name : cleanEmail.split('@')[0]);

    const pending: PendingVerification = {
      email: cleanEmail,
      name: userName,
      code: generatedCode,
      sentAt: Date.now(),
      isAnnualRenewal: isAccountExpired,
    };

    setPendingVerification(pending);

    return {
      success: true,
      message: `${cleanEmail} 宛に6桁の認証コードを送信しました。`,
      demoCode: generatedCode,
    };
  };

  // 認証コードの検証とログイン/1年更新
  const verifyCodeAndLogin = (inputCode: string) => {
    if (!pendingVerification) {
      return { success: false, message: '認証リクエストが見つかりません。再送信してください。' };
    }

    if (pendingVerification.code !== inputCode.trim()) {
      return { success: false, message: '認証コードが一致しません。正しく入力してください。' };
    }

    // 再チェック：停止アカウントでないか
    const existingIndex = allUsers.findIndex(u => u.email.toLowerCase() === pendingVerification.email.toLowerCase());
    if (existingIndex !== -1 && allUsers[existingIndex].status === 'suspended') {
      return {
        success: false,
        message: '【アクセス拒否】このアカウントは無効化・停止されています。'
      };
    }

    const now = new Date();
    const oneYearLater = new Date(now.getTime() + ONE_YEAR_MS);

    let updatedUser: UserProfile;

    if (existingIndex !== -1) {
      // 既存ユーザーの年次更新＆ログイン
      const target = allUsers[existingIndex];
      updatedUser = {
        ...target,
        name: pendingVerification.name || target.name,
        lastVerifiedAt: now.toISOString(),
        expiresAt: oneYearLater.toISOString(),
      };
      
      const newAllUsers = [...allUsers];
      newAllUsers[existingIndex] = updatedUser;
      setAllUsers(newAllUsers);
    } else {
      // 新規ユーザー登録
      // メールのローカルパートが imoto や admin を含む場合は管理者初期割り当て
      const isAdminByEmail = pendingVerification.email.startsWith('imoto') || pendingVerification.email.startsWith('admin');
      
      updatedUser = {
        id: `usr_${Date.now()}`,
        name: pendingVerification.name,
        email: pendingVerification.email,
        department: '株式会社イコーズ 工務部',
        role: isAdminByEmail ? 'システム管理者' : '一般ユーザー',
        status: 'active',
        createdAt: now.toISOString(),
        lastVerifiedAt: now.toISOString(),
        expiresAt: oneYearLater.toISOString(),
      };
      setAllUsers(prev => [updatedUser, ...prev]);
    }

    setUser(updatedUser);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
    setPendingVerification(null);

    return {
      success: true,
      message: 'メール認証が完了しました。アカウントが1年間有効化されました。',
    };
  };

  const renewAnnualAccount = () => {
    if (user) {
      sendVerificationCode(user.email, user.name);
    }
  };

  const simulateExpireAccount = () => {
    if (!user) return;
    const expiredDate = new Date(Date.now() - 1000).toISOString();
    const updated = {
      ...user,
      expiresAt: expiredDate,
    };
    setUser(updated);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updated));
  };

  // --- 管理者専用機能 ---

  // アカウント無効化（退職時など）
  const suspendUser = (targetEmail: string) => {
    setAllUsers(prev => prev.map(u => {
      if (u.email.toLowerCase() === targetEmail.toLowerCase()) {
        return { ...u, status: 'suspended' };
      }
      return u;
    }));
  };

  // アカウント有効化（再開）
  const activateUser = (targetEmail: string) => {
    setAllUsers(prev => prev.map(u => {
      if (u.email.toLowerCase() === targetEmail.toLowerCase()) {
        return { ...u, status: 'active' };
      }
      return u;
    }));
  };

  // 管理者権限の付与 / 解除
  const toggleAdminRole = (targetEmail: string) => {
    setAllUsers(prev => prev.map(u => {
      if (u.email.toLowerCase() === targetEmail.toLowerCase()) {
        const newRole = u.role === 'システム管理者' ? '一般ユーザー' : 'システム管理者';
        return { ...u, role: newRole };
      }
      return u;
    }));
  };

  // ユーザー削除
  const deleteUser = (targetEmail: string) => {
    setAllUsers(prev => prev.filter(u => u.email.toLowerCase() !== targetEmail.toLowerCase()));
  };

  // テスト用：自分のロールを切り替え
  const toggleMyRoleForDemo = () => {
    if (!user) return;
    const newRole = user.role === 'システム管理者' ? '一般ユーザー' : 'システム管理者';
    const updated = { ...user, role: newRole };
    setUser(updated);
    setAllUsers(prev => prev.map(u => u.email.toLowerCase() === user.email.toLowerCase() ? updated : u));
  };

  const logout = () => {
    setUser(null);
    setPendingVerification(null);
    localStorage.removeItem(STORAGE_KEY_USER);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user && user.status === 'active' && !isAccountExpired,
        user,
        allUsers,
        pendingVerification,
        sendVerificationCode,
        verifyCodeAndLogin,
        logout,
        renewAnnualAccount,
        simulateExpireAccount,
        isAccountExpired,
        daysUntilExpiration,
        suspendUser,
        activateUser,
        toggleAdminRole,
        deleteUser,
        toggleMyRoleForDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
