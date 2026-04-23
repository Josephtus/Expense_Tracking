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

export const AdminGroups: React.FC = () => {
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

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

  const fetchExpenses = async (groupId: number) => {
    try {
      const res = await apiFetch(`/admin/groups/${groupId}/expenses`);
      const data = await res.json();
      setExpenses(data.expenses || []);
      setSelectedGroupId(groupId);
    } catch (err) {
      alert("Harcamalar çekilemedi");
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

  const deleteExpense = async (id: number) => {
    if (!window.confirm("Bu harcamayı silmek istediğinize emin misiniz?")) return;
    try {
      await apiFetch(`/admin/expenses/${id}`, { method: 'DELETE' });
      if (selectedGroupId) fetchExpenses(selectedGroupId);
    } catch (err) {
      alert("Silinemedi");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Gruplar Listesi */}
      <div className="space-y-6">
        <h3 className="text-2xl font-bold text-slate-100">Grup Onayları & Denetimi</h3>
        {loading ? <div className="text-[#00f0ff] animate-pulse">Yükleniyor...</div> : (
          <div className="space-y-3">
            {groups.map(group => (
              <div 
                key={group.id} 
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  selectedGroupId === group.id ? 'bg-[#00f0ff]/5 border-[#00f0ff]/30 shadow-[0_0_15px_rgba(0,240,255,0.05)]' : 'bg-slate-950/30 border-slate-800 hover:border-slate-700'
                }`}
                onClick={() => fetchExpenses(group.id)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-100">{group.name}</h4>
                    <p className="text-xs text-slate-500 mb-2">{group.content || 'Açıklama yok'}</p>
                    <div className="flex gap-2">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded ${group.is_approved ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'}`}>
                        {group.is_approved ? 'ONAYLI' : 'ONAY BEKLİYOR'}
                      </span>
                      <span className="text-[9px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">ID: #{group.id}</span>
                    </div>
                  </div>
                  {!group.is_approved && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); approveGroup(group.id); }}
                      className="bg-[#00f0ff] text-slate-900 text-xs font-black px-3 py-1.5 rounded-lg hover:shadow-[0_0_10px_#00f0ff]"
                    >
                      ONAYLA
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Harcama Denetimi */}
      <div className="space-y-6 bg-slate-950/20 p-6 rounded-3xl border border-slate-800/50">
        <h3 className="text-xl font-bold text-slate-100">Grup Harcamaları</h3>
        {!selectedGroupId ? (
          <div className="h-64 flex items-center justify-center text-slate-600 italic text-sm">
            Harcamaları görmek için soldan bir grup seçin.
          </div>
        ) : (
          <div className="space-y-4">
            {expenses.map(exp => (
              <div key={exp.id} className="flex justify-between items-center p-3 bg-slate-900 rounded-xl border border-slate-800 group">
                <div>
                  <div className="font-bold text-[#00f0ff]">{exp.amount} TL</div>
                  <div className="text-xs text-slate-400">{exp.content}</div>
                  <div className="text-[10px] text-slate-600">{new Date(exp.date).toLocaleDateString()}</div>
                </div>
                <button 
                  onClick={() => deleteExpense(exp.id)}
                  className="opacity-0 group-hover:opacity-100 transition-all bg-red-500/10 text-red-500 p-2 rounded-lg hover:bg-red-500 hover:text-white"
                >
                  🗑️
                </button>
              </div>
            ))}
            {expenses.length === 0 && <div className="text-slate-600 text-sm">Bu grupta henüz harcama yok.</div>}
          </div>
        )}
      </div>
    </div>
  );
};
