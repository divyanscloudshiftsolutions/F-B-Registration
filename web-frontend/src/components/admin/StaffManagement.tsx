import React, { useState, useEffect } from 'react';
import { UserPlus, Search, RefreshCw, X } from 'lucide-react';
import { api } from '../../services/api';
import type { User, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

export const StaffManagement: React.FC = () => {
  const { showToast } = useAuth();
  const { users, isLoading, refreshUsers } = useData();
  const [search, setSearch] = useState('');

  // Fetch users on component mount
  useEffect(() => {
    refreshUsers();
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('REC-01');
  const [role, setRole] = useState<UserRole>('receptionist');
  const [pin, setPin] = useState('1234');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const isDuplicate = users.some(u => u.username.toUpperCase() === username.trim().toUpperCase());
  const isFormValid = isFullNameValid && isUsernameValid && isPinValid && !isDuplicate;

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
      refreshUsers();
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
      refreshUsers();
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
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-4 rounded-2xl border border-border-main">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 text-text-muted" size={16} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search staff members by name, code or role..."
            className="w-full bg-bg-primary border border-border-main rounded-xl pl-10 pr-4 py-2 text-xs text-text-main placeholder-gray-500 focus:outline-none dark:focus:border-[#8D6CE5] focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refreshUsers}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all premium-btn-secondary"
          >
            <div className="nav-icon-badge">
              <RefreshCw size={12} />
            </div>
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl primary-btn text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 shadow-lg"
          >
            <div className="nav-icon-badge">
              <UserPlus size={14} />
            </div>
            <span>Add New Staff Member</span>
          </button>
        </div>
      </div>

      {/* Staff User Directory Table */}
      <div className="glass-panel rounded-2xl p-6 border border-border-main">
        {isLoading ? (
          <div className="py-12 text-center text-text-muted text-sm">Loading staff user directory...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center text-text-muted text-sm">No staff members found matching criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border-main text-text-muted uppercase font-semibold text-[10px] tracking-wider">
                  <th className="pb-3 px-3">Employee Code</th>
                  <th className="pb-3 px-3">Full Name</th>
                  <th className="pb-3 px-3">Shift Role</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3">Last Login</th>
                  <th className="pb-3 px-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main">
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-bg-primary transition-colors">
                    <td className="py-3 px-3 font-mono font-bold dark:text-[#8D6CE5] text-primary">{u.username}</td>
                    <td className="py-3 px-3 font-semibold text-text-main">{u.fullName}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        u.role === 'admin' ? 'dark:bg-amber-500/20 bg-amber-500/10 dark:text-amber-300 text-amber-700 border border-amber-500/40' :
                        u.role === 'receptionist' ? 'dark:bg-blue-500/20 bg-blue-500/10 dark:text-blue-300 text-blue-700 border border-blue-500/40' :
                        u.role === 'bartender' ? 'bg-emerald-500/20 dark:text-emerald-300 text-emerald-700 border border-emerald-500/40' :
                        'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.isActive ? 'badge-active' : 'dark:bg-red-500/20 bg-red-500/10 dark:text-red-400 text-red-700 border border-red-500/30'
                      }`}>
                        {u.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-text-muted">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer focus:outline-none focus:ring-2 ${
                          u.isActive
                            ? 'dark:bg-red-500/20 bg-red-500/10 hover:dark:bg-red-500/30 hover:bg-red-500/15 hover:border-red-500/50 hover:text-red-800 active:bg-red-500/25 active:text-red-900 dark:text-red-400 text-red-700 border-red-500/30 focus:ring-red-500/20'
                            : 'dark:bg-emerald-500/20 bg-emerald-500/10 hover:dark:bg-emerald-500/30 hover:bg-emerald-500/15 hover:border-emerald-500/50 hover:text-emerald-800 active:bg-emerald-500/25 active:text-emerald-900 dark:text-emerald-400 text-emerald-700 border-emerald-500/30 focus:ring-emerald-500/20'
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
          <div className="bg-bg-surface border border-border-main rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-main"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 text-text-main font-bold text-sm">
              <UserPlus size={18} /> Register New Staff Member
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Shift Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as UserRole)}
                  className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none dark:focus:border-[#8D6CE5] focus:border-primary"
                >
                  <option value="receptionist">Receptionist (REC)</option>
                  <option value="bartender">Bartender (BAR)</option>
                  <option value="admin">Administrator (ADM)</option>
                  <option value="manager">Manager (MGR)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Divyansh Saxena"
                  className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none dark:focus:border-[#8D6CE5] focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">
                  Employee Code Username <span className="text-text-muted">(Must match pattern {expectedPrefix}-xx)</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value.toUpperCase())}
                  placeholder={`e.g. ${expectedPrefix}-01`}
                  className={`w-full bg-bg-primary border rounded-xl px-3 py-2 text-xs text-text-main font-mono focus:outline-none dark:focus:border-[#8D6CE5] focus:border-primary ${
                    username.trim() && (!isUsernameValid || isDuplicate) ? 'border-red-500/50 focus:border-red-500' : 'border-border-main'
                  }`}
                  required
                />
                {username.trim() && !isUsernameValid && (
                  <p className="text-[10px] dark:text-red-400 text-red-700 mt-1 font-medium">
                    Invalid format. Expected pattern: <strong className="font-bold">{expectedPrefix}-XX</strong> (e.g., {expectedPrefix}-01, {expectedPrefix}-02)
                  </p>
                )}
                {username.trim() && isUsernameValid && isDuplicate && (
                  <p className="text-[10px] dark:text-red-400 text-red-700 mt-1 font-medium">
                    Duplicate code. The employee username <strong className="font-bold">{username}</strong> is already registered.
                  </p>
                )}
                {username.trim() && isUsernameValid && !isDuplicate && (
                  <p className="text-[10px] dark:text-emerald-400 text-emerald-700 mt-1 font-medium">
                    ✓ Employee code is valid and available.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">
                  4-Digit Access PIN <span className="text-text-muted">(Numeric only)</span>
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  maxLength={4}
                  placeholder="e.g. 1234"
                  className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main font-mono focus:outline-none dark:focus:border-[#8D6CE5] focus:border-primary"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all premium-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isFormValid}
                  title={isSubmitting ? "Registering..." : !isFormValid ? "Fill all fields" : undefined}
                  className="flex-1 py-2.5 rounded-xl primary-btn text-xs font-bold uppercase tracking-wider disabled:opacity-50"
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

