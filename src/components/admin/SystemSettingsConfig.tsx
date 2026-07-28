import React, { useState, useEffect } from 'react';
import { Settings, Shield, CreditCard, QrCode, Trash2, CheckCircle2 } from 'lucide-react';
import { api, API_BASE_URL } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const SystemSettingsConfig: React.FC = () => {
  const { showToast } = useAuth();
  const [deliveryMode, setDeliveryMode] = useState<'NFC_CARD' | 'EMAIL_QR' | 'BOTH'>('NFC_CARD');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const mode = await api.getDeliveryMode();
      if (mode === 'NFC_CARD' || mode === 'EMAIL_QR' || mode === 'BOTH') {
        setDeliveryMode(mode);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load system settings.', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveDeliveryMode = async (newMode: 'NFC_CARD' | 'EMAIL_QR' | 'BOTH') => {
    setIsSaving(true);
    try {
      await api.setDeliveryMode(newMode);
      setDeliveryMode(newMode);
      showToast(`Global delivery mode updated to ${newMode}.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update delivery mode.', 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearCache = () => {
    localStorage.removeItem('nfc_web_cached_rates');
    localStorage.removeItem('nfc_web_cached_tables');
    showToast('Local browser cache cleared successfully.', 'info');
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Delivery Mode System Configuration */}
      <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
            <Settings size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Global Ticket Pass Delivery Mode</h3>
            <p className="text-xs text-gray-400">Configure default ticket dispatch method across reception check-in</p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-6 text-center text-gray-400 text-sm">Loading delivery settings...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleSaveDeliveryMode('NFC_CARD')}
              disabled={isSaving}
              className={`p-5 rounded-2xl border text-left flex flex-col justify-between h-36 transition-all ${
                deliveryMode === 'NFC_CARD'
                  ? 'bg-[#D4AF37]/15 border-[#D4AF37] shadow-xl shadow-[#D4AF37]/10'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex justify-between items-center">
                <CreditCard size={24} className={deliveryMode === 'NFC_CARD' ? 'text-[#D4AF37]' : 'text-gray-400'} />
                {deliveryMode === 'NFC_CARD' && <CheckCircle2 size={18} className="text-[#D4AF37]" />}
              </div>
              <div>
                <p className="text-xs font-bold text-white">NFC Smart Card</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Physical smart card pair</p>
              </div>
            </button>

            <button
              onClick={() => handleSaveDeliveryMode('EMAIL_QR')}
              disabled={isSaving}
              className={`p-5 rounded-2xl border text-left flex flex-col justify-between h-36 transition-all ${
                deliveryMode === 'EMAIL_QR'
                  ? 'bg-[#D4AF37]/15 border-[#D4AF37] shadow-xl shadow-[#D4AF37]/10'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex justify-between items-center">
                <QrCode size={24} className={deliveryMode === 'EMAIL_QR' ? 'text-[#D4AF37]' : 'text-gray-400'} />
                {deliveryMode === 'EMAIL_QR' && <CheckCircle2 size={18} className="text-[#D4AF37]" />}
              </div>
              <div>
                <p className="text-xs font-bold text-white">Digital Email QR</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Pass sent to guest phone/email</p>
              </div>
            </button>

            <button
              onClick={() => handleSaveDeliveryMode('BOTH')}
              disabled={isSaving}
              className={`p-5 rounded-2xl border text-left flex flex-col justify-between h-36 transition-all ${
                deliveryMode === 'BOTH'
                  ? 'bg-[#D4AF37]/15 border-[#D4AF37] shadow-xl shadow-[#D4AF37]/10'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex justify-between items-center">
                <Shield size={24} className={deliveryMode === 'BOTH' ? 'text-[#D4AF37]' : 'text-gray-400'} />
                {deliveryMode === 'BOTH' && <CheckCircle2 size={18} className="text-[#D4AF37]" />}
              </div>
              <div>
                <p className="text-xs font-bold text-white">Dual Mode (Both)</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Issue both NFC Card & Digital QR</p>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* System Server Connection Info Box */}
      <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4">
        <h4 className="text-xs font-bold uppercase text-[#D4AF37] tracking-wider">System Gateway Connection Status</h4>
        <div className="p-4 rounded-2xl bg-[#141A25] border border-white/10 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Production API Gateway:</span>
            <span className="font-mono text-emerald-400 font-bold">{API_BASE_URL}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Environment Status:</span>
            <span className="font-mono text-white">ONLINE • Production Active</span>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={handleClearCache}
            className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30 transition-all flex items-center gap-2"
          >
            <Trash2 size={14} /> Clear Local Browser Cache
          </button>
        </div>
      </div>
    </div>
  );
};
