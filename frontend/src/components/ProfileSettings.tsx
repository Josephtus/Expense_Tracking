import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiFetch, getImageUrl } from '../utils/api';
import { User, Mail, Phone, Calendar, Camera, Save, Shield, BadgeCheck } from 'lucide-react';

interface ProfileSettingsProps {
  onUpdate: () => void;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ onUpdate }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    phone_number: '',
    birthday: ''
  });

  const fetchProfile = async () => {
    try {
      const res = await apiFetch('/auth/me');
      const data = await res.json();
      setUser(data.user);
      setFormData({
        name: data.user.name,
        surname: data.user.surname,
        phone_number: data.user.phone_number || '',
        birthday: data.user.birthday || ''
      });
    } catch (err) {
      console.error("Profil yüklenemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Backend /users/me veya /auth/me update endpointine göre düzenle
      // Varsayılan olarak profil güncelleme endpointi: PUT /users/me (Eğer varsa)
      // Yoksa genel bir profil güncelleme mantığı kurgula
      await apiFetch('/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      alert("Profil başarıyla güncellendi.");
      onUpdate();
    } catch (err: any) {
      alert(err.message || "Güncelleme sırasında hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-12 h-12 border-4 border-[#00f0ff]/20 border-t-[#00f0ff] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-fade-in">
      <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00f0ff]/5 blur-3xl rounded-full -mr-32 -mt-32 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
          {/* Avatar Section */}
          <div className="relative group">
            <div className="w-40 h-40 rounded-[48px] bg-slate-800 border-4 border-white/10 overflow-hidden shadow-2xl transition-transform group-hover:scale-105 duration-500">
              {user?.profile_photo ? (
                <img src={getImageUrl(user.profile_photo)} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl">👤</div>
              )}
            </div>
            <button className="absolute bottom-2 right-2 w-12 h-12 bg-[#00f0ff] text-slate-900 rounded-2xl flex items-center justify-center shadow-xl hover:scale-110 transition-all border-4 border-slate-900">
              <Camera size={20} />
            </button>
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
              <h2 className="text-4xl font-black text-white tracking-tighter">{user?.name} {user?.surname}</h2>
              {user?.role === 'ADMIN' && (
                <div className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1 rounded-full flex items-center gap-2">
                  <Shield size={12} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Admin</span>
                </div>
              )}
              <div className="bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/20 px-3 py-1 rounded-full flex items-center gap-2">
                <BadgeCheck size={12} />
                <span className="text-[10px] font-black uppercase tracking-widest">Doğrulanmış</span>
              </div>
            </div>
            <p className="text-slate-400 font-medium mb-1">{user?.mail}</p>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Kayıt Tarihi: {new Date(user?.created_at).toLocaleDateString('tr-TR')}</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] p-8 md:p-12 shadow-2xl">
        <form onSubmit={handleUpdate} className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Name Input */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Adınız</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#00f0ff] transition-colors">
                  <User size={18} />
                </div>
                <input 
                  type="text" 
                  className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-white focus:outline-none focus:border-[#00f0ff]/50 transition-all font-bold"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
            </div>

            {/* Surname Input */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Soyadınız</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#00f0ff] transition-colors">
                  <User size={18} />
                </div>
                <input 
                  type="text" 
                  className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-white focus:outline-none focus:border-[#00f0ff]/50 transition-all font-bold"
                  value={formData.surname}
                  onChange={(e) => setFormData({...formData, surname: e.target.value})}
                  required
                />
              </div>
            </div>

            {/* Phone Input */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Telefon</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#00f0ff] transition-colors">
                  <Phone size={18} />
                </div>
                <input 
                  type="tel" 
                  className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-white focus:outline-none focus:border-[#00f0ff]/50 transition-all font-bold"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                  placeholder="+905..."
                />
              </div>
            </div>

            {/* Birthday Input */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Doğum Tarihi</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#00f0ff] transition-colors">
                  <Calendar size={18} />
                </div>
                <input 
                  type="date" 
                  className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-white focus:outline-none focus:border-[#00f0ff]/50 transition-all font-bold"
                  value={formData.birthday}
                  onChange={(e) => setFormData({...formData, birthday: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 flex flex-col md:flex-row gap-6 md:items-center justify-between">
            <p className="text-slate-500 text-[10px] max-w-sm">
              Bilgileriniz sadece grup içi hesaplamalarda ve profil görünürlüğünüzde kullanılır. Octoqus güvenliğinize önem verir.
            </p>
            <button 
              type="submit"
              disabled={saving}
              className="px-12 py-5 bg-white text-slate-950 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-[#00f0ff] hover:shadow-[0_0_40px_rgba(0,240,255,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {saving ? 'Güncelleniyor...' : <><Save size={20} /> Değişiklikleri Kaydet</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
