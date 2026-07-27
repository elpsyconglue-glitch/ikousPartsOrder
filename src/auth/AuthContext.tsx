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
  signUpWithFirebase: (email: string, password: string, name: string, department?: string) => Promise<{ success: boolean; message: string }>;
  signInWithFirebase: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
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
            const isAdminByEmail = fbUser.email.startsWith('imoto') || fbUser.email.startsWith('admin');
            const newProfile: UserProfile = {
              id: fbUser.uid,
              name: fbUser.displayName || fbUser.email.split('@')[0],
              email: fbUser.email,
              department: '株式会社イコーズ 工務部',
              role: isAdminByEmail ? 'システム管理者' : '一般ユーザー',
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

  // Firebase メール・パスワード新規アカウント登録 (リアルメール認証対応)
  const signUpWithFirebase = async (email: string, password: string, name: string, department: string = '株式会社イコーズ 工務部') => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      return { success: false, message: '有効なメールアドレスを入力してください。' };
    }
    if (password.length < 6) {
      return { success: false, message: 'パスワードは6文字以上で入力してください。' };
    }

    try {
      const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const fbUser = credential.user;
      const now = new Date();
      const oneYearLater = new Date(now.getTime() + ONE_YEAR_MS);
      const isAdminByEmail = cleanEmail.startsWith('imoto') || cleanEmail.startsWith('admin');

      const newProfile: UserProfile = {
        id: fbUser.uid,
        name: name || cleanEmail.split('@')[0],
        email: cleanEmail,
        department: department || '株式会社イコーズ 工務部',
        role: isAdminByEmail ? 'システム管理者' : '一般ユーザー',
        status: 'active',
        createdAt: now.toISOString(),
        lastVerifiedAt: now.toISOString(),
        expiresAt: oneYearLater.toISOString(),
      };

      // Firestore にユーザー情報を保存
      await setDoc(doc(db, 'users', fbUser.uid), newProfile);

      setUser(newProfile);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newProfile));
      setAllUsers(prev => [newProfile, ...prev.filter(u => u.email.toLowerCase() !== cleanEmail)]);

      return {
        success: true,
        message: 'アカウント作成が完了し、ログインしました。1年間有効です。'
      };
    } catch (error: any) {
      console.error('SignUp Error:', error);
      let errMsg = 'アカウント作成に失敗しました。';
      if (error?.code === 'auth/email-already-in-use') {
        errMsg = 'このメールアドレスは既に登録されています。ログインをお試しください。';
      } else if (error?.code === 'auth/invalid-email') {
        errMsg = 'メールアドレスの形式が正しくありません。';
      } else if (error?.code === 'auth/weak-password') {
        errMsg = 'パスワードが弱すぎます。6文字以上を指定してください。';
      }
      return { success: false, message: errMsg };
    }
  };

  // Firebase メール・パスワードログイン
  const signInWithFirebase = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { success: false, message: 'メールアドレスとパスワードを入力してください。' };
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const fbUser = credential.user;

      // Firestore からプロファイル取得
      const snap = await getDoc(doc(db, 'users', fbUser.uid));
      let currentProfile: UserProfile;

      if (snap.exists()) {
        currentProfile = snap.data() as UserProfile;
      } else {
        const now = new Date();
        const oneYearLater = new Date(now.getTime() + ONE_YEAR_MS);
        const isAdminByEmail = cleanEmail.startsWith('imoto') || cleanEmail.startsWith('admin');
        currentProfile = {
          id: fbUser.uid,
          name: cleanEmail.split('@')[0],
          email: cleanEmail,
          department: '株式会社イコーズ 工務部',
          role: isAdminByEmail ? 'システム管理者' : '一般ユーザー',
          status: 'active',
          createdAt: now.toISOString(),
          lastVerifiedAt: now.toISOString(),
          expiresAt: oneYearLater.toISOString(),
        };
        await setDoc(doc(db, 'users', fbUser.uid), currentProfile);
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
      console.error('SignIn Error:', error);
      let errMsg = 'ログインに失敗しました。';
      if (error?.code === 'auth/user-not-found' || error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential') {
        errMsg = 'メールアドレスまたはパスワードが正しくありません。';
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

  const toggleAdminRole = (targetEmail: string) => {
    setAllUsers(prev => prev.map(u => {
      if (u.email.toLowerCase() === targetEmail.toLowerCase()) {
        const newRole = u.role === 'システム管理者' ? '一般ユーザー' : 'システム管理者';
        return { ...u, role: newRole };
      }
      return u;
    }));
  };

  const deleteUser = (targetEmail: string) => {
    setAllUsers(prev => prev.filter(u => u.email.toLowerCase() !== targetEmail.toLowerCase()));
  };

  const toggleMyRoleForDemo = () => {
    if (!user) return;
    const newRole = user.role === 'システム管理者' ? '一般ユーザー' : 'システム管理者';
    const updated = { ...user, role: newRole };
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

