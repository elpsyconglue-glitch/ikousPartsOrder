import React, { useMemo, useState } from 'react';
import { PartHistory, OrderCategory } from '../types';
import { getFiscalYear } from '../utils/csvHelper';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { BarChart3, PieChart as PieIcon, TrendingUp, Calendar, ShieldCheck, Award, Layers, ChevronUp, ChevronDown } from 'lucide-react';

interface BudgetAnalyticsGraphProps {
  histories: PartHistory[];
  selectedShip: string;
  selectedCategory: OrderCategory;
  selectedYear: string;
  selectedMonth: string;
}

const COLORS = ['#4f46e5', '#0284c7', '#0d9488', '#16a34a', '#ca8a04', '#ea580c', '#e11d48', '#9333ea', '#64748b'];

export default function BudgetAnalyticsGraph({
  histories,
  selectedShip,
  selectedCategory,
  selectedYear,
  selectedMonth
}: BudgetAnalyticsGraphProps) {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [graphType, setGraphType] = useState<'bar' | 'pie'>('bar');

  // 選択中の船・カテゴリ・年度に一致する履歴データ（月で絞り込む前）
  const baseHistories = useMemo(() => {
    return histories.filter(h => {
      if (!h.orderDate || h.orderDate.trim() === '') return false;
      
      const shipMatch = h.shipName === selectedShip || (selectedShip === '未指定' && (!h.shipName || h.shipName === '未指定'));
      if (!shipMatch) return false;

      const itemCat = h.category || '部品';
      if (itemCat !== selectedCategory) return false;

      if (selectedYear !== 'ALL') {
        const itemFY = getFiscalYear(h.orderDate);
        if (itemFY !== Number(selectedYear)) return false;
      }

      return true;
    });
  }, [histories, selectedShip, selectedCategory, selectedYear]);

  // 月別の購入額集計（4月〜翌3月の年度サイクル）
  const monthlyData = useMemo(() => {
    // 年度（4月〜翌3月）の順番
    const fiscalMonths = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
    const map: { [m: number]: { amount: number; count: number } } = {};
    fiscalMonths.forEach(m => { map[m] = { amount: 0, count: 0 }; });

    baseHistories.forEach(h => {
      const dateStr = h.orderDate.replace(/\//g, '-');
      const d = new Date(dateStr);
      let m: number | null = null;
      if (!isNaN(d.getTime())) {
        m = d.getMonth() + 1;
      } else {
        const parts = dateStr.split('-');
        if (parts.length >= 2) m = parseInt(parts[1], 10);
      }

      if (m && map[m] !== undefined) {
        const qty = h.quantity || 1;
        const price = h.unitPrice || 0;
        map[m].amount += qty * price;
        map[m].count += 1;
      }
    });

    return fiscalMonths.map(m => {
      const label = m >= 4 ? `${m}月` : `翌${m}月`;
      return {
        month: m,
        name: label,
        金額: map[m].amount,
        件数: map[m].count
      };
    });
  }, [baseHistories]);

  // 1番購入金額が多い月を特定
  const maxMonthInfo = useMemo(() => {
    let max = { name: '-', amount: 0, month: 0 };
    monthlyData.forEach(d => {
      if (d.金額 > max.amount) {
        max = { name: d.name, amount: d.金額, month: d.month };
      }
    });
    return max;
  }, [monthlyData]);

  // 全月（年度内）の合計金額
  const totalYearlyAmount = useMemo(() => {
    return monthlyData.reduce((sum, d) => sum + d.金額, 0);
  }, [monthlyData]);

  // 特定月が選択されている場合の該当月データ
  const selectedMonthHistories = useMemo(() => {
    if (selectedMonth === 'ALL') return baseHistories;
    const targetM = Number(selectedMonth);
    return baseHistories.filter(h => {
      const dateStr = h.orderDate.replace(/\//g, '-');
      const d = new Date(dateStr);
      let m: number | null = null;
      if (!isNaN(d.getTime())) {
        m = d.getMonth() + 1;
      } else {
        const parts = dateStr.split('-');
        if (parts.length >= 2) m = parseInt(parts[1], 10);
      }
      return m === targetM;
    });
  }, [baseHistories, selectedMonth]);

  // 機器ごとの購入額集計（特定月または年度全体の構成比）
  const equipmentData = useMemo(() => {
    const targetHistories = selectedMonth === 'ALL' ? baseHistories : selectedMonthHistories;
    const map: { [eq: string]: number } = {};

    targetHistories.forEach(h => {
      const eq = (h.equipmentName && h.equipmentName.trim()) ? h.equipmentName.trim() : '全般・その他';
      const qty = h.quantity || 1;
      const price = h.unitPrice || 0;
      map[eq] = (map[eq] || 0) + (qty * price);
    });

    return Object.keys(map)
      .map(eq => ({ name: eq, 金額: map[eq] }))
      .sort((a, b) => b.金額 - a.金額);
  }, [baseHistories, selectedMonthHistories, selectedMonth]);

  // 特定月における購入額TOP5品目
  const topItemsInMonth = useMemo(() => {
    if (selectedMonth === 'ALL') return [];
    return [...selectedMonthHistories]
      .map(h => {
        const qty = h.quantity || 1;
        const price = h.unitPrice || 0;
        return {
          id: h.id,
          name: h.partName,
          equipment: h.equipmentName || '全般',
          total: qty * price,
          qty,
          price
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [selectedMonthHistories, selectedMonth]);

  // 選択月の合計額
  const selectedMonthTotalAmount = useMemo(() => {
    return selectedMonthHistories.reduce((sum, h) => sum + ((h.quantity || 1) * (h.unitPrice || 0)), 0);
  }, [selectedMonthHistories]);

  if (baseHistories.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6 transition-all">
      {/* グラフヘッダー・アコーディオン */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              【{selectedShip}】 発注金額・購入傾向グラフ分析
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 font-normal">
                {selectedYear === 'ALL' ? '全期間' : `${selectedYear}年度`} {selectedMonth !== 'ALL' ? `(${selectedMonth}月)` : '(全月)'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-300">
              {selectedMonth === 'ALL' 
                ? '年度内の月別購入額の推移および最も購入額が多い月を可視化しています'
                : `${selectedMonth}月に購入した機器別割合および上位発注品目を集計表示しています`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-lg border border-slate-700 text-xs">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setGraphType('bar'); }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${graphType === 'bar' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
            >
              棒グラフ
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setGraphType('pie'); }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${graphType === 'pie' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
            >
              機器別割合
            </button>
          </div>

          <button className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
            {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* グラフコンテンツ本文 */}
      {isOpen && (
        <div className="p-5 space-y-5 bg-slate-50/50">
          {/* ① サマリー指標カード */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
              <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-500">
                  {selectedMonth === 'ALL' ? '期間合計購入金額' : `${selectedMonth}月 合計購入金額`}
                </div>
                <div className="text-lg font-black text-slate-900 font-mono">
                  ¥{(selectedMonth === 'ALL' ? totalYearlyAmount : selectedMonthTotalAmount).toLocaleString()}
                </div>
              </div>
            </div>

            {selectedMonth === 'ALL' ? (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 p-4 rounded-xl border border-amber-200 shadow-2xs flex items-center gap-3">
                <div className="p-3 bg-amber-500 text-white rounded-xl shadow-xs">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
                    <span>🏆 最多購入月 (ピーク)</span>
                  </div>
                  <div className="text-lg font-black text-amber-950 font-mono">
                    {maxMonthInfo.amount > 0 ? `${maxMonthInfo.name} (¥${maxMonthInfo.amount.toLocaleString()})` : 'データなし'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
                <div className="p-3 bg-sky-50 rounded-xl text-sky-600">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-500">
                    {selectedMonth}月の発注件数
                  </div>
                  <div className="text-lg font-black text-slate-900 font-mono">
                    {selectedMonthHistories.length} 件
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-500">
                  {selectedMonth === 'ALL' ? '発注件数合計' : `${selectedMonth}月 最高額品目`}
                </div>
                {selectedMonth === 'ALL' ? (
                  <div className="text-lg font-black text-slate-900 font-mono">
                    {baseHistories.length} 件
                  </div>
                ) : (
                  <div className="text-xs font-bold text-slate-900 truncate max-w-[180px]" title={topItemsInMonth[0]?.name}>
                    {topItemsInMonth[0] ? `${topItemsInMonth[0].name} (¥${topItemsInMonth[0].total.toLocaleString()})` : 'なし'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ② メイングラフ表示エリア */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4 text-indigo-600" />
                {selectedMonth === 'ALL' 
                  ? (graphType === 'bar' ? '【全月】 月別発注金額の推移 (4月〜翌3月)' : '【全月】 機器別購入額の構成割合')
                  : (graphType === 'bar' ? `【${selectedMonth}月】 機器別購入金額の内訳` : `【${selectedMonth}月】 機器別購入額の構成割合`)}
              </h4>
              {selectedMonth === 'ALL' && maxMonthInfo.amount > 0 && (
                <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full font-bold border border-amber-200">
                  一番購入額が多い月: {maxMonthInfo.name}
                </span>
              )}
            </div>

            <div className="h-[280px] w-full pt-2">
              {selectedMonth === 'ALL' ? (
                graphType === 'bar' ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis 
                        tick={{ fontSize: 11, fill: '#64748b' }} 
                        tickFormatter={(value) => `¥${(value / 10000).toLocaleString()}万`}
                      />
                      <Tooltip
                        formatter={(value: any) => [`¥${Number(value).toLocaleString()}`, '購入金額']}
                        labelStyle={{ fontWeight: 'bold', color: '#0f172a' }}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                      />
                      <Bar dataKey="金額" radius={[6, 6, 0, 0]}>
                        {monthlyData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.month === maxMonthInfo.month && entry.金額 > 0 ? '#ea580c' : '#4f46e5'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={equipmentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="金額"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={true}
                      >
                        {equipmentData.map((entry, index) => (
                          <Cell key={`cell-pie-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => [`¥${Number(value).toLocaleString()}`, '金額']} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )
              ) : (
                /* 特定月選択時のグラフ表示 */
                graphType === 'bar' ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={equipmentData} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis 
                        tick={{ fontSize: 11, fill: '#64748b' }} 
                        tickFormatter={(value) => `¥${(value / 10000).toLocaleString()}万`}
                      />
                      <Tooltip
                        formatter={(value: any) => [`¥${Number(value).toLocaleString()}`, '購入金額']}
                        labelStyle={{ fontWeight: 'bold', color: '#0f172a' }}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                      />
                      <Bar dataKey="金額" fill="#0284c7" radius={[6, 6, 0, 0]}>
                        {equipmentData.map((entry, index) => (
                          <Cell key={`cell-eq-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={equipmentData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="金額"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {equipmentData.map((entry, index) => (
                          <Cell key={`cell-m-pie-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => [`¥${Number(value).toLocaleString()}`, '金額']} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )
              )}
            </div>
          </div>

          {/* ③ 特定月選択時の品目高額ランキング TOP5 */}
          {selectedMonth !== 'ALL' && topItemsInMonth.length > 0 && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
              <h4 className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>⭐ 【{selectedMonth}月】 購入金額 TOP5 品目</span>
                <span className="text-[11px] font-normal text-slate-500">（単価 × 数量の合計）</span>
              </h4>
              <div className="space-y-1.5">
                {topItemsInMonth.map((item, idx) => (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] ${
                        idx === 0 ? 'bg-amber-500 text-white' : idx === 1 ? 'bg-slate-400 text-white' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-bold text-slate-900">{item.name}</span>
                        <span className="text-[11px] text-slate-500 ml-2">({item.equipment})</span>
                      </div>
                    </div>
                    <div className="font-mono font-bold text-slate-900">
                      ¥{item.total.toLocaleString()}
                      <span className="text-[10px] text-slate-400 font-normal ml-1">
                        (¥{item.price.toLocaleString()} × {item.qty})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
