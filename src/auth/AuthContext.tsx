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
  getDoc,
  getDocs,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  handleFirestoreError,
  OperationType
} from '../lib/firebase';
import { UserRole, GuestAccessLog } from '../types';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  department: string;
  role: UserRole;
  status: 'active' | 'suspended'; // active: 通常利用可能, suspended: 離職・異動等による停止
  createdAt: string;     // アカウント開通日 (ISO string)
  lastVerifiedAt: string;// 最終メール認証日 (ISO string)
  lastActiveAt?: string; // 最終アクティブ・ログイン日時 (ISO string)
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
  guestAccessLogs: GuestAccessLog[];
  pendingVerification: PendingVerification | null;
  sendVerificationCode: (email: string, name?: string) => Promise<{ success: boolean; message: string; demoCode?: string }>;
  verifyCodeAndLogin: (code: string) => { success: boolean; message: string };
  signUpWithFirebase: (email: string, password: string, name: string, department?: string) => Promise<{ success: boolean; message: string }>;
  signInWithFirebase: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  loginAsGuest: (guestName?: string) => Promise<{ success: boolean; message: string }>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  renewAnnualAccount: () => void;
  refreshUsersAndLogs: () => Promise<void>;
  isAccountExpired: boolean;
  daysUntilExpiration: number | null;
  
  // 権限ヘルパー
  isAdmin: boolean;
  isReadOnly: boolean;
  isGuest: boolean;
  canPrint: boolean;
  canEdit: boolean;

  // 管理者専用機能
  suspendUser: (email: string) => void;
  activateUser: (email: string) => void;
  updateUserRole: (email: string, newRole: UserRole) => void;
  toggleAdminRole: (email: string) => void;
  deleteUser: (email: string) => void;
  clearGuestLogs: () => void;
}

const STORAGE_KEY_USER = 'ikous_auth_user';
const STORAGE_KEY_ALL_USERS = 'ikous_all_users_list';
const STORAGE_KEY_GUEST_LOGS = 'ikous_guest_access_logs';

