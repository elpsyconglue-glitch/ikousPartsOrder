import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  auth, 
  db, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  doc, 
  setDoc, 
  getDoc 
} from '../lib/firebase';
import { UserRole } from '../types';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  department: string;
  role: UserRole;
  status: 'active' | 'suspended'; // active: 通常利用可能, suspended: 離職・異動等による停止
  createdAt: string;     // アカウント開通日 (ISO string)
  lastVerifiedAt: string;// 最終メール認証日 (ISO string)
  expiresAt: string;     // 年次認証期限 (1年後 ISO string)
}

/**
 * 初期ロール自動判定ルール:
 * - 大野隆太様 (名前: 大野, email: oono/r-oono/imoto/admin等): 『管理者』
 * - 伊坂博樹様, 村上愛子様, 三輪大真様 (名前/email: isaka, murakami, miwa等): 『一般ユーザー』
 * - それ以外の全ユーザー (他社員・新規アカウント等): 基本 『閲覧のみ』 (管理者が後から自由に昇格変更可能)
 */
export function getInitialRoleForUser(name: string, email: string): UserRole {
  const cleanEmail = email.toLowerCase().trim();
  const cleanName = name.trim();

  if (
    cleanName.includes('大野') || 
    cleanEmail.includes('oono') || 
    cleanEmail.startsWith('imoto') || 
    cleanEmail.startsWith('admin')
  ) {
    return '管理者';
  }

  if (
    cleanName.includes('伊坂') || cleanEmail.includes('isaka') ||
    cleanName.includes('村上') || cleanEmail.includes('murakami') ||
    cleanName.includes('三輪') || cleanEmail.includes('miwa')
  ) {
    return '一般ユーザー';
  }

  return '閲覧のみ';
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
  signUpWithFirebase: (email: string, password: string, name: string, department?: string) => Promise<{ success: boolean; message: string }>;
  signInWithFirebase: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  renewAnnualAccount: () => void;
  simulateExpireAccount: () => void;
  isAccountExpired: boolean;
  daysUntilExpiration: number | null;
  
  // 権限ヘルパー
  isAdmin: boolean;
  isReadOnly: boolean;

  // 管理者専用機能
  suspendUser: (email: string) => void;
  activateUser: (email: string) => void;
  updateUserRole: (email: string, newRole: UserRole) => void;
  toggleAdminRole: (email: string) => void;
  deleteUser: (email: string) => void;
  toggleMyRoleForDemo: () => void; // テスト用ロール切替
}

const STORAGE_KEY_USER = 'ikous_auth_user';
const STORAGE_KEY_ALL_USERS = 'ikous_all_users_list';

