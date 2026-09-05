import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Search, 
  X, 
  Users, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  UserCheck, 
  UserX, 
  Edit2,
  Trash2,
  Shield,
  Briefcase,
  Building2,
  Wine,
  ChefHat,
  UtensilsCrossed
} from 'lucide-react';
import { api } from '../../services/api';
import type { User, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

const ROLE_TABS_CONFIG = [
  { id: 'ALL', label: 'ALL', icon: Users },
  { id: 'ADMIN', label: 'ADMIN', icon: Shield },
  { id: 'MANAGER', label: 'MANAGER', icon: Briefcase },
  { id: 'RECEPTIONIST', label: 'RECEPTIONIST', icon: Building2 },
  { id: 'BARTENDER', label: 'BARTENDER', icon: Wine },
  { id: 'CHEF', label: 'CHEF', icon: ChefHat },
  { id: 'WAITER', label: 'WAITER', icon: UtensilsCrossed },
] as const;

export const StaffManagement: React.FC = () => {
  const { user, showToast } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const { users, isLoading, refreshUsers } = useData();
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedRole]);

  // Fetch users on component mount
  useEffect(() => {
    refreshUsers();
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDeactivate, setUserToDeactivate] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const isEditing = editingUser !== null;
  const isDrawerOpen = isModalOpen || isEditing;

  // Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('REC-01');
  const [role, setRole] = useState<UserRole>('receptionist');
  const [pin, setPin] = useState('1234');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper to generate the next available code for a role
  const generateNextCode = (targetRole: UserRole) => {
    const prefix = targetRole === 'admin' ? 'ADM' : (targetRole === 'receptionist' ? 'REC' : (targetRole === 'bartender' ? 'BAR' : (targetRole === 'chef' ? 'CHF' : (targetRole === 'waiter' ? 'WTR' : 'MGR'))));
    let num = 1;
    while (users.some(u => u.username.toUpperCase() === `${prefix}-${String(num).padStart(2, '0')}`)) {
      num++;
    }
    return `${prefix}-${String(num).padStart(2, '0')}`;
  };

  // Smart username prefix generation for creation mode
  useEffect(() => {
    if (isEditing) return;
    setUsername(generateNextCode(role));
  }, [role, users, isEditing]);

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (!isEditing) {
      setUsername(generateNextCode(newRole));
    } else {
      // If editing and current code has an old role prefix, auto-suggest new code
      const currentPrefix = role === 'admin' ? 'ADM' : (role === 'receptionist' ? 'REC' : (role === 'bartender' ? 'BAR' : (role === 'chef' ? 'CHF' : (role === 'waiter' ? 'WTR' : 'MGR'))));
      if (username.toUpperCase().startsWith(`${currentPrefix}-`)) {
        setUsername(generateNextCode(newRole));
      }
    }
  };

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFullName('');
    setRole('receptionist');
    setPin('1234');
    setShowPin(false);
    setUsername(generateNextCode('receptionist'));
    setIsModalOpen(true);
  };

  const handleOpenEdit = (targetUser: User) => {
    setEditingUser(targetUser);
    setIsModalOpen(false);
    setFullName(targetUser.fullName || '');
    setUsername(targetUser.username || '');
    setRole((targetUser.role?.toLowerCase() as UserRole) || 'receptionist');
    setPin(''); // Blank by default, optional on edit
    setShowPin(false);
  };

  const handleCloseDrawer = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setShowPin(false);
  };

  // Keyboard Escape listener to dismiss modal or drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (userToDeactivate) {
          setUserToDeactivate(null);
        } else if (isDrawerOpen) {
          handleCloseDrawer();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, userToDeactivate]);

  // Validations matching AdminPortal.tsx and backend routes
  const isFullNameValid = /^[a-zA-Z\s.'-]{2,100}$/.test(fullName.trim());
  const expectedPrefix = role === 'admin' ? 'ADM' : (role === 'receptionist' ? 'REC' : (role === 'bartender' ? 'BAR' : (role === 'chef' ? 'CHF' : (role === 'waiter' ? 'WTR' : 'MGR'))));
  const isSeededUsername = ['admin', 'receptionist', 'bartender', 'manager', 'chef', 'waiter', 'server'].includes(username.trim().toLowerCase());
  const isUsernameValid = isSeededUsername || new RegExp('^' + expectedPrefix + '-\\d{2}$').test(username.trim().toUpperCase());
  const isPinValid = isEditing ? (pin.trim().length === 0 || /^\d{4}$/.test(pin.trim())) : /^\d{4}$/.test(pin.trim());
  const isDuplicate = users.some(u =>
    u.username.toUpperCase() === username.trim().toUpperCase() &&
    (isEditing && editingUser ? u.id !== editingUser.id : true)
  );
  const isFormValid = isFullNameValid && isUsernameValid && isPinValid && !isDuplicate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    try {
      if (isEditing && editingUser) {
        await api.updateUser(editingUser.id, {
          username: username.trim().toUpperCase(),
          fullName: fullName.trim(),
          role: role,
          pin: pin.trim() ? pin.trim() : undefined,
        });
        showToast(`Staff member ${fullName} (${username}) updated successfully!`, 'success');
      } else {
        await api.createUser({
          username: username.trim().toUpperCase(),
          fullName: fullName.trim(),
          pin: pin.trim(),
          role: role,
        });
        showToast(`Staff member ${fullName} (${username}) created successfully!`, 'success');
      }
      handleCloseDrawer();
      setFullName('');
      setPin('1234');
      refreshUsers();
    } catch (err: any) {
      showToast(err.message || (isEditing ? 'Failed to update staff member.' : 'Failed to register staff member.'), 'danger');
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

  const handleConfirmDeactivate = async () => {
    if (!userToDeactivate) return;
    await handleToggleStatus(userToDeactivate);
    setUserToDeactivate(null);
  };

  const isMainAdmin = (u?: User | null) => {
    if (!u) return false;
    const uname = (u.username || '').toLowerCase();
    return uname === 'admin' || uname === 'adm-01';
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const res = await api.deleteUser(userToDelete.id);
      showToast(res.message || `Staff member ${userToDelete.username} deleted successfully.`, 'info');
      setUserToDelete(null);
      handleCloseDrawer();
      await refreshUsers();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete staff member.', 'danger');
    } finally {
      setIsDeleting(false);
    }
  };

  const totalStaff = users.length;
  const activeStaff = users.filter(u => u.isActive).length;
  const inactiveStaff = users.filter(u => !u.isActive).length;

  const getRoleCount = (tab: string) => {
    if (tab === 'ALL') return users.length;
    const target = tab.toLowerCase();
    return users.filter(u => {
      const uRole = (u.role || '').toLowerCase();
      if (target === 'waiter') return uRole === 'waiter' || uRole === 'server';
      return uRole === target;
    }).length;
  };

  const renderRoleBadge = (r: string) => {
    const roleLower = (r || '').toLowerCase();
    let badgeClass = 'bg-zinc-100 dark:bg-white/10 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/10';
    if (roleLower === 'admin') {
      badgeClass = 'dark:bg-amber-500/20 bg-amber-500/10 dark:text-amber-300 text-amber-700 border border-amber-500/40';
    } else if (roleLower === 'manager') {
      badgeClass = 'dark:bg-purple-500/20 bg-purple-500/10 dark:text-purple-300 text-purple-700 border border-purple-500/40';
    } else if (roleLower === 'receptionist') {
      badgeClass = 'dark:bg-blue-500/20 bg-blue-500/10 dark:text-blue-300 text-blue-700 border border-blue-500/40';
    } else if (roleLower === 'bartender') {
      badgeClass = 'dark:bg-emerald-500/20 bg-emerald-500/10 dark:text-emerald-300 text-emerald-700 border border-emerald-500/40';
    } else if (roleLower === 'chef') {
      badgeClass = 'dark:bg-orange-500/20 bg-orange-500/10 dark:text-orange-300 text-orange-700 border border-orange-500/40';
    } else if (roleLower === 'waiter' || roleLower === 'server') {
      badgeClass = 'dark:bg-teal-500/20 bg-teal-500/10 dark:text-teal-300 text-teal-700 border border-teal-500/40';
    }
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${badgeClass}`}>
        {r}
      </span>
    );
  };

  const formatLastLogin = (lastLogin?: string) => {
    if (!lastLogin) {
      return (
        <div className="text-zinc-400 dark:text-zinc-500 italic text-[11px] h-7 flex items-center">
          Never
        </div>
      );
    }
    const d = new Date(lastLogin);
    return (
      <div className="font-mono text-xs leading-tight h-7 flex flex-col justify-center">
        <span className="text-zinc-800 dark:text-zinc-200 block text-[11px] font-semibold">{d.toLocaleDateString()}</span>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    );
  };

  const filteredUsers = users.filter(u => {
    if (selectedRole !== 'ALL') {
      const uRole = (u.role || '').toLowerCase();
      const target = selectedRole.toLowerCase();
      if (target === 'waiter') {
        if (uRole !== 'waiter' && uRole !== 'server') return false;
      } else if (uRole !== target) {
        return false;
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = u.fullName.toLowerCase().includes(q);
      const matchCode = u.username.toLowerCase().includes(q);
      const matchRole = u.role.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchRole) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-3">
      {/* Section Header & Subtitle + Integrated KPI Stat Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h2 className="text-base font-extrabold text-zinc-900 dark:text-white leading-tight">Staff Directory & Access Control</h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Manage employee credentials, shift roles, and terminal access permissions</p>
        </div>

        {/* Compact KPI Stats Pills */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="bg-white dark:bg-[#18181A] border border-zinc-200 dark:border-white/10 rounded-lg px-2.5 py-1 flex items-center gap-1.5 shadow-2xs">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Total</span>
            <span className="text-xs font-black text-zinc-900 dark:text-white">{totalStaff}</span>
          </div>
          <div className="bg-white dark:bg-[#18181A] border border-zinc-200 dark:border-white/10 rounded-lg px-2.5 py-1 flex items-center gap-1.5 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Active</span>
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{activeStaff}</span>
          </div>
          <div className="bg-white dark:bg-[#18181A] border border-zinc-200 dark:border-white/10 rounded-lg px-2.5 py-1 flex items-center gap-1.5 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Inactive</span>
            <span className="text-xs font-black text-rose-600 dark:text-rose-400">{inactiveStaff}</span>
          </div>
        </div>
      </div>

      {/* Role Filter Navigation Tabs (matching AdminNavTabs design system, neat & compact) */}
      <div className="glass-panel p-1 sm:p-1.5 rounded-xl flex flex-nowrap overflow-x-auto no-scrollbar gap-1 sm:gap-1.5">
        {ROLE_TABS_CONFIG.map(t => {
          const Icon = t.icon;
          const count = getRoleCount(t.id);
          const isSelected = selectedRole === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSelectedRole(t.id)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] transition-all premium-tab-secondary shrink-0 whitespace-nowrap active:scale-95 rounded-lg ${
                isSelected ? 'active' : ''
              }`}
            >
              <div className="nav-icon-badge">
                <Icon size={12} />
              </div>
              <span className="font-bold tracking-wider">{t.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ml-0.5 transition-colors ${
                isSelected 
                  ? 'bg-primary/20 text-primary dark:bg-[#D4AF37]/30 dark:text-[#D4AF37]' 
                  : 'bg-zinc-200/70 dark:bg-white/10 text-zinc-600 dark:text-zinc-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Top Action Bar (Search & Add Staff) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none" size={13} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search staff members..."
            className="w-full bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-lg pl-8 pr-8 py-1 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none dark:focus:border-[#D4AF37] focus:border-primary transition-colors h-[32px]"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white p-0.5 rounded-md transition-colors cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 justify-end w-auto">
          {isAdmin ? (
            <button
              onClick={handleOpenCreate}
              className="px-3 h-[32px] rounded-lg primary-btn text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer active:scale-95"
            >
              <UserPlus size={13} className="shrink-0" />
              <span>Add Staff</span>
            </button>
          ) : (
            <span className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 text-[10px] font-bold">
              View Only
            </span>
          )}
        </div>
      </div>

      {/* Staff User Directory Table */}
      <div className="bg-white dark:bg-[#18181A] rounded-xl border border-zinc-200 dark:border-white/10 shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table aria-label="Staff user directory" className="w-full text-left text-xs min-w-[700px]">
            <thead className="border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#151518] text-zinc-500 dark:text-zinc-400 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th scope="col" className="py-2 px-3 sticky left-0 bg-zinc-50 dark:bg-[#151518] z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] align-middle">Employee Code</th>
                <th scope="col" className="py-2 px-3 align-middle">Full Name</th>
                <th scope="col" className="py-2 px-3 align-middle">Shift Role</th>
                <th scope="col" className="py-2 px-3 align-middle">Status</th>
                <th scope="col" className="py-2 px-3 align-middle">Last Login</th>
                <th scope="col" className="py-2 px-3 text-right align-middle">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="animate-pulse">
                    <td className="py-2 px-3 sticky left-0 bg-white dark:bg-[#18181A] align-middle">
                      <div className="h-3.5 w-16 rounded bg-zinc-200 dark:bg-white/10" />
                    </td>
                    <td className="py-2 px-3 align-middle">
                      <div className="h-3.5 w-28 rounded bg-zinc-200 dark:bg-white/10" />
                    </td>
                    <td className="py-2 px-3 align-middle">
                      <div className="h-4 w-18 rounded-full bg-zinc-200 dark:bg-white/10" />
                    </td>
                    <td className="py-2 px-3 align-middle">
                      <div className="h-4 w-14 rounded-full bg-zinc-200 dark:bg-white/10" />
                    </td>
                    <td className="py-2 px-3 align-middle">
                      <div className="h-3.5 w-24 rounded bg-zinc-200 dark:bg-white/10" />
                    </td>
                    <td className="py-2 px-3 text-right align-middle">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="h-7 w-12 rounded-lg bg-zinc-200 dark:bg-white/10" />
                        <div className="h-7 w-[86px] rounded-lg bg-zinc-200 dark:bg-white/10" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center">
                    <div className="sticky left-0 max-w-sm mx-auto px-4">
                      <Users className="w-7 h-7 mx-auto text-zinc-400 dark:text-zinc-500 mb-1.5" />
                      {users.length === 0 ? (
                        <>
                          <p className="text-xs font-bold text-zinc-700 dark:text-zinc-200">No staff members registered yet</p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Add your first staff member to manage access and shift roles.</p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-bold text-zinc-700 dark:text-zinc-200">No staff members found matching criteria</p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Try adjusting your search query or role filter.</p>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map(u => (
                  <tr key={u.id} className="group hover:bg-zinc-50/80 dark:hover:bg-white/[0.03] transition-colors">
                    <td className="py-2 px-3 font-mono font-bold dark:text-[#D4AF37] text-primary sticky left-0 bg-white group-hover:bg-zinc-50/80 dark:bg-[#18181A] dark:group-hover:bg-[#18181A] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] align-middle">
                      {u.username}
                    </td>
                    <td className="py-2 px-3 font-semibold text-zinc-900 dark:text-white align-middle">{u.fullName}</td>
                    <td className="py-2 px-3 align-middle">
                      {renderRoleBadge(u.role)}
                    </td>
                    <td className="py-2 px-3 align-middle">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center ${
                        u.isActive ? 'badge-active' : 'dark:bg-red-500/20 bg-red-500/10 dark:text-red-400 text-red-700 border border-red-500/30'
                      }`}>
                        {u.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="py-2 px-3 align-middle">
                      {formatLastLogin(u.lastLogin)}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap align-middle">
                      {isAdmin ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            title={`Edit ${u.fullName}`}
                            className="px-2.5 py-1 h-[28px] rounded-lg text-[11px] font-bold border border-zinc-200 dark:border-white/10 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900 dark:bg-white/5 dark:hover:bg-white/10 dark:text-zinc-300 dark:hover:text-white transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-[#D4AF37]/20 inline-flex items-center gap-1 active:scale-95"
                          >
                            <Edit2 size={11} className="shrink-0" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => {
                              if (u.isActive) {
                                setUserToDeactivate(u);
                              } else {
                                handleToggleStatus(u);
                              }
                            }}
                            className={`px-2.5 py-1 h-[28px] w-[86px] rounded-lg text-[11px] font-bold border transition-all cursor-pointer focus:outline-none focus:ring-2 inline-flex items-center justify-center gap-1 active:scale-95 ${
                              u.isActive
                                ? 'bg-rose-50 text-rose-700 border-rose-200/80 hover:bg-rose-100 hover:text-rose-800 hover:border-rose-300 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/40 dark:hover:bg-rose-900/40 dark:hover:text-rose-300 dark:hover:border-rose-700/60 focus:ring-rose-500/20'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100 hover:text-emerald-800 hover:border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40 dark:hover:bg-emerald-900/40 dark:hover:text-emerald-300 dark:hover:border-emerald-700/60 focus:ring-emerald-500/20'
                            }`}
                          >
                            {u.isActive ? (
                              <>
                                <UserX size={11} className="shrink-0 text-rose-600 dark:text-rose-400" />
                                <span>Deactivate</span>
                              </>
                            ) : (
                              <>
                                <UserCheck size={11} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                                <span>Activate</span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">Read Only</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination / Summary Strip */}
        <div className="px-3 py-2 border-t border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.02] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <span className="text-zinc-500 dark:text-zinc-400 text-center sm:text-left text-[11px]">
            Showing {filteredUsers.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length} staff
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-0.5 h-[28px] rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-zinc-50 dark:hover:bg-white/10 text-zinc-900 dark:text-white text-xs font-semibold flex items-center justify-center cursor-pointer"
              >
                Prev
              </button>
              <div className="flex items-center px-2 text-zinc-900 dark:text-white font-semibold h-[28px] text-xs">
                Page {currentPage} of {totalPages}
              </div>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-0.5 h-[28px] rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-zinc-50 dark:hover:bg-white/10 text-zinc-900 dark:text-white text-xs font-semibold flex items-center justify-center cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DEACTIVATE CONFIRMATION MODAL */}
      {userToDeactivate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="deactivate-dialog-title"
          onClick={() => setUserToDeactivate(null)}
          className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer animate-fadeIn"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-[#18181A] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 max-w-sm w-full relative text-zinc-900 dark:text-white shadow-2xl cursor-default space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 id="deactivate-dialog-title" className="font-bold text-sm text-zinc-900 dark:text-white">
                  Deactivate Staff Member?
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Immediate terminal lockout
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Are you sure you want to deactivate <strong className="text-zinc-900 dark:text-white">{userToDeactivate.fullName}</strong> ({userToDeactivate.username})? They will be immediately prevented from logging into shift operations.
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setUserToDeactivate(null)}
                className="flex-1 py-2.5 min-h-[38px] rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeactivate}
                className="flex-1 py-2.5 min-h-[38px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center justify-center active:scale-95"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {userToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          onClick={() => setUserToDelete(null)}
          className="fixed inset-0 z-60 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer animate-fadeIn"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-[#18181A] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 max-w-sm w-full relative text-zinc-900 dark:text-white shadow-2xl cursor-default space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 id="delete-dialog-title" className="font-bold text-sm text-zinc-900 dark:text-white">
                  Delete Staff Member?
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                  Permanent database deletion
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-zinc-900 dark:text-white">{userToDelete.fullName}</strong> (<span className="font-mono text-[11px] font-bold">{userToDelete.username}</span>)? This action is irreversible and reflects in the database immediately.
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 min-h-[38px] rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 min-h-[38px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                {isDeleting ? (
                  <span>Deleting...</span>
                ) : (
                  <>
                    <Trash2 size={13} className="shrink-0" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REGISTER / EDIT STAFF DRAWER */}
      {isDrawerOpen && (
        <div 
          onClick={handleCloseDrawer}
          className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs flex items-center justify-end p-0 cursor-pointer animate-fadeIn"
        >
          <div 
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-[#111114] border-l border-zinc-200 dark:border-white/10 p-5 w-full md:w-[380px] relative text-zinc-900 dark:text-white h-[100dvh] flex flex-col cursor-default shadow-xl"
          >
            <div className="flex items-center justify-between pb-4 dark:pb-5 border-b border-zinc-200 dark:border-white/10 shrink-0">
              <h3 id="drawer-title" className="flex items-center gap-2 text-zinc-900 dark:text-white font-bold text-sm">
                {isEditing ? (
                  <>
                    <Edit2 size={18} className="shrink-0 text-primary dark:text-[#D4AF37]" />
                    <span>Edit Staff Member — <span className="font-mono text-xs">{editingUser?.username}</span></span>
                  </>
                ) : (
                  <>
                    <UserPlus size={18} className="shrink-0 text-primary dark:text-[#D4AF37]" />
                    <span>Register New Staff Member</span>
                  </>
                )}
              </h3>
              <button 
                aria-label="Close"
                onClick={handleCloseDrawer}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-5 space-y-4 no-scrollbar">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="staff-role-select" className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Shift Role</label>
                  <select
                    id="staff-role-select"
                    value={role}
                    onChange={e => handleRoleChange(e.target.value as UserRole)}
                    className="w-full bg-zinc-50 dark:bg-[#18181A] border border-zinc-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none dark:focus:border-[#D4AF37] focus:border-primary transition-colors cursor-pointer"
                  >
                    <option value="admin">Administrator (ADM)</option>
                    <option value="manager">Manager (MGR)</option>
                    <option value="receptionist">Receptionist (REC)</option>
                    <option value="bartender">Bartender (BAR)</option>
                    <option value="chef">Kitchen Chef (CHF)</option>
                    <option value="waiter">Waiter / Server (WTR)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="staff-full-name-input" className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Full Name</label>
                  <input
                    id="staff-full-name-input"
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Staff Name"
                    className="w-full bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none dark:focus:border-[#D4AF37] focus:border-primary transition-colors"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="staff-username-input" className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Employee Code Username <span className="text-zinc-400 dark:text-zinc-500 font-normal">(Pattern: {expectedPrefix}-XX)</span>
                  </label>
                  <input
                    id="staff-username-input"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value.toUpperCase())}
                    placeholder={`e.g. ${expectedPrefix}-01`}
                    className={`w-full bg-zinc-50 dark:bg-white/5 border rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-white font-mono focus:outline-none dark:focus:border-[#D4AF37] focus:border-primary transition-colors ${
                      username.trim() && (!isUsernameValid || isDuplicate) ? 'border-red-500/50 focus:border-red-500' : 'border-zinc-200 dark:border-white/10'
                    }`}
                    required
                  />
                  {username.trim() && !isUsernameValid && (
                    <p role="alert" aria-live="polite" className="text-[10px] dark:text-red-400 text-red-700 mt-1 font-medium">
                      Invalid format. Expected pattern: <strong className="font-bold">{expectedPrefix}-XX</strong> (e.g., {expectedPrefix}-01, {expectedPrefix}-02)
                    </p>
                  )}
                  {username.trim() && isUsernameValid && isDuplicate && (
                    <p role="alert" aria-live="polite" className="text-[10px] dark:text-red-400 text-red-700 mt-1 font-medium">
                      Duplicate code. The employee username <strong className="font-bold">{username}</strong> is already taken by another account.
                    </p>
                  )}
                  {username.trim() && isUsernameValid && !isDuplicate && (
                    <p aria-live="polite" className="text-[10px] dark:text-emerald-400 text-emerald-700 mt-1 font-medium">
                      ✓ Employee code is valid and available.
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="staff-pin-input" className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    4-Digit Access PIN {isEditing ? <span className="text-zinc-400 dark:text-zinc-500 font-normal">(Optional — leave blank to keep existing)</span> : <span className="text-zinc-400 dark:text-zinc-500 font-normal">(Numeric only)</span>}
                  </label>
                  <div className="relative">
                    <input
                      id="staff-pin-input"
                      type={showPin ? "text" : "password"}
                      value={pin}
                      onChange={e => setPin(e.target.value)}
                      maxLength={4}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={isEditing ? "Leave blank to keep current PIN" : "e.g. 1234"}
                      className={`w-full bg-zinc-50 dark:bg-white/5 border rounded-xl pl-3 pr-10 py-2 text-xs text-zinc-900 dark:text-white font-mono focus:outline-none dark:focus:border-[#D4AF37] focus:border-primary transition-colors ${
                        pin.trim() && !isPinValid ? 'border-red-500/50 focus:border-red-500' : 'border-zinc-200 dark:border-white/10'
                      }`}
                      required={!isEditing}
                    />
                    <button
                      type="button"
                      aria-label={showPin ? "Hide PIN" : "Show PIN"}
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg cursor-pointer transition-colors"
                    >
                      {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {pin.trim() && !isPinValid && (
                    <p role="alert" aria-live="polite" className="text-[10px] dark:text-red-400 text-red-700 mt-1 font-medium">
                      PIN must be exactly 4 numeric characters.
                    </p>
                  )}
                  {isEditing && !pin.trim() && (
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
                      Existing credentials will be preserved. Only enter a PIN if you want to reset access.
                    </p>
                  )}
                </div>

                {isEditing && (
                  <div className="pt-3 border-t border-zinc-200 dark:border-white/10 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      Danger Zone
                    </p>
                    {isMainAdmin(editingUser) ? (
                      <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-medium flex items-center gap-2">
                        <Shield size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>Primary administrator account is protected and cannot be deleted.</span>
                      </div>
                    ) : user?.id === editingUser?.id ? (
                      <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-medium flex items-center gap-2">
                        <Shield size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>You cannot delete your own logged-in account.</span>
                      </div>
                    ) : (
                      <div className="p-2.5 sm:p-3 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 space-y-2">
                        <div>
                          <p className="text-xs font-bold text-rose-700 dark:text-rose-400">Delete Staff Member</p>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Permanently remove employee credentials and record from database</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUserToDelete(editingUser)}
                          className="w-full py-2 min-h-[34px] rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <Trash2 size={13} className="shrink-0" />
                          <span>Delete Staff Member</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-row gap-3 pt-4 border-t border-zinc-200 dark:border-white/10 shrink-0">
                  <button
                    type="button"
                    onClick={handleCloseDrawer}
                    className="flex-1 py-2.5 min-h-[38px] rounded-xl bg-transparent border border-zinc-200 dark:border-white/10 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !isFormValid}
                    title={isSubmitting ? (isEditing ? "Saving..." : "Registering...") : !isFormValid ? "Fill all required fields" : undefined}
                    className="flex-1 py-2.5 min-h-[38px] rounded-xl primary-btn text-xs font-bold uppercase tracking-wider disabled:opacity-50 cursor-pointer dark:text-black flex items-center justify-center"
                  >
                    {isSubmitting ? (isEditing ? 'Saving...' : 'Registering...') : (isEditing ? 'Save Changes' : 'Confirm')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
 </div>
 );
};

