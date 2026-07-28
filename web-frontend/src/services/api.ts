import type { User, Table, Token } from '../types';

const getBackendUrl = (): string => {
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  if (envUrl && envUrl.trim().length > 0) {
    let cleaned = envUrl.trim();
    while (cleaned.endsWith('/')) {
      cleaned = cleaned.slice(0, -1);
    }
    if (!cleaned.endsWith('/api')) {
      cleaned = `${cleaned}/api`;
    }
    return cleaned;
  }
  return 'https://api.nfc-qr.app.cloudshiftsolutions.in/api';
};

export const API_BASE_URL = getBackendUrl();

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('nfc_web_token');
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('nfc_web_token', token);
    } else {
      localStorage.removeItem('nfc_web_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.error?.message || data?.error?.detail || data?.message || `HTTP error ${response.status}`;
      throw new Error(errorMsg);
    }

    return data;
  }

  // Auth APIs
  async login(username: string, pin: string) {
    let apiUsername = username.trim();
    let apiPassword = pin.trim();

    const lowerId = username.trim().toLowerCase();
    if (lowerId === 'rec-01') {
      apiUsername = 'receptionist';
      apiPassword = 'recep123';
    } else if (lowerId === 'bar-02') {
      apiUsername = 'bartender';
      apiPassword = 'bar123';
    } else if (lowerId === 'adm-03') {
      apiUsername = 'admin';
      apiPassword = 'admin123';
    } else if (lowerId === 'mgr-04') {
      apiUsername = 'manager';
      apiPassword = 'manager123';
    }

    const data = await this.request<{ success: boolean; token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: apiUsername, password: apiPassword }),
    });

    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout network errors
    } finally {
      this.setToken(null);
    }
  }

  // User Administration APIs
  async getUsers(): Promise<User[]> {
    const res = await this.request<{ success: boolean; users: User[] }>('/users');
    return res.users || [];
  }

  async createUser(userData: { username: string; pin: string; fullName: string; role: string }) {
    return this.request<{ success: boolean; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUserStatus(userId: string, isActive: boolean) {
    return this.request<{ success: boolean }>(`/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  }

  // Tables APIs
  async getTables(): Promise<Table[]> {
    let rawTables: any[] = [];
    try {
      const res = await this.request<any>('/tables');
      if (Array.isArray(res)) {
        rawTables = res;
      } else if (res && Array.isArray(res.tables)) {
        rawTables = res.tables;
      } else if (res && res.success && res.data) {
        if (Array.isArray(res.data)) {
          rawTables = res.data;
        } else if (res.data.byPlaceType) {
          Object.keys(res.data.byPlaceType).forEach(key => {
            if (Array.isArray(res.data.byPlaceType[key]?.tables)) {
              rawTables.push(...res.data.byPlaceType[key].tables);
            }
          });
        }
      }
    } catch {
      // Fallback to /tables/occupancy endpoint if /tables returns empty
      try {
        const occRes = await this.request<any>('/tables/occupancy');
        if (occRes && occRes.success && occRes.data && occRes.data.byPlaceType) {
          Object.keys(occRes.data.byPlaceType).forEach(key => {
            const group = occRes.data.byPlaceType[key];
            if (Array.isArray(group?.tables)) {
              group.tables.forEach((t: any) => {
                t.placeType = key;
                rawTables.push(t);
              });
            }
          });
        }
      } catch {}
    }

    return rawTables.map(t => {
      let categoryName = 'Standard';
      if (typeof t.placeType === 'string') {
        categoryName = t.placeType.replace(/_/g, ' ');
      } else if (t.placeType && typeof t.placeType === 'object' && t.placeType.name) {
        categoryName = t.placeType.name;
      }

      return {
        id: t.id,
        tableNumber: t.tableNumber || t.number || `T-${t.id.slice(0, 4)}`,
        placeTypeId: t.placeTypeId || '',
        categoryName: categoryName,
        capacity: t.capacity || t.seats || 4,
        status: (t.status || 'available').toString().toLowerCase() as any,
        currentTokenId: t.currentTokenId || (t.currentToken ? t.currentToken.id : undefined),
        isActive: t.isActive !== false,
      };
    });
  }

  async createTable(tableData: { tableNumber: string; placeTypeId: string; capacity: number }) {
    return this.request<{ success: boolean; table: Table }>('/tables', {
      method: 'POST',
      body: JSON.stringify(tableData),
    });
  }

  async assignTable(tableId: string, tokenId: string) {
    return this.request<{ success: boolean }>('/tables/assign', {
      method: 'POST',
      body: JSON.stringify({ tableId, tokenId }),
    });
  }

  async releaseTable(tableId: string) {
    return this.request<{ success: boolean }>(`/tables/${tableId}/release`, {
      method: 'PUT',
    });
  }

  // Customer & Tokens APIs
  async getActiveTokens(): Promise<Token[]> {
    const res = await this.request<{ success: boolean; tokens: Token[] }>('/tokens/active');
    return res.tokens || [];
  }

  async createCustomerCheckIn(payload: {
    phoneNumber: string;
    customerName: string;
    email?: string;
    personsCount: number;
    placeTypeId: string;
    deliveryMode: 'NFC_CARD' | 'EMAIL_QR';
    cardUid?: string;
  }) {
    return this.request<{ success: boolean; token: Token; customer: any }>('/check-in', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async extendToken(tokenNumber: string, extraMinutes: number, additionalAmount: number) {
    return this.request<{ success: boolean }>(`/tokens/${tokenNumber}/extend`, {
      method: 'PUT',
      body: JSON.stringify({ extraMinutes, additionalAmount }),
    });
  }

  async closeToken(tokenNumber: string, reason = 'CHECKOUT') {
    return this.request<{ success: boolean }>(`/tokens/${tokenNumber}/close`, {
      method: 'PUT',
      body: JSON.stringify({ closeReason: reason }),
    });
  }

  // Drink Redemptions APIs
  async verifyQR(qrCodeData: string) {
    return this.request<{ success: boolean; token: Token; isVerified: boolean }>('/qr/verify', {
      method: 'POST',
      body: JSON.stringify({ qrCodeData }),
    });
  }

  async redeemDrink(payload: { tokenId?: string; cardUid?: string; notes?: string }) {
    return this.request<{ success: boolean; redemption: any; remainingRedemptions: number }>('/redemptions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async undoRedeem(tokenId: string) {
    return this.request<{ success: boolean }>('/token/redeem/undo', {
      method: 'POST',
      body: JSON.stringify({ tokenId }),
    });
  }

  // Delivery Config APIs
  async getDeliveryMode(): Promise<string> {
    const res = await this.request<{ success: boolean; mode: string }>('/config/delivery-mode');
    return res.mode || 'NFC_CARD';
  }

  async setDeliveryMode(mode: 'NFC_CARD' | 'EMAIL_QR' | 'BOTH'): Promise<void> {
    await this.request('/config/delivery-mode', {
      method: 'PUT',
      body: JSON.stringify({ mode }),
    });
  }

  // FaceMark Quick Attendance API
  async markQuickAttendance(photoBase64: string, employeeCode?: string) {
    return this.request<{
      success: boolean;
      action: 'check-in' | 'check-out';
      userId?: string;
      userName?: string;
      userEmail?: string;
      confidence?: number;
      timestamp?: string;
      message?: string;
      record?: any;
    }>('/attendance/quick', {
      method: 'POST',
      body: JSON.stringify({ photoBase64, employeeCode }),
    });
  }
}

export const api = new ApiService();
