import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../utils/api';

interface Expense {
  id: number;
  amount: number;
  content: string;
  category?: string;
  date: string;
  added_by: number;
  added_by_name: string;
}

interface Category {
  name: string;
  icon: string;
}

interface GroupInsightsProps {
  groupId: number;
  currentUserId?: number;
}

type FilterType = 'Ay' | 'Yıl' | 'Tümü';
type ViewScope = 'Grup İçin' | 'Benim İçin';

const DEFAULT_ICONS: Record<string, string> = {
  'Konaklama': '🛌', 'Eğlence': '🎤', 'Market Alışverişi': '🛒', 'Sağlık': '🦷',
  'Sigorta': '🧯', 'Kira ve Masraflar': '🏠', 'Restoranlar ve Barlar': '🍔',
  'Shopping': '🛍️', 'Transport': '🚕', 'Fatura': '🧾', 'Balık': '🐟',
  'Yufkacı': '🥟', 'Kasap': '🥩', 'İçme suyu': '💧', 'Halı Yıkama': '🧼', 'Diğer': '🖐️'
};

const CATEGORY_COLORS: string[] = ['#6366f1', '#f59e0b', '#ef4444', '#0ea5e9', '#8b5cf6', '#ec4899', '#10b981', '#f43f5e'];

export const GroupInsights: React.FC<GroupInsightsProps> = ({ groupId, currentUserId }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>('Ay');
  const [viewScope, setViewScope] = useState<ViewScope>('Grup İçin');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [customCats, setCustomCats] = useState<Category[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const fetchAll = async () => {
    try {
      const [expRes, groupRes] = await Promise.all([
        apiFetch(`/expenses/${groupId}`),
        apiFetch(`/groups/${groupId}`)
      ]);
      const expData = await expRes.json();
      const groupData = await groupRes.json();
      
      setExpenses(expData.expenses || []);
      if (groupData.group.custom_categories) {
        setCustomCats(JSON.parse(groupData.group.custom_categories));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [groupId]);

  const getIcon = (catName: string) => {
    if (DEFAULT_ICONS[catName]) return DEFAULT_ICONS[catName];
    const custom = customCats.find(c => c.name === catName);
    return custom ? custom.icon : '📦';
  };

  const filteredExpenses = useMemo(() => {
    let list = expenses;
    if (viewScope === 'Benim İçin' && currentUserId) {
      list = list.filter(e => e.added_by === currentUserId);
    }
    if (filterType === 'Ay') {
      list = list.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
      });
    } else if (filterType === 'Yıl') {
      list = list.filter(e => new Date(e.date).getFullYear() === currentDate.getFullYear());
    }
    return list;
  }, [expenses, filterType, viewScope, currentDate, currentUserId]);

  const stats = useMemo(() => {
    const categories: Record<string, { total: number; label: string; color: string; icon: string }> = {};
    let total = 0;
    
    filteredExpenses.forEach(e => {
      const catName = e.category || 'Diğer';
      if (!categories[catName]) {
        const colorIdx = Object.keys(categories).length % CATEGORY_COLORS.length;
        categories[catName] = { 
          total: 0, 
          label: catName, 
          color: CATEGORY_COLORS[colorIdx], 
          icon: getIcon(catName) 
        };
      }
      categories[catName].total += Number(e.amount);
      total += Number(e.amount);
    });
    
    return { 
      categories: Object.values(categories).sort((a, b) => b.total - a.total), 
      total 
    };
  }, [filteredExpenses, customCats]);

  const monthName = filterType === 'Ay' 
    ? currentDate.toLocaleString('tr-TR', { month: 'long', year: 'numeric' })
    : currentDate.getFullYear().toString();

  const handleNav = (dir: number) => {
    const d = new Date(currentDate);
    if (filterType === 'Ay') {
      d.setMonth(d.getMonth() + dir);
    } else if (filterType === 'Yıl') {
      d.setFullYear(d.getFullYear() + dir);
    }
    setCurrentDate(d);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-slate-900/20 rounded-[40px] border border-white/5">
        <div className="w-16 h-16 border-4 border-[#00f0ff]/10 border-t-[#00f0ff] rounded-full animate-spin mb-6"></div>
        <p className="text-[#00f0ff] font-black text-xs uppercase tracking-[0.4em] animate-pulse">Analiz Hazırlanıyor</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#00f0ff]/5 to-[#b026ff]/5 blur-3xl -mr-32 -mt-32 pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row gap-12 relative z-10">
          <div className="lg:w-1/2 space-y-10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-3xl font-black text-white tracking-tighter uppercase">İstatistikler</h3>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Gerçek Kategorilere Göre</p>
              </div>
              <div className="flex gap-1 bg-white/5 p-1 rounded-2xl">
                {(['Ay', 'Yıl', 'Tümü'] as FilterType[]).map(t => (
                  <button key={t} onClick={() => setFilterType(t)} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === t ? 'bg-white text-black shadow-xl' : 'text-slate-400 hover:text-white'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {filterType !== 'Tümü' && (
              <div className="flex items-center justify-between py-6 border-y border-white/5">
                <button onClick={() => handleNav(-1)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-[#00f0ff] hover:text-black transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="text-lg font-black text-white uppercase tracking-widest">{monthName}</span>
                <button onClick={() => handleNav(1)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-[#00f0ff] hover:text-black transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-10 bg-white/5 p-8 rounded-[32px] border border-white/5">
              <div className="relative w-48 h-48 flex-shrink-0">
                {stats.total > 0 ? (
                  <svg className="w-full h-full rotate-[-90deg]" viewBox="0 0 32 32">
                    {stats.categories.map((c, i) => {
                      const percentage = (c.total / stats.total) * 100;
                      let offset = 0;
                      for(let j=0; j<i; j++) offset += (stats.categories[j].total / stats.total) * 100;
                      return (
                        <motion.circle 
                          key={i} 
                          r="16" cx="16" cy="16" 
                          fill="transparent" 
                          stroke={c.color} 
                          strokeWidth="32" 
                          strokeDasharray={`${percentage} 100`} 
                          strokeDashoffset={-offset}
                          initial={{ strokeDasharray: "0 100" }}
                          animate={{ strokeDasharray: `${percentage} 100` }}
                          transition={{ duration: 1, delay: i * 0.1, ease: "easeOut" }}
                          onMouseEnter={() => setActiveIndex(i)}
                          onMouseLeave={() => setActiveIndex(null)}
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                        />
                      );
                    })}
                  </svg>
                ) : (
                  <div className="w-full h-full rounded-full border-4 border-white/5 flex items-center justify-center text-[10px] text-slate-500 font-bold uppercase">Veri Yok</div>
                )}
                <div className="absolute inset-0 bg-[#0f172a] rounded-full scale-[0.6] flex flex-col items-center justify-center text-center p-4 transition-all">
                  <AnimatePresence mode="wait">
                    {activeIndex !== null ? (
                      <motion.div
                        key="active"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="w-full"
                      >
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stats.categories[activeIndex].label}</p>
                        <p className="text-sm font-black text-[#00f0ff] truncate">₺{stats.categories[activeIndex].total.toLocaleString('tr-TR')}</p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="total"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="w-full"
                      >
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">TOPLAM</p>
                        <p className="text-sm font-black text-white truncate">₺{stats.total > 1000 ? (stats.total/1000).toFixed(1)+'K' : stats.total.toFixed(0)}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex-1 space-y-3 w-full">
                {stats.categories.slice(0, 4).map((c, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="text-xl">{c.icon}</span>
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider group-hover:text-white transition-colors">{c.label}</span>
                    </div>
                    <span className="text-xs font-black text-white">₺{c.total.toLocaleString('tr-TR')}</span>
                  </div>
                ))}
                {stats.categories.length > 4 && (
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center pt-2">+ {stats.categories.length - 4} Kategori Daha</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 bg-white/5 p-1 rounded-2xl w-fit">
              {(['Grup İçin', 'Benim İçin'] as ViewScope[]).map(v => (
                <button key={v} onClick={() => setViewScope(v)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewScope === v ? 'bg-[#00f0ff] text-black shadow-lg shadow-[#00f0ff]/20' : 'text-slate-500 hover:text-white'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:w-1/2 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Kategori Detayları</h4>
              <span className="text-[10px] font-black text-[#00f0ff] bg-[#00f0ff]/10 px-3 py-1 rounded-full uppercase">{stats.categories.length} Kategori</span>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {stats.categories.map((c, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group bg-white/5 p-5 rounded-[24px] border border-transparent hover:border-[#00f0ff]/30 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-xl group-hover:scale-110 transition-transform relative">
                      <div className="absolute -top-1 -left-1 w-3 h-3 rounded-full border-2 border-slate-900" style={{ backgroundColor: c.color }} />
                      {c.icon}
                    </div>
                    <div>
                      <p className="text-white font-black tracking-tight">{c.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                         <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{((c.total / stats.total) * 100).toFixed(1)}%</p>
                         <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(c.total / stats.total) * 100}%` }}
                              className="h-full" 
                              style={{ backgroundColor: c.color }}
                            />
                         </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-lg font-black text-white tracking-tighter">₺{c.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</p>
                </motion.div>
              ))}
              {stats.categories.length === 0 && (
                <div className="py-20 text-center">
                  <p className="text-slate-600 font-black uppercase text-xs tracking-widest">Bu dönemde harcama bulunamadı.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
