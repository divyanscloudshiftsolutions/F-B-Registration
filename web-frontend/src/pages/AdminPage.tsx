import React, { useState, useEffect } from 'react';
import { UserPlus, Settings } from 'lucide-react';
import { api } from '../services/api';
import type { User } from '../types';
import { useAuth } from '../context/AuthContext';

export const AdminPage: React.FC = () => {
  const { showToast } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [deliveryMode, setDeliveryMode] = useState<string>('NFC_CARD');
  const [isLoading, setIsLoading] = useState(true);

  // New Staff Registration State
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newRole, setNewRole] = useState<string>('receptionist');
  const [isRegistering, setIsRegistering] = useState(false);

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const [userData, mode] = await Promise.all([
        api.getUsers(),
        api.getDeliveryMode(),
      ]);
      setUsers(userData);
      setDeliveryMode(mode);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch admin settings.', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newFullName || !newPin) return;

    setIsRegistering(true);
    try {
      await api.createUser({
        username: newUsername.trim(),
        fullName: newFullName.trim(),
        pin: newPin.trim(),
        role: newRole,
      });
      showToast(`Staff user ${newUsername} created successfully!`, 'success');
      setNewUsername('');
      setNewFullName('');
      setNewPin('');
      loadAdminData();
    } catch (err: any) {
      showToast(err.message || 'Failed to register staff user.', 'danger');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await api.updateUserStatus(userId, !currentStatus);
      showToast('Staff status updated.', 'info');
      loadAdminData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update user status.', 'danger');
    }
  };

  const handleModeChange = async (mode: 'NFC_CARD' | 'EMAIL_QR' | 'BOTH') => {
    try {
      await api.setDeliveryMode(mode);
      setDeliveryMode(mode);
      showToast(`Global Delivery Mode updated to ${mode}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to set delivery mode.', 'danger');
    }
  };

  return (
    <div className="space-y-8">
      {/* Global Configuration Bar */}
      <div className="glass-panel p-6 rounded-3xl border border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center font-bold">
            <Settings size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">System Delivery Configuration</h3>
            <p className="text-xs text-gray-400">Configure global default delivery method for customer session tokens</p>
          </div>
        </div>

        <div className="flex gap-4">
          {['NFC_CARD', 'EMAIL_QR', 'BOTH'].map(m => (
            <button
              key={m}
              onClick={() => handleModeChange(m as any)}
              className={`px-6 py-3 rounded-2xl font-bold text-xs transition-all border ${
                deliveryMode === m
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-lg shadow-purple-500/10'
                  : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
              }`}
            >
              {m === 'NFC_CARD' && '💳 NFC Smart Card Only'}
              {m === 'EMAIL_QR' && '📱 Email QR Ticket Only'}
              {m === 'BOTH' && '✨ Dual Mode (NFC + Email QR)'}
            </button>
          ))}
        </div>
      </div>

      {/* Staff Directory & Creation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Register New Staff User */}
        <div className="glass-panel p-6 rounded-3xl border border-white/10 h-fit">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10 text-white font-bold text-sm">
            <UserPlus size={18} className="text-[#D4AF37]" /> Register New Staff Account
          </div>

          <form onSubmit={handleCreateUser} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-300 mb-1">Staff ID (Username)</label>
              <input
                type="text"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="e.g. REC-02"
                className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-300 mb-1">Full Name</label>
              <input
                type="text"
                value={newFullName}
                onChange={e => setNewFullName(e.target.value)}
                placeholder="e.g. Anish Malhotra"
                className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-300 mb-1">Security PIN Code</label>
              <input
                type="password"
                value={newPin}
                onChange={e => setNewPin(e.target.value)}
                placeholder="4-digit PIN"
                maxLength={6}
                className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-300 mb-1">Role Assignment</label>
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value)}
                className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
              >
                <option value="receptionist">Receptionist</option>
                <option value="bartender">Bartender</option>
                <option value="manager">Manager</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isRegistering}
              className="w-full mt-4 py-2.5 rounded-xl gold-gradient-btn text-xs uppercase font-bold tracking-wider disabled:opacity-50"
            >
              {isRegistering ? 'Registering...' : 'Create Staff Account'}
            </button>
          </form>
        </div>

        {/* Staff User Directory Table */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white">Staff User Directory</h3>
            <span className="text-xs text-gray-400 font-semibold">{users.length} Active Staff Accounts</span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Loading staff users...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 uppercase font-semibold text-[10px] tracking-wider">
                    <th className="pb-3 px-3">Staff ID</th>
                    <th className="pb-3 px-3">Full Name</th>
                    <th className="pb-3 px-3">Role</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-[#D4AF37]">{u.username}</td>
                      <td className="py-3 px-3 font-semibold text-white">{u.fullName}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-gray-300 uppercase">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.isActive ? 'badge-active' : 'badge-danger'}`}>
                          {u.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => handleToggleUserStatus(u.id, u.isActive)}
                          className="text-[11px] font-bold text-gray-400 hover:text-white transition-colors underline"
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