// 初期デフォルトユーザーリスト（未ログインアカウントは削除し、初回ログイン時に自動生成・同期）
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

  // 現在ログイン中のユーザー (サイトを開くたびにセッション確認)
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const isSessionActive = sessionStorage.getItem('ikous_session_active');
      const loginTimeStr = sessionStorage.getItem('ikous_session_time');
      if (!isSessionActive || !loginTimeStr) {
        return null; // サイトを開き直したときはログイン画面を表示
      }
      const loginTime = parseInt(loginTimeStr, 10);
      const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
      if (isNaN(loginTime) || Date.now() - loginTime > TWELVE_HOURS_MS) {
        sessionStorage.removeItem('ikous_session_active');
        sessionStorage.removeItem('ikous_session_time');
        return null; // 12時間経過していたらログアウト
      }

      const saved = localStorage.getItem(STORAGE_KEY_USER);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // ゲストアクセスログの保持
  const [guestAccessLogs, setGuestAccessLogs] = useState<GuestAccessLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_GUEST_LOGS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // ゲストアクセスログの localStorage 同期
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_GUEST_LOGS, JSON.stringify(guestAccessLogs));
    } catch (e) {
      console.warn('Guest access log save notice:', e);
    }
  }, [guestAccessLogs]);

  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);

  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
  const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

  // セッション有効化 (ログイン時にコール)
  const setSessionActive = () => {
    sessionStorage.setItem('ikous_session_active', 'true');
    sessionStorage.setItem('ikous_session_time', Date.now().toString());
  };

  // セッション有効性チェック (サイト表示時・12時間経過チェック)
  const checkSessionActive = (): boolean => {
    const isActive = sessionStorage.getItem('ikous_session_active');
    const loginTimeStr = sessionStorage.getItem('ikous_session_time');
    if (!isActive || !loginTimeStr) return false;
    const loginTime = parseInt(loginTimeStr, 10);
    if (isNaN(loginTime) || Date.now() - loginTime > TWELVE_HOURS_MS) {
      sessionStorage.removeItem('ikous_session_active');
      sessionStorage.removeItem('ikous_session_time');
      return false;
    }
    return true;
  };

  // 12時間のセッション自動判定タイマー (30秒ごとに確認)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (!checkSessionActive()) {
        alert('【ログイン有効期限切れ】\nログインから12時間が経過したため、自動ログアウトしました。\n恐れ入りますが、再度ログインをお願いいたします。');
        logout();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // 手動 / イベント駆動で最新ユーザー＆ゲストログを再取得・同期する関数
  const refreshUsersAndLogs = async () => {
    try {
      // Users 取得
      const usersSnap = await getDocs(collection(db, 'users'));
      if (!usersSnap.empty) {
        const list: UserProfile[] = [];
        usersSnap.forEach(d => {
          const u = d.data() as UserProfile;
          if (u && u.email) list.push(u);
        });
        setAllUsers(prev => {
          const map = new Map<string, UserProfile>();
          INITIAL_USERS.forEach(u => map.set(u.email.toLowerCase(), u));
          prev.forEach(u => map.set(u.email.toLowerCase(), u));
          list.forEach(u => map.set(u.email.toLowerCase(), u));
          const updated = Array.from(map.values());
          try {
            localStorage.setItem('ship_budget_all_users_cache', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
      }

      // Guest Logs 取得
      const logsSnap = await getDocs(collection(db, 'guest_access_logs'));
      if (!logsSnap.empty) {
        const logs: GuestAccessLog[] = [];
        logsSnap.forEach(d => {
          const l = d.data() as GuestAccessLog;
          if (l && l.guestName) logs.push(l);
        });
        logs.sort((a, b) => new Date(b.loginAt).getTime() - new Date(a.loginAt).getTime());
        setGuestAccessLogs(logs);
      }
    } catch (e) {
      console.warn('refreshUsersAndLogs notice:', e);
    }
  };

  // アプリケーション起動時に一度クラウドから最新ユーザー＆ゲストログを取得
  useEffect(() => {
    refreshUsersAndLogs();
  }, []);

  // Firebase Auth の変更リスナー
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      // セッションが無効（サイトを開き直した / 12時間経過）の場合は自動復元しない
      if (!checkSessionActive()) {
        return;
      }

      if (fbUser && fbUser.email) {
        try {
          const cleanEmail = fbUser.email.toLowerCase();
          const userDocRef = doc(db, 'users', cleanEmail);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            const profileData = snap.data() as UserProfile;
            setUser(profileData);
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(profileData));
          } else {
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
              lastActiveAt: now.toISOString(),
              expiresAt: oneYearLater.toISOString(),
            };
            await setDoc(userDocRef, newProfile, { merge: true });
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

  // ログイン中のユーザーのオンラインハートビート更新 (ログイン時・ハートビート)
  useEffect(() => {
    if (!user || !user.email) return;
    const cleanEmail = user.email.toLowerCase();
    
    const sendHeartbeat = async () => {
      const nowIso = new Date().toISOString();
      try {
        const userDocRef = doc(db, 'users', cleanEmail);
        await setDoc(userDocRef, { 
          lastActiveAt: nowIso 
        }, { merge: true });
      } catch (e) {
        console.warn('Heartbeat update notice:', e);
      }
    };

    sendHeartbeat();
  }, [user?.email]);

  // 全ユーザーリストの変更をストレージに同期
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ALL_USERS, JSON.stringify(allUsers));
    } catch (e) {
      console.warn('Failed to sync allUsers to localStorage:', e);
    }

    if (user) {
      const updatedSelf = allUsers.find(u => u.email.toLowerCase() === user.email.toLowerCase());
      if (updatedSelf && (user.role !== updatedSelf.role || user.status !== updatedSelf.status)) {
        if (updatedSelf.status === 'suspended') {
          alert(`【アクセス権限停止の通知】\n管理者の操作により、${user.name} 様のアカウントアクセス権限が停止されました。`);
          logout();
        } else {
          setUser(updatedSelf);
          try {
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedSelf));
          } catch (e) {
            console.warn('Failed to sync updated self user to localStorage:', e);
          }
        }
      }
    }
  }, [allUsers]);

  // 権限フラグ
  const isAdmin = user?.role === '管理者' || (user?.role as string) === 'システム管理者';
  const isGuest = user?.role === 'ゲスト';
  const isReadOnly = user?.role === '閲覧のみ' || user?.role === 'ゲスト';
  const canPrint = user?.role !== 'ゲスト'; // ゲストは印刷・PDF出力不可（閲覧のみは可）
  const canEdit = user?.role === '管理者' || user?.role === '一般ユーザー';

  // 簡易ゲストログイン（誰でも1クリックでアクセス可能。ログイン日時・識別ID等のアクセスログを記録）
  const loginAsGuest = async (customGuestName?: string) => {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    const timeHash = String(now.getTime()).slice(-4);
    const guestEmail = `guest-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${timeHash}@guest.ikous.co.jp`;
    const displayName = customGuestName?.trim() ? `ゲスト (${customGuestName.trim()})` : `ゲストユーザー (${timeHash})`;
    const guestId = `guest_${now.getTime()}`;

    const newLog: GuestAccessLog = {
      id: `log_${now.getTime()}`,
      guestId,
      guestName: displayName,
      email: guestEmail,
      loginAt: now.toISOString(),
      formattedLoginAt: formattedDate,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    };

    // アクセスログ記録
    setGuestAccessLogs(prev => [newLog, ...prev]);

    try {
      await addDoc(collection(db, 'guest_access_logs'), newLog);
    } catch (e) {
      console.warn('Firestore guest log notice (saving in localStorage):', e);
    }

    // ゲストユーザー情報生成
    const guestProfile: UserProfile = {
      id: guestId,
      name: displayName,
      email: guestEmail,
      department: '外部・臨時閲覧ゲスト',
      role: 'ゲスト',
      status: 'active',
      createdAt: now.toISOString(),
      lastVerifiedAt: now.toISOString(),
      lastActiveAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    };

    // Firestore にユーザー情報及びログを同期保存
    try {
      await setDoc(doc(db, 'users', guestEmail.toLowerCase()), guestProfile, { merge: true });
    } catch (e) {
      console.warn('Firestore guest profile notice:', e);
    }

    setUser(guestProfile);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(guestProfile));
    setSessionActive();

    return {
      success: true,
      message: `ゲストとしてログインしました。（日時: ${formattedDate}）`
    };
  };

  const clearGuestLogs = () => {
    setGuestAccessLogs([]);
    localStorage.removeItem(STORAGE_KEY_GUEST_LOGS);
  };

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

    // 1. Firebase Auth 登録試行
    try {
      const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      userId = credential.user.uid;
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
      lastActiveAt: now.toISOString(),
      expiresAt: oneYearLater.toISOString(),
    };

    // 2. Firestore 保存試行（cleanEmail キーで書き込み）
    try {
      await setDoc(doc(db, 'users', cleanEmail), newProfile, { merge: true });
    } catch (fsErr) {
      console.warn('Firestore setDoc notice:', fsErr);
    }

    // 3. アプリケーション状態更新＆ログイン完了
    setUser(newProfile);
    setSessionActive();
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

    const nowIso = new Date().toISOString();

    // 1. Firebase Auth でのログイン試行
    try {
      const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const fbUser = credential.user;

      // Firestore からプロファイル取得 (cleanEmail キーで統一)
      let currentProfile: UserProfile;
      try {
        const snap = await getDoc(doc(db, 'users', cleanEmail));
        if (snap.exists()) {
          currentProfile = { ...(snap.data() as UserProfile), lastActiveAt: nowIso };
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
            lastActiveAt: nowIso,
            expiresAt: oneYearLater.toISOString(),
          };
        }
        await setDoc(doc(db, 'users', cleanEmail), currentProfile, { merge: true });
      } catch {
        // Firestore 失敗時
        const existingLocal = allUsers.find(u => u.email.toLowerCase() === cleanEmail);
        const now = new Date();
        const oneYearLater = new Date(now.getTime() + ONE_YEAR_MS);
        currentProfile = existingLocal ? { ...existingLocal, lastActiveAt: nowIso } : {
          id: fbUser.uid,
          name: cleanEmail.split('@')[0],
          email: cleanEmail,
          department: '株式会社イコーズ 工務部',
          role: getInitialRoleForUser('', cleanEmail),
          status: 'active',
          createdAt: now.toISOString(),
          lastVerifiedAt: now.toISOString(),
          lastActiveAt: nowIso,
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
      setSessionActive();

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
        const updatedLocal = { ...localProfile, lastActiveAt: nowIso };
        setUser(updatedLocal);
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedLocal));
        setSessionActive();

        try {
          await setDoc(doc(db, 'users', cleanEmail), updatedLocal, { merge: true });
        } catch (e) {}

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
        lastActiveAt: now.toISOString(),
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
        lastActiveAt: now.toISOString(),
        expiresAt: oneYearLater.toISOString(),
      };
      setAllUsers(prev => [updatedUser, ...prev]);
    }

    // Firestore に保存して他端末でも参照可能にする
    try {
      setDoc(doc(db, 'users', pendingVerification.email.toLowerCase()), updatedUser, { merge: true });
    } catch (e) {
      console.warn('Firestore setDoc verifyCode notice:', e);
    }

    setUser(updatedUser);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
    setSessionActive();
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

  // 管理者専用機能（Firestore に即時書き込み同期）
  const suspendUser = async (targetEmail: string) => {
    const clean = targetEmail.toLowerCase();
    const targetUser = allUsers.find(u => u.email.toLowerCase() === clean);
    setAllUsers(prev => prev.map(u => {
      if (u.email.toLowerCase() === clean) {
        return { ...u, status: 'suspended' };
      }
      return u;
    }));

    if (targetUser) {
      try {
        const userDocRef = doc(db, 'users', clean);
        await setDoc(userDocRef, { ...targetUser, status: 'suspended' }, { merge: true });
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, `users/${targetEmail}`);
      }
    }
  };

  const activateUser = async (targetEmail: string) => {
    const clean = targetEmail.toLowerCase();
    const targetUser = allUsers.find(u => u.email.toLowerCase() === clean);
    setAllUsers(prev => prev.map(u => {
      if (u.email.toLowerCase() === clean) {
        return { ...u, status: 'active' };
      }
      return u;
    }));

    if (targetUser) {
      try {
        const userDocRef = doc(db, 'users', clean);
        await setDoc(userDocRef, { ...targetUser, status: 'active' }, { merge: true });
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, `users/${targetEmail}`);
      }
    }
  };

  // ユーザーロール指定変更
  const updateUserRole = async (targetEmail: string, newRole: UserRole) => {
    const clean = targetEmail.toLowerCase();
    const targetUser = allUsers.find(u => u.email.toLowerCase() === clean);
    setAllUsers(prev => prev.map(u => {
      if (u.email.toLowerCase() === clean) {
        return { ...u, role: newRole };
      }
      return u;
    }));

    if (targetUser) {
      try {
        const userDocRef = doc(db, 'users', clean);
        await setDoc(userDocRef, { ...targetUser, role: newRole }, { merge: true });
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, `users/${targetEmail}`);
      }
    }

    if (user && user.email.toLowerCase() === clean) {
      const updatedUser = { ...user, role: newRole };
      setUser(updatedUser);
      try {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
      } catch (e) {
        console.warn('Failed to save user role:', e);
      }
    }
  };

  const toggleAdminRole = (targetEmail: string) => {
    const target = allUsers.find(u => u.email.toLowerCase() === targetEmail.toLowerCase());
    if (target) {
      const currentIsAdmin = target.role === '管理者' || (target.role as string) === 'システム管理者';
      const newRole: UserRole = currentIsAdmin ? '一般ユーザー' : '管理者';
      updateUserRole(targetEmail, newRole);
    }
  };

  const deleteUser = async (targetEmail: string) => {
    const clean = targetEmail.toLowerCase();
    const targetUser = allUsers.find(u => u.email.toLowerCase() === clean);
    setAllUsers(prev => prev.filter(u => u.email.toLowerCase() !== clean));

    if (targetUser) {
      try {
        const userDocRef = doc(db, 'users', clean);
        await deleteDoc(userDocRef);
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `users/${targetEmail}`);
      }
    }
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
    sessionStorage.removeItem('ikous_session_active');
    sessionStorage.removeItem('ikous_session_time');
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user && user.status === 'active' && !isAccountExpired,
        user,
        allUsers,
        guestAccessLogs,
        pendingVerification,
        sendVerificationCode,
        verifyCodeAndLogin,
        signUpWithFirebase,
        signInWithFirebase,
        loginAsGuest,
        sendPasswordReset,
        logout,
        renewAnnualAccount,
        refreshUsersAndLogs,
        isAccountExpired,
        daysUntilExpiration,
        isAdmin,
        isReadOnly,
        isGuest,
        canPrint,
        canEdit,
        suspendUser,
        activateUser,
        updateUserRole,
        toggleAdminRole,
        deleteUser,
        clearGuestLogs,
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

