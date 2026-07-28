import React, { useState, useEffect } from 'react';
import { UserPlus, Search, RefreshCw, X } from 'lucide-react';
import { api } from '../../services/api';
import type { User, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const StaffManagement: React.FC = () => {
  const { showToast } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('REC-01');
  const [role, setRole] = useState<UserRole>('receptionist');
  const [pin, setPin] = useState('1234');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load staff directory.', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Update default username prefix when role changes
  useEffect(() => {
    const prefix = role === 'admin' ? 'ADM' : (role === 'receptionist' ? 'REC' : (role === 'bartender' ? 'BAR' : 'MGR'));
    setUsername(`${prefix}-01`);
  }, [role]);

  // Validations matching AdminPortal.tsx
  const isFullNameValid = /^[a-zA-Z\s.'-]{2,100}$/.test(fullName.trim());
  const expectedPrefix = role === 'admin' ? 'ADM' : (role === 'receptionist' ? 'REC' : (role === 'bartender' ? 'BAR' : 'MGR'));
  const isUsernameValid = new RegExp('^' + expectedPrefix + '-\\d{2}$').test(username.trim().toUpperCase());
  const isPinValid = /^\d{4}$/.test(pin.trim());
  const isFormValid = isFullNameValid && isUsernameValid && isPinValid;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    try {
      await api.createUser({
        username: username.trim().toUpperCase(),
        fullName: fullName.trim(),
        pin: pin.trim(),
        role: role,
      });
      showToast(`Staff member ${fullName} (${username}) created successfully!`, 'success');
      setIsModalOpen(false);
      setFullName('');
      loadUsers();
    } catch (err: any) {
      showToast(err.message || 'Failed to register staff member.', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      await api.updateUserStatus(user.id, !user.isActive);
      showToast(`User ${user.username} is now ${!user.isActive ? 'Active' : 'Inactive'}.`, 'info');
      loadUsers();
    } catch (err: any) {
      showToast(err.message || 'Failed to update user status.', 'danger');
    }
  };

  const filteredUsers = users.filter(u => 
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-4 rounded-2xl border border-white/10">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search staff members by name, code or role..."
            className="w-full bg-[#1A202C] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadUsers}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 border border-white/10 flex items-center gap-1.5 transition-all"
          >
            <RefreshCw size={14} /> Refresh
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl gold-gradient-btn text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 shadow-lg"
          >
            <UserPlus size={16} /> Add New Staff Member
          </button>
        </div>
      </div>

      {/* Staff User Directory Table */}
      <div className="glass-panel rounded-2xl p-6 border border-white/10">
        {isLoading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading staff user directory...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">No staff members found matching criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 uppercase font-semibold text-[10px] tracking-wider">
                  <th className="pb-3 px-3">Employee Code</th>
                  <th className="pb-3 px-3">Full Name</th>
                  <th className="pb-3 px-3">Shift Role</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3">Last Login</th>
                  <th className="pb-3 px-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-[#D4AF37]">{u.username}</td>
                    <td className="py-3 px-3 font-semibold text-white">{u.fullName}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        u.role === 'admin' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                        u.role === 'receptionist' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' :
                        u.role === 'bartender' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                        'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.isActive ? 'badge-active' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {u.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-gray-400">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                          u.isActive
                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        }`}
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

      {/* CREATE STAFF MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121620] border border-white/10 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 text-[#D4AF37] font-bold text-sm">
              <UserPlus size={18} /> Register New Staff Member
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Shift Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as UserRole)}
                  className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value="receptionist">Receptionist (REC)</option>
                  <option value="bartender">Bartender (BAR)</option>
                  <option value="admin">Administrator (ADM)</option>
                  <option value="manager">Manager (MGR)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Divyansh Saxena"
                  className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Employee Code Username <span className="text-gray-500">(Must match pattern {expectedPrefix}-xx)</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value.toUpperCase())}
                  placeholder={`e.g. ${expectedPrefix}-01`}
                  className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  4-Digit Access PIN <span className="text-gray-500">(Numeric only)</span>
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  maxLength={4}
                  placeholder="e.g. 1234"
                  className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isFormValid}
                  className="flex-1 py-2.5 rounded-xl gold-gradient-btn text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                >
                  {isSubmitting ? 'Registering...' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
