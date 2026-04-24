import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../utils/api';
import { Mail, Lock, ArrowLeft, ChevronRight, AlertCircle } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
  onSwitchToRegister: () => void;
  onSwitchToForgotPassword: () => void;
  onBackToLanding: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, onSwitchToRegister, onSwitchToForgotPassword, onBackToLanding }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ mail: email, password })
      });
      
      const data = await response.json();
      localStorage.setItem("token", data.access_token);
      onLoginSuccess();
      
    } catch (err: any) {
      console.error("Login hatası:", err);
      setError(err.message || "Giriş sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-slate-950 overflow-hidden">
      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#b026ff]/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#00f0ff]/5 blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[440px] relative z-10"
      >
        {/* Back Button */}
        <motion.button
          whileHover={{ x: -5 }}
          onClick={onBackToLanding}
          className="group mb-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-[#00f0ff]/50 transition-all">
            <ArrowLeft size={18} />
          </div>
          <span className="text-sm font-bold tracking-tight uppercase">Ana Sayfaya Dön</span>
        </motion.button>

        <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[32px] p-8 md:p-10 shadow-2xl relative overflow-hidden">
          {/* Header */}
          <div className="mb-10">
            <h2 className="text-4xl font-black text-white mb-2 tracking-tighter">Hoş Geldiniz</h2>
            <p className="text-slate-400 text-sm">Octoqus hesabınızla oturum açın.</p>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-3"
              >
                <AlertCircle size={16} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email Adresi</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#00f0ff] transition-colors">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  required
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-950/50 border border-white/5 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#00f0ff]/50 focus:bg-slate-950 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="isim@sirket.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Şifre</label>
                <button 
                  type="button"
                  onClick={onSwitchToForgotPassword}
                  className="text-[10px] font-black text-[#00f0ff] uppercase tracking-widest hover:underline"
                >
                  Şifremi Unuttum
                </button>
              </div>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#00f0ff] transition-colors">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  required
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-950/50 border border-white/5 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#00f0ff]/50 focus:bg-slate-950 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="group w-full py-4 bg-white text-black font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-[#00f0ff] transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  Oturum Aç <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-white/5 text-center">
            <p className="text-slate-400 text-sm mb-4">Henüz bir hesabınız yok mu?</p>
            <button 
              onClick={onSwitchToRegister}
              className="px-8 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 transition-all"
            >
              Ücretsiz Kayıt Ol
            </button>
          </div>
        </div>
        
        <p className="text-center mt-8 text-slate-600 text-[10px] font-bold tracking-widest uppercase">&copy; 2026 OCTOQUS LABS</p>
      </motion.div>
    </div>
  );
};
