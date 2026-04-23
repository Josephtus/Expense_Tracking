import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/api';

interface AdminGroup {
  id: number;
  name: string;
  content: string;
  is_approved: boolean;
  created_at: string;
  member_count?: number;
}

interface Expense {
  id: number;
  amount: number;
  content: string;
  date: string;
}

interface Member {
  id: number;
  role: string;
  is_approved: boolean;
  user?: {
    name: string;
    surname: string;
    mail: string;
  };
}

export const AdminGroups: React.FC = () => {
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupContent, setNewGroupContent] = useState('');

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/admin/groups');
      const data = await res.json();
      setGroups(data.groups || []);
    } catch (err) {
      console.error("Gruplar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupDetails = async (groupId: number) => {
    try {
      setSelectedGroupId(groupId);
      // Paralel çekelim
      const [expRes, memRes] = await Promise.all([
        apiFetch(`/admin/groups/${groupId}/expenses`),
        apiFetch(`/admin/groups/${groupId}/members`)
      ]);
      const expData = await expRes.json();
      const memData = await memRes.json();
      
      setExpenses(expData.data || []);
      setMembers(memData.members || []);
    } catch (err) {
      alert("Grup detayları yüklenemedi");
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const approveGroup = async (id: number) => {
    try {
      await apiFetch(`/admin/groups/${id}/approve`, { method: 'POST' });
      fetchGroups();
    } catch (err) {
      alert("Onaylanamadı");
    }
  };

  const deleteGroup = async (id: number) => {
    if (!window.confirm("Bu grubu TÜM VERİLERİYLE (harcamalar, üyeler, mesajlar) silmek istediğinize emin misiniz? Bu işlem geri alınamaz!")) return;
    try {
      await apiFetch(`/admin/groups/${id}`, { method: 'DELETE' });
      if (selectedGroupId === id) setSelectedGroupId(null);
      fetchGroups();
    } catch (err) {
      alert("Grup silinemedi");
    }
  };

  const deleteExpense = async (groupId: number, expenseId: number) => {
    if (!window.confirm("Bu harcamayı silmek istediğinize emin misiniz?")) return;
    try {
      await apiFetch(`/admin/expenses/${groupId}/${expenseId}`, { method: 'DELETE' });
      if (selectedGroupId) fetchGroupDetails(selectedGroupId);
    } catch (err) {
      alert("Silinemedi");
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/admin/groups', {
        method: 'POST',
        body: JSON.stringify({ name: newGroupName, content: newGroupContent })
      });
      setIsCreateModalOpen(false);
      setNewGroupName('');
      setNewGroupContent('');
      fetchGroups();
    } catch (err) {
      alert("Grup oluşturulamadı");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-slate-100 tracking-tight">Grup Yönetimi & Denetimi</h3>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-[#b026ff] text-white px-4 py-2 rounded-xl font-bold text-sm hover:shadow-[0_0_15px_#b026ff] transition-all"
        >
          + Yeni Grup Oluştur
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gruplar Listesi */}
        <div className="space-y-6">
          {loading ? <div className="text-[#00f0ff] animate-pulse">Yükleniyor...</div> : (
            <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
              {groups.map(group => (
                <div 
                  key={group.id} 
                  className={`p-5 rounded-2xl border transition-all cursor-pointer group ${
                    selectedGroupId === group.id ? 'bg-[#00f0ff]/5 border-[#00f0ff]/30 shadow-[0_0_15px_rgba(0,240,255,0.05)]' : 'bg-slate-950/30 border-slate-800 hover:border-slate-700'
                  }`}
                  onClick={() => fetchGroupDetails(group.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-slate-100">{group.name}</h4>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded ${group.is_approved ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'}`}>
                          {group.is_approved ? 'AKTİF' : 'ONAY BEKLİYOR'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mb-3 line-clamp-2">{group.content || 'Açıklama belirtilmemiş.'}</p>
                      <div className="flex items-center gap-4 text-[10px] text-slate-600">
                        <span>👤 {group.member_count || 0} Üye</span>
                        <span>📅 {new Date(group.created_at).toLocaleDateString()}</span>
                        <span>ID: #{group.id}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!group.is_approved && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); approveGroup(group.id); }}
                          className="bg-green-500 text-white text-[10px] font-black px-3 py-1.5 rounded-lg hover:bg-green-600"
                        >
                          ONAYLA
                        </button>
                      )}
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteGroup(group.id); }}
                        className="bg-red-500/10 text-red-500 text-[10px] font-black px-3 py-1.5 rounded-lg hover:bg-red-500 hover:text-white"
                      >
                        SİL
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detay İnceleme Alanı */}
        <div className="space-y-6">
          {!selectedGroupId ? (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center bg-slate-950/20 rounded-3xl border border-slate-800/50 text-slate-600 gap-4">
              <div className="text-4xl">🔍</div>
              <p className="italic text-sm">Grup detaylarını (harcamalar ve üyeler) incelemek için soldan bir grup seçin.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {/* Harcamalar */}
              <div className="bg-slate-950/20 p-6 rounded-3xl border border-slate-800/50">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Harcama Denetimi</h4>
                  <span className="text-xs text-[#00f0ff] font-mono">{expenses.length} Kayıt</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                  {expenses.map(exp => (
                    <div key={exp.id} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-800 group/exp">
                      <div>
                        <div className="font-bold text-slate-100">{exp.amount} TL</div>
                        <div className="text-xs text-slate-400 line-clamp-1">{exp.content || 'Açıklama yok'}</div>
                      </div>
                      <button 
                        onClick={() => deleteExpense(selectedGroupId, exp.id)}
                        className="opacity-0 group-hover/exp:opacity-100 transition-all bg-red-500/10 text-red-500 p-2 rounded-lg hover:bg-red-500 hover:text-white"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                  {expenses.length === 0 && <div className="text-center py-8 text-slate-600 text-xs italic">Harcama bulunamadı.</div>}
                </div>
              </div>

              {/* Üyeler */}
              <div className="bg-slate-950/20 p-6 rounded-3xl border border-slate-800/50">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Üye Listesi</h4>
                  <span className="text-xs text-[#b026ff] font-mono">{members.length} Üye</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {members.map(member => (
                    <div key={member.id} className="flex justify-between items-center p-3 bg-slate-900/30 rounded-xl border border-slate-800/50">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${member.is_approved ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-orange-500 animate-pulse'}`}></div>
                        <div>
                          <div className="text-xs font-bold text-slate-200">{member.user?.name} {member.user?.surname}</div>
                          <div className="text-[10px] text-slate-500">{member.role}</div>
                        </div>
                      </div>
                      {!member.is_approved && <span className="text-[9px] text-orange-400 font-black">ONAY BEKLIYOR</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grup Oluşturma Modalı */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h4 className="text-xl font-bold text-slate-100">Yeni Grup Oluştur (Admin)</h4>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateGroup} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Grup Adı</label>
                <input 
                  type="text" 
                  required
                  placeholder="Örn: Ev Arkadaşları"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:border-[#b026ff] outline-none"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Açıklama</label>
                <textarea 
                  rows={3}
                  placeholder="Grup hakkında kısa bir bilgi..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:border-[#b026ff] outline-none resize-none"
                  value={newGroupContent}
                  onChange={(e) => setNewGroupContent(e.target.value)}
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="submit"
                  className="flex-1 bg-[#b026ff] text-white font-bold py-2 rounded-xl hover:shadow-[0_0_15px_#b026ff] transition-all"
                >
                  Grubu Oluştur
                </button>
                <button 
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 bg-slate-800 text-slate-300 font-bold py-2 rounded-xl hover:bg-slate-700"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
