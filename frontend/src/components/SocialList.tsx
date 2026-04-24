import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch, getImageUrl } from '../utils/api';
import { Search, UserPlus, UserCheck, UserMinus, MessageSquare, Shield, Star, Users } from 'lucide-react';

interface SocialListProps {
  currentUserId: number;
  activeGroupId?: number | null;
}

export const SocialList: React.FC<SocialListProps> = ({ currentUserId }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<number[]>([]);

  const fetchSocialData = async () => {
    setLoading(true);
    try {
      const [usersRes, meRes] = await Promise.all([
        apiFetch(`/social/users?q=${encodeURIComponent(search)}`),
        apiFetch('/auth/me')
      ]);
      const usersData = await usersRes.json();
      const meData = await meRes.json();
      
      setUsers(usersData.users || []);
      // Takip edilenleri setle (Backend yapısına göre ayarla)
      if (meData.user?.following) {
        setFollowingIds(meData.user.following.map((f: any) => f.id));
      }
    } catch (err) {
      console.error("Sosyal veri çekme hatası:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSocialData();
  }, [search]);

  const toggleFollow = async (targetId: number, isFollowing: boolean) => {
    try {
      const method = isFollowing ? 'DELETE' : 'POST';
      await apiFetch(`/social/follow/${targetId}`, { method });
      setFollowingIds(prev => 
        isFollowing ? prev.filter(id => id !== targetId) : [...prev, targetId]
      );
    } catch (err) {
      console.error("Takip hatası:", err);
    }
  };

  return (
    <div className="space-y-12 animate-fade-in">
      {/* Search Header */}
      <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 p-8 md:p-10 rounded-[40px] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#b026ff]/5 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tighter mb-2">Sosyal Ağ</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Octoqus kullanıcıları ile bağlantı kur</p>
          </div>
          <div className="relative w-full max-w-md group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#b026ff] transition-colors">
              <Search size={20} />
            </div>
            <input 
              type="text" 
              placeholder="İsim veya email ile ara..."
              className="w-full pl-14 pr-6 py-5 rounded-[24px] bg-slate-950/50 border border-white/5 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#b026ff]/50 focus:bg-slate-950 transition-all shadow-inner"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading && users.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-64 bg-slate-900/40 rounded-[40px] border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {users.map((user, index) => {
              const isFollowing = followingIds.includes(user.id);
              if (user.id === currentUserId) return null;
              
              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -5 }}
                  className="bg-slate-900/40 backdrop-blur-md border border-white/5 p-8 rounded-[40px] hover:border-[#b026ff]/30 transition-all shadow-xl relative overflow-hidden"
                >
                  <div className="flex items-center gap-6 mb-8">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-3xl bg-slate-800 overflow-hidden border-2 border-white/5">
                        {user.profile_photo ? (
                          <img src={getImageUrl(user.profile_photo)} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl">👤</div>
                        )}
                      </div>
                      {user.role === 'ADMIN' && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full border-2 border-slate-900 flex items-center justify-center shadow-lg">
                          <Shield size={10} className="text-slate-900" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-white tracking-tight line-clamp-1">{user.name} {user.surname}</h4>
                      <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{user.mail}</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => toggleFollow(user.id, isFollowing)}
                      className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                        isFollowing 
                          ? 'bg-white/5 text-white border border-white/10 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20' 
                          : 'bg-[#b026ff] text-white shadow-[0_0_20px_rgba(176,38,255,0.3)] hover:scale-105'
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserMinus size={14} /> Takipten Çık
                        </>
                      ) : (
                        <>
                          <UserPlus size={14} /> Takip Et
                        </>
                      )}
                    </button>
                    <button className="p-4 rounded-2xl bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all border border-white/5">
                      <MessageSquare size={16} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
