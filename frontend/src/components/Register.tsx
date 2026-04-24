import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../utils/api';
import { User, Mail, Lock, Phone, Calendar, ArrowLeft, ChevronRight, AlertCircle, Sparkles } from 'lucide-react';

interface RegisterProps {
  onRegisterSuccess: () => void;
  onSwitchToLogin: () => void;
  onBackToLanding: () => void;
}

export const Register: React.FC<RegisterProps> = ({ onRegisterSuccess, onSwitchToLogin, onBackToLanding }) => {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [birthday, setBirthday] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    if (!phoneNumber.startsWith('+') || phoneNumber.length < 10) {
      setError('Telefon numarası uluslararası formatta olmalıdır. Örn: +905551234567');
      setLoading(false);
      return;
    }
    
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ 
          name, 
          surname, 
          birthday,
          phone_number: phoneNumber,
          mail: email, 
          password 
        })
      });
      onRegisterSuccess();
      
    } catch (err: any) {
      console.error("Kayıt hatası:", err);
      setError("Kayıt sırasında bir hata oluştu. Lütfen bilgilerinizi kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-slate-950 overflow-hidden py-20">
      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#00f0ff]/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#b026ff]/5 blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[560px] relative z-10"
      >
        {/* Back Button */}
        <motion.button
          whileHover={{ x: -5 }}
          onClick={onBackToLanding}
          className="group mb-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-[#b026ff]/50 transition-all">
            <ArrowLeft size={18} />
          </div>
          <span className="text-sm font-bold tracking-tight uppercase">Ana Sayfaya Dön</span>
        </motion.button>

        <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
          {/* Header */}
          <div className="mb-10 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#b026ff]/10 border border-[#b026ff]/20 text-[#b026ff] text-[10px] font-black uppercase tracking-widest mb-4">
              <Sparkles size={12} /> Aramıza Katılın
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tighter leading-none">Hesap Oluştur</h2>
            <p className="text-slate-400 text-sm">Finansal yolculuğunuza bugün başlayın.</p>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-3"
              >
                <AlertCircle size={16} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleRegister} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Ad</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#b026ff] transition-colors">
                    <User size={18} />
                  </div>
                  <input 
                    type="text" 
                    required
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-950/50 border border-white/5 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#b026ff]/50 focus:bg-slate-950 transition-all"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Can"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Soyad</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-6 py-4 rounded-2xl bg-slate-950/50 border border-white/5 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#b026ff]/50 focus:bg-slate-950 transition-all"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  placeholder="Yılmaz"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Doğum Tarihi</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                  <Calendar size={18} />
                </div>
                <input 
                  type="date" 
                  required
                  className="w-full pl-12 pr-6 py-4 rounded-2xl bg-slate-950/50 border border-white/5 text-white focus:outline-none focus:border-[#b026ff]/50 focus:bg-slate-950 transition-all [color-scheme:dark]"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                />
              </div>
              <p className="text-[10px] text-slate-500 ml-1">Yaşınız bu tarihe göre otomatik hesaplanacaktır.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Telefon Numarası</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#b026ff] transition-colors">
                  <Phone size={18} />
                </div>
                <input 
                  type="tel" 
                  required
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-950/50 border border-white/5 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#b026ff]/50 focus:bg-slate-950 transition-all"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+905551234567"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email Adresi</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#b026ff] transition-colors">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  required
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-950/50 border border-white/5 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#b026ff]/50 focus:bg-slate-950 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="isim@sirket.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Güçlü Bir Şifre</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#b026ff] transition-colors">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  required
                  minLength={8}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-950/50 border border-white/5 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#b026ff]/50 focus:bg-slate-950 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 karakter"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="group w-full py-5 bg-[#b026ff] text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-[#9d1fee] hover:shadow-[0_0_30px_rgba(176,38,255,0.3)] transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Hesabı Oluştur <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-white/5 text-center">
            <p className="text-slate-400 text-sm mb-4">Zaten bir hesabınız var mı?</p>
            <button 
              onClick={onSwitchToLogin}
              className="px-8 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 transition-all"
            >
              Giriş Yap
            </button>
          </div>
        </div>
        
        <p className="text-center mt-8 text-slate-600 text-[10px] font-bold tracking-widest uppercase">&copy; 2026 OCTOQUS LABS</p>
      </motion.div>
    </div>
  );
};
