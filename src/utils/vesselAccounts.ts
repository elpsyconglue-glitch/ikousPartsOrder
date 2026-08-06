export interface VesselAccountInfo {
  email: string;
  shipName: string;
}

export const VESSEL_ACCOUNTS: VesselAccountInfo[] = [
  { email: 'ikuta@imotoline.co.jp', shipName: 'いくた' },
  { email: 'elleair2@ikous.co.jp', shipName: 'エリエール2' },
  { email: 'o-kazumaru@ikous.co.jp', shipName: '大島一丸' },
  { email: 'o-yurimaru@ikous.co.jp', shipName: '大島百合丸' },
  { email: 'genbu@ikous.co.jp', shipName: 'げんぶ' },
  { email: 'kohaku@ikous.co.jp', shipName: 'こはく' },
  { email: 'sagami@imotoline.co.jp', shipName: 'さがみ' },
  { email: 'suzaku@ikous.co.jp', shipName: 'すざく' },
  { email: 'no12kouyou@gmail.com', shipName: '第十二興洋丸' },
  { email: 'tenma@ikous.co.jp', shipName: 'てんま' },
  { email: 'hyogo@imotoline.co.jp', shipName: 'ひょうご' },
  { email: 'hiyodori@ikous.co.jp', shipName: 'ひよどり' },
  { email: 'maiko@imotoline.co.jp', shipName: 'まいこ' },
  { email: 'shoeimaru@ikous.co.jp', shipName: '松栄丸' },
  { email: 'rikishi8@ikous.co.jp', shipName: '第八力司丸' },
  { email: 'nanshin@ikous.co.jp', shipName: '南新丸' },
];

/**
 * メールアドレスから船名を取得する（見つからない場合は null）
 */
export function getShipNameByEmail(email: string): string | null {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();
  const match = VESSEL_ACCOUNTS.find(v => v.email.toLowerCase() === cleanEmail);
  return match ? match.shipName : null;
}

/**
 * 船名からメールアドレスを取得する
 */
export function getEmailByShipName(shipName: string): string | null {
  if (!shipName) return null;
  const match = VESSEL_ACCOUNTS.find(v => v.shipName === shipName);
  return match ? match.email : null;
}
