import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';
import { ExpenseForm } from './ExpenseForm';
import { ExpenseList } from './ExpenseList';
import { GroupList } from './GroupList';
import { DebtList } from './DebtList';
import { ProfileSettings } from './ProfileSettings';
import { GroupChat } from './GroupChat';
import { SocialList } from './SocialList';
import { ReportForm } from './ReportForm';
import { AdminPanel } from './admin/AdminPanel';

type TabType = 'Gruplar' | 'Harcamalar' | 'Borç Durumu' | 'Sohbet' | 'Sosyal' | 'Profil' | 'Şikayet' | 'Admin';

export const Dashboard: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [activeTab, setActiveTab] = useState<TabType>('Gruplar');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await apiFetch('/auth/me');
        const data = await response.json();
        setUser(data.user);
      } catch (error) {
        console.error('Kullanıcı bilgileri alınırken hata:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950">
        <h2 className="text-3xl font-bold text-[#00f0ff] animate-pulse">Yükleniyor...</h2>
      </div>
    );
  }

  const navTabs: TabType[] = [
    'Gruplar', 'Harcamalar', 'Borç Durumu', 'Sohbet', 'Sosyal', 'Profil', 'Şikayet'
  ];
  if (user?.role?.toLowerCase() === 'admin') {
    navTabs.unshift('Admin'); // Admin sekmesini en başa alalım ki kaçmasın
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-5 border-b border-slate-800/50 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#00f0ff] to-[#b026ff] rounded-xl flex items-center justify-center font-black text-slate-900 text-xl shadow-[0_0_15px_rgba(0,240,255,0.4)]">
                ET
              </div>
              <h1 className="text-xl font-black text-slate-100 hidden md:block">EXPENSE <span className="text-[#00f0ff]">TRACKER</span></h1>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-400">
                Hoş Geldin, <span className="text-slate-100 font-bold">{user?.name}</span>
                {user?.role?.toLowerCase() === 'admin' && <span className="ml-2 bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">Admin Yetkisi</span>}
              </div>
              <button onClick={logout} className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 transition-colors text-sm font-bold">Çıkış</button>
            </div>
          </div>
          
          <nav className="flex space-x-2 overflow-x-auto pb-0 no-scrollbar scroll-smooth">
            {navTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap py-3 px-5 rounded-t-xl font-bold text-xs sm:text-sm transition-all ${
                  activeTab === tab
                    ? 'bg-slate-800 text-[#00f0ff] border-t-2 border-[#00f0ff] shadow-[0_-4px_10px_rgba(0,240,255,0.1)]'
                    : 'text-slate-500 border-t-2 border-transparent hover:text-slate-300'
                }`}
              >
                {tab === 'Admin' ? '🛡️ ADMİN PANEL' : tab}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {activeTab === 'Gruplar' && (
          <GroupList onSelectGroup={(id) => { setActiveGroupId(id); setActiveTab('Harcamalar'); }} activeGroupId={activeGroupId} />
        )}

        {(activeTab === 'Harcamalar' || activeTab === 'Borç Durumu' || activeTab === 'Sohbet') && !activeGroupId && (
          <div className="p-12 text-center bg-slate-900 rounded-3xl border border-slate-800 border-dashed">
            <p className="text-slate-400 mb-4 italic">Bu özelliği kullanmak için önce "Gruplar" sekmesinden bir grup seçmelisiniz.</p>
            <button onClick={() => setActiveTab('Gruplar')} className="text-[#00f0ff] font-bold underline hover:text-[#4dffff]">Gruplara Git →</button>
          </div>
        )}

        {activeTab === 'Harcamalar' && activeGroupId && (
          <div className="flex flex-col w-full max-w-5xl mx-auto space-y-6">
            <div className="w-full flex justify-between items-center bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
              <h2 className="text-2xl font-bold text-slate-100">Grup Harcamaları</h2>
              <button className="px-6 py-3 rounded-xl font-bold bg-[#b026ff] text-white hover:bg-[#c455ff] transition-all shadow-lg" onClick={() => setIsModalOpen(true)}>+ Harcama Ekle</button>
            </div>
            <ExpenseList groupId={activeGroupId} refreshTrigger={refreshTrigger} />
            {isModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
                <div className="relative w-full max-w-md">
                  <ExpenseForm groupId={activeGroupId} onSuccess={() => { setIsModalOpen(false); setRefreshTrigger(prev => prev + 1); }} onCancel={() => setIsModalOpen(false)} />
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Borç Durumu' && activeGroupId && <DebtList groupId={activeGroupId} />}
        
        {activeTab === 'Sohbet' && activeGroupId && <GroupChat groupId={activeGroupId} currentUserId={user?.id} />}

        {activeTab === 'Sosyal' && <SocialList currentUserId={user?.id} />}

        {activeTab === 'Profil' && <ProfileSettings />}

        {activeTab === 'Şikayet' && <ReportForm />}

        {activeTab === 'Admin' && user?.role?.toLowerCase() === 'admin' && <AdminPanel />}
        
      </main>
    </div>
  );
};
