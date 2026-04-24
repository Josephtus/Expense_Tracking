import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch, getImageUrl } from '../utils/api';
import { User, Mail, Phone, Calendar, Camera, Save, Shield, BadgeCheck, Trash2, Key, CheckCircle2, AlertCircle } from 'lucide-react';

interface ProfileSettingsProps {
  onUpdate: () => void;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ onUpdate }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    phone_number: '',
    birthday: ''
  });

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    new_password_confirm: ''
  });

  const [pwSaving, setPwSaving] = useState(false);

  const fetchProfile = async () => {
    try {
      const res = await apiFetch('/auth/me');
      const data = await res.json();
      setUser(data.user);
      setFormData({
        name: data.user.name || '',
        surname: data.user.surname || '',
        phone_number: data.user.phone_number || '',
        birthday: data.user.birthday ? (data.user.birthday.includes('T') ? data.user.birthday.split('T')[0] : data.user.birthday) : ''
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
      const res = await apiFetch('/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Güncelleme hatası");
      }
      alert("Profil başarıyla güncellendi.");
      onUpdate();
      fetchProfile();
    } catch (err: any) {
      alert(err.message || "Güncelleme sırasında hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.new_password_confirm) {
      alert("Yeni şifreler eşleşmiyor.");
      return;
    }
    setPwSaving(true);
    try {
      const res = await apiFetch('/users/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordData)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Şifre değiştirme hatası");
      }
      alert("Şifreniz başarıyla değiştirildi.");
      setPasswordData({ current_password: '', new_password: '', new_password_confirm: '' });
    } catch (err: any) {
      alert(err.message || "Hata oluştu.");
    } finally {
      setPwSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await apiFetch('/users/me/avatar', {
        method: 'POST',
        body: formData,
        // FormData kullanırken Content-Type başlığını tarayıcıya bırakmalıyız
      });
      if (!res.ok) throw new Error("Yükleme hatası");
      alert("Profil fotoğrafı güncellendi.");
      fetchProfile();
      onUpdate();
    } catch (err) {
      alert("Fotoğraf yüklenirken bir hata oluştu.");
    }
  };

  const handleDeleteAvatar = async () => {
    if (!window.confirm("Profil fotoğrafınızı silmek istediğinize emin misiniz?")) return;
    try {
      const res = await apiFetch('/users/me/avatar', { method: 'DELETE' });
      if (!res.ok) throw new Error("Silme hatası");
      alert("Profil fotoğrafı silindi.");
      fetchProfile();
      onUpdate();
    } catch (err) {
      alert("Silme işlemi başarısız.");
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-12 h-12 border-4 border-[#00f0ff]/20 border-t-[#00f0ff] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-fade-in">
      {/* Profil Header Card */}
      <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00f0ff]/5 blur-3xl rounded-full -mr-32 -mt-32 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
          {/* Avatar Section */}
          <div className="relative group">
            <div className="w-40 h-40 rounded-[48px] bg-slate-800 border-4 border-white/10 overflow-hidden shadow-2xl transition-transform group-hover:scale-105 duration-500 relative">
              {user?.profile_photo ? (
                <>
                  <img src={getImageUrl(user.profile_photo)} alt="Profile" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-white/10 backdrop-blur-md rounded-xl text-white hover:bg-[#00f0ff] hover:text-slate-950 transition-all">
                      <Camera size={20} />
                    </button>
                    <button onClick={handleDeleteAvatar} className="p-3 bg-white/10 backdrop-blur-md rounded-xl text-white hover:bg-red-500 transition-all">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                  <User size={48} />
                  <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black uppercase tracking-widest text-[#00f0ff] hover:underline">Fotoğraf Ekle</button>
                </div>
              )}
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
              <h2 className="text-4xl font-black text-white tracking-tighter">{user?.name} {user?.surname}</h2>
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

      {/* Profil Form Card */}
      <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] p-8 md:p-12 shadow-2xl">
        <form onSubmit={handleUpdate} className="space-y-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[#00f0ff]">
              <User size={16} />
            </div>
            <h3 className="text-xl font-black text-white tracking-tight">Kişisel Bilgiler</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Adınız</label>
              <input 
                type="text" 
                className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#00f0ff]/50 transition-all font-bold"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Soyadınız</label>
              <input 
                type="text" 
                className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#00f0ff]/50 transition-all font-bold"
                value={formData.surname}
                onChange={(e) => setFormData({...formData, surname: e.target.value})}
                required
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Telefon</label>
              <input 
                type="tel" 
                className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#00f0ff]/50 transition-all font-bold"
                value={formData.phone_number}
                onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Doğum Tarihi</label>
              <input 
                type="date" 
                className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#00f0ff]/50 transition-all font-bold"
                value={formData.birthday}
                onChange={(e) => setFormData({...formData, birthday: e.target.value})}
              />
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 flex flex-col md:flex-row gap-6 md:items-center justify-between">
            <div className="flex items-center gap-3 text-emerald-500/80">
              <CheckCircle2 size={16} />
              <p className="text-[10px] font-bold uppercase tracking-widest">Bilgileriniz uçtan uca şifrelenir.</p>
            </div>
            <button 
              type="submit"
              disabled={saving}
              className="px-12 py-5 bg-white text-slate-950 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-[#00f0ff] hover:shadow-[0_0_40px_rgba(0,240,255,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {saving ? 'Güncelleniyor...' : <><Save size={20} /> Güncelle</>}
            </button>
          </div>
        </form>
      </div>

      {/* Şifre Değiştirme Card */}
      <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[40px] p-8 md:p-12 shadow-2xl">
        <form onSubmit={handlePasswordChange} className="space-y-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[#b026ff]">
              <Key size={16} />
            </div>
            <h3 className="text-xl font-black text-white tracking-tight">Güvenlik ve Şifre</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Mevcut Şifre</label>
              <input 
                type="password" 
                className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#b026ff]/50 transition-all font-bold"
                value={passwordData.current_password}
                onChange={(e) => setPasswordData({...passwordData, current_password: e.target.value})}
                required
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Yeni Şifre</label>
              <input 
                type="password" 
                className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#b026ff]/50 transition-all font-bold"
                value={passwordData.new_password}
                onChange={(e) => setPasswordData({...passwordData, new_password: e.target.value})}
                required
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Yeni Şifre Tekrar</label>
              <input 
                type="password" 
                className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-4 px-6 text-white focus:outline-none focus:border-[#b026ff]/50 transition-all font-bold"
                value={passwordData.new_password_confirm}
                onChange={(e) => setPasswordData({...passwordData, new_password_confirm: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 flex flex-col md:flex-row gap-6 md:items-center justify-between">
            <div className="flex items-center gap-3 text-red-500/80">
              <AlertCircle size={16} />
              <p className="text-[10px] font-bold uppercase tracking-widest">Güçlü bir şifre seçtiğinizden emin olun.</p>
            </div>
            <button 
              type="submit"
              disabled={pwSaving}
              className="px-12 py-5 bg-white/5 text-white border border-white/10 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-[#b026ff] hover:border-[#b026ff] hover:shadow-[0_0_40px_rgba(176,38,255,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {pwSaving ? 'Güncelleniyor...' : 'Şifreyi Değiştir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