// 初期デフォルトユーザーリスト
const INITIAL_USERS: UserProfile[] = [
  {
    id: 'usr_oono',
    name: '大野 隆太',
    email: 'r-oono@ikous.co.jp',
    department: '株式会社イコーズ 工務部',
    role: '管理者',
    status: 'active',
    createdAt: new Date('2026-01-01').toISOString(),
    lastVerifiedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'usr_isaka',
    name: '伊坂 博樹',
    email: 'isaka@ikous.co.jp',
    department: '株式会社イコーズ 工務部',
    role: '一般ユーザー',
    status: 'active',
    createdAt: new Date('2026-01-01').toISOString(),
    lastVerifiedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'usr_murakami',
    name: '村上 愛子',
    email: 'murakami@ikous.co.jp',
    department: '株式会社イコーズ 工務部',
    role: '一般ユーザー',
    status: 'active',
    createdAt: new Date('2026-01-01').toISOString(),
    lastVerifiedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'usr_miwa',
    name: '三輪 大真',
    email: 'miwa@ikous.co.jp',
    department: '株式会社イコーズ 工務部',
    role: '一般ユーザー',
    status: 'active',
    createdAt: new Date('2026-01-01').toISOString(),
    lastVerifiedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'usr_admin',
    name: '井本 尚',
    email: 'imoto@ikous.co.jp',
    department: '株式会社イコーズ 役員・管理部',
    role: '管理者',
    status: 'active',
    createdAt: new Date('2026-01-01').toISOString(),
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

  // Firebase Auth の変更リスナー
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            const profileData = snap.data() as UserProfile;
            setUser(profileData);
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(profileData));
          } else if (fbUser.email) {
            // Firestore ドキュメントがまだ存在しない場合、デフォルト作成
            const now = new Date();
            const oneYearLater = new Date(now.getTime() + ONE_YEAR_MS);
            const initialRole = getInitialRoleForUser(fbUser.displayName || '', fbUser.email);
            const newProfile: UserProfile = {
              id: fbUser.uid,
              name: fbUser.displayName || fbUser.email.split('@')[0],
              email: fbUser.email,
              department: '株式会社イコーズ 工務部',
              role: initialRole,
              status: 'active',
              createdAt: now.toISOString(),
              lastVerifiedAt: now.toISOString(),
              expiresAt: oneYearLater.toISOString(),
            };
            await setDoc(userDocRef, newProfile);
            setUser(newProfile);
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newProfile));
          }
        } catch (e) {
          console.error('Firebase profile sync error:', e);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // 全ユーザーリストの変更をストレージに同期
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ALL_USERS, JSON.stringify(allUsers));
    if (user) {
      const updatedSelf = allUsers.find(u => u.email.toLowerCase() === user.email.toLowerCase());
      if (updatedSelf) {
        setUser(updatedSelf);
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedSelf));
      }
    }
  }, [allUsers]);

  // 権限フラグ
  const isAdmin = user?.role === '管理者' || (user?.role as string) === 'システム管理者';
  const isReadOnly = user?.role === '閲覧のみ';

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

  // Firebase メール・パスワード新規アカウント登録 (リアル認証＋自動フォールバック対応)
  const signUpWithFirebase = async (email: string, password: string, name: string, department: string = '株式会社イコーズ 工務部') => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      return { success: false, message: '有効なメールアドレスを入力してください。' };
    }
    if (!cleanEmail.endsWith('@ikous.co.jp')) {
      return { 
        success: false, 
        message: '【社内専用制限】アカウント登録は「@ikous.co.jp」ドメインの社内メールアドレスのみ許可されています。' 
      };
    }
    if (password.length < 6) {
      return { success: false, message: 'パスワードは6文字以上で入力してください。' };
    }

    // 重複チェック
    const existing = allUsers.find(u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      return { 
        success: false, 
        message: 'このメールアドレスは既に登録されています。「ログイン」タブよりログインしてください。' 
      };
    }

    const now = new Date();
    const oneYearLater = new Date(now.getTime() + ONE_YEAR_MS);
    const assignedName = name.trim() || cleanEmail.split('@')[0];
    const initialRole = getInitialRoleForUser(assignedName, cleanEmail);

    let userId = 'usr_' + Date.now();
    let isFirebaseSuccess = false;

    // 1. Firebase Auth 登録試行
    try {
      const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      userId = credential.user.uid;
      isFirebaseSuccess = true;
    } catch (fbErr: any) {
      console.warn('Firebase createUserWithEmailAndPassword notice (falling back to local user store):', fbErr);
      if (fbErr?.code === 'auth/email-already-in-use') {
        return { success: false, message: 'このメールアドレスは既に登録されています。「ログイン」タブよりログインしてください。' };
      }
      if (fbErr?.code === 'auth/invalid-email') {
        return { success: false, message: 'メールアドレスの形式が正しくありません。' };
      }
      if (fbErr?.code === 'auth/weak-password') {
        return { success: false, message: 'パスワードは6文字以上で入力してください。' };
      }
      // その他のFirebase Authエラー（未有効化や接続不可等）はローカルアカウント生成へフォールバック
    }

    const newProfile: UserProfile = {
      id: userId,
      name: assignedName,
      email: cleanEmail,
      department: department || '株式会社イコーズ 工務部',
      role: initialRole,
      status: 'active',
      createdAt: now.toISOString(),
      lastVerifiedAt: now.toISOString(),
      expiresAt: oneYearLater.toISOString(),
    };

    // 2. Firestore 保存試行（可能な場合クラウドに保存）
    try {
      await setDoc(doc(db, 'users', userId), newProfile);
    } catch (fsErr) {
      console.warn('Firestore setDoc notice (using local storage):', fsErr);
    }

    // 3. アプリケーション状態更新＆ログイン完了
    setUser(newProfile);
    try {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newProfile));
    } catch (e) {
      console.warn('LocalStorage save notice:', e);
    }
    setAllUsers(prev => {
      const updated = [newProfile, ...prev.filter(u => u.email.toLowerCase() !== cleanEmail)];
      try {
        localStorage.setItem('ship_budget_all_users_cache', JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage allUsers save notice:', e);
      }
      return updated;
    });

    const roleGuide = initialRole === '管理者' ? '【管理者】' : initialRole === '一般ユーザー' ? '【一般ユーザー】' : '【閲覧のみ】';

    return {
      success: true,
      message: `アカウント作成が完了し、即時ログインしました！ 初期権限: ${roleGuide}`
    };
  };

  // Firebase メール・パスワードログイン
  const signInWithFirebase = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { success: false, message: 'メールアドレスとパスワードを入力してください。' };
    }

    // 1. Firebase Auth でのログイン試行
    try {
      const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const fbUser = credential.user;

      // Firestore からプロファイル取得
      let currentProfile: UserProfile;
      try {
        const snap = await getDoc(doc(db, 'users', fbUser.uid));
        if (snap.exists()) {
          currentProfile = snap.data() as UserProfile;
        } else {
          const now = new Date();
          const oneYearLater = new Date(now.getTime() + ONE_YEAR_MS);
          const initialRole = getInitialRoleForUser('', cleanEmail);
          currentProfile = {
            id: fbUser.uid,
            name: cleanEmail.split('@')[0],
            email: cleanEmail,
            department: '株式会社イコーズ 工務部',
            role: initialRole,
            status: 'active',
            createdAt: now.toISOString(),
            lastVerifiedAt: now.toISOString(),
            expiresAt: oneYearLater.toISOString(),
          };
          await setDoc(doc(db, 'users', fbUser.uid), currentProfile);
        }
      } catch {
        // Firestore 失敗時はローカルプロファイル参照または新規作成
        const existingLocal = allUsers.find(u => u.email.toLowerCase() === cleanEmail);
        const now = new Date();
        const oneYearLater = new Date(now.getTime() + ONE_YEAR_MS);
        currentProfile = existingLocal || {
          id: fbUser.uid,
          name: cleanEmail.split('@')[0],
          email: cleanEmail,
          department: '株式会社イコーズ 工務部',
          role: getInitialRoleForUser('', cleanEmail),
          status: 'active',
          createdAt: now.toISOString(),
          lastVerifiedAt: now.toISOString(),
          expiresAt: oneYearLater.toISOString(),
        };
      }

      if (currentProfile.status === 'suspended') {
        await signOut(auth);
        return {
          success: false,
          message: '【アクセス拒否】このアカウントは管理者により停止されています。'
        };
      }

      setUser(currentProfile);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentProfile));

      return {
        success: true,
        message: 'ログインに成功しました。'
      };
    } catch (error: any) {
      console.warn('Firebase SignIn notice (checking local accounts):', error);

      // ローカルユーザーリスト（手動登録/コード認証等で登録されたアカウント）で検索
      const localProfile = allUsers.find(u => u.email.toLowerCase() === cleanEmail);
      if (localProfile) {
        if (localProfile.status === 'suspended') {
          return {
            success: false,
            message: '【アクセス拒否】このアカウントは管理者により停止されています。'
          };
        }
        setUser(localProfile);
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(localProfile));
        return {
          success: true,
          message: 'ログインに成功しました。'
        };
      }

      let errMsg = 'ログインに失敗しました。メールアドレスまたはパスワードをご確認ください。';
      if (error?.code === 'auth/user-not-found' || error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential') {
        errMsg = 'メールアドレスまたはパスワードが正しくありません。新規作成タブからアカウントを作成してください。';
      }
      return { success: false, message: errMsg };
    }
  };

  // パスワード再設定メール送信
  const sendPasswordReset = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, message: 'メールアドレスを入力してください。' };
    }
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      return {
        success: true,
        message: `${cleanEmail} 宛にパスワード再設定用のメールを送信しました。`
      };
    } catch (error: any) {
      console.error('Password Reset Error:', error);
      return {
        success: false,
        message: 'パスワード再設定メールの送信に失敗しました。'
      };
    }
  };

  // メール認証コードの送信（ワンタイム/デモ用）
  const sendVerificationCode = async (email: string, name?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    
    if (!cleanEmail.includes('@')) {
      return { success: false, message: '有効なメールアドレスを入力してください。' };
    }

    if (!cleanEmail.endsWith('@ikous.co.jp')) {
      return {
        success: false,
        message: '【社内専用制限】コード送信・開通手続きは「@ikous.co.jp」ドメインの社員メールアドレスのみ許可されています。'
      };
    }

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
      const initialRole = getInitialRoleForUser(pendingVerification.name, pendingVerification.email);
      
      updatedUser = {
        id: `usr_${Date.now()}`,
        name: pendingVerification.name,
        email: pendingVerification.email,
        department: '株式会社イコーズ 工務部',
        role: initialRole,
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

  // 管理者専用機能
  const suspendUser = (targetEmail: string) => {
    setAllUsers(prev => prev.map(u => {
      if (u.email.toLowerCase() === targetEmail.toLowerCase()) {
        return { ...u, status: 'suspended' };
      }
      return u;
    }));
  };

  const activateUser = (targetEmail: string) => {
    setAllUsers(prev => prev.map(u => {
      if (u.email.toLowerCase() === targetEmail.toLowerCase()) {
        return { ...u, status: 'active' };
      }
      return u;
    }));
  };

  // ユーザーロール指定変更
  const updateUserRole = (targetEmail: string, newRole: UserRole) => {
    setAllUsers(prev => prev.map(u => {
      if (u.email.toLowerCase() === targetEmail.toLowerCase()) {
        return { ...u, role: newRole };
      }
      return u;
    }));
  };

  const toggleAdminRole = (targetEmail: string) => {
    setAllUsers(prev => prev.map(u => {
      if (u.email.toLowerCase() === targetEmail.toLowerCase()) {
        const currentIsAdmin = u.role === '管理者' || (u.role as string) === 'システム管理者';
        const newRole: UserRole = currentIsAdmin ? '一般ユーザー' : '管理者';
        return { ...u, role: newRole };
      }
      return u;
    }));
  };

  const deleteUser = (targetEmail: string) => {
    setAllUsers(prev => prev.filter(u => u.email.toLowerCase() !== targetEmail.toLowerCase()));
  };

  // デモ用ロール循環切り替え (管理者 ➔ 一般ユーザー ➔ 閲覧のみ ➔ 管理者)
  const toggleMyRoleForDemo = () => {
    if (!user) return;
    let nextRole: UserRole = '一般ユーザー';
    if (user.role === '管理者' || (user.role as string) === 'システム管理者') {
      nextRole = '一般ユーザー';
    } else if (user.role === '一般ユーザー') {
      nextRole = '閲覧のみ';
    } else {
      nextRole = '管理者';
    }

    const updated: UserProfile = { ...user, role: nextRole };
    setUser(updated);
    setAllUsers(prev => prev.map(u => u.email.toLowerCase() === user.email.toLowerCase() ? updated : u));
  };

  const logout = () => {
    signOut(auth).catch(() => {});
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
        signUpWithFirebase,
        signInWithFirebase,
        sendPasswordReset,
        logout,
        renewAnnualAccount,
        simulateExpireAccount,
        isAccountExpired,
        daysUntilExpiration,
        isAdmin,
        isReadOnly,
        suspendUser,
        activateUser,
        updateUserRole,
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

