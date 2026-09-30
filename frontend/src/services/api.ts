import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const DEPLOYED_API_BASE_URL = 'https://api.nfc-qr.app.cloudshiftsolutions.in/api';

export const getLocalApiBaseUrl = (): string => {
  if (Platform.OS === 'android') {
    // Android emulator host loopback or LAN IP
    return 'http://10.0.2.2:4000/api';
  }
  return 'http://localhost:4000/api';
};

class ApiService {
  private activeBaseUrl: string | null = null;

  public async getBaseUrl(): Promise<string> {
    if (this.activeBaseUrl) return this.activeBaseUrl;
    const stored = await AsyncStorage.getItem('@bar_custom_api_url');
    if (stored) {
      this.activeBaseUrl = stored;
      return stored;
    }
    // Default to local/deployed
    this.activeBaseUrl = getLocalApiBaseUrl();
    return this.activeBaseUrl;
  }

  public async setBaseUrl(url: string) {
    this.activeBaseUrl = url;
    await AsyncStorage.setItem('@bar_custom_api_url', url);
  }

  public async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem('@bar_auth_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const baseUrl = await this.getBaseUrl();
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (networkErr: any) {
      // Friendly wording
      throw new Error('Connection failed. Please check your internet connection.');
    }

    const data = await response.json().catch(() => ({}));

    if (response.status === 401 || (response.status === 403 && data?.error?.code === 'AUTH_002')) {
      await AsyncStorage.removeItem('@bar_auth_token');
      await AsyncStorage.removeItem('@bar_auth_user');
      throw new Error('Your session has expired. Please log in again.');
    }

    if (!response.ok) {
      const errMsg = data.message || 
                     (data.error && typeof data.error === 'object' ? data.error.message : data.error) || 
                     'Something went wrong. Please try again.';
      throw new Error(errMsg);
    }

    return data;
  }

  // --- Auth APIs ---
  async login(username: string, pin: string) {
    let userStr = username.toLowerCase().trim();
    let pinStr = pin.trim();

    if (userStr === 'rec-01' || userStr === 'rec') {
      userStr = 'receptionist';
      pinStr = 'recep123';
    } else if (userStr === 'bar-02' || userStr === 'bar') {
      userStr = 'bartender';
      pinStr = 'bar123';
    } else if (userStr === 'adm-03' || userStr === 'adm' || userStr === 'admin') {
      userStr = 'admin';
      pinStr = 'admin123';
    } else if (userStr === 'mgr-04' || userStr === 'mgr' || userStr === 'manager') {
      userStr = 'manager';
      pinStr = 'manager123';
    } else if (userStr === 'chf-05' || userStr === 'chf' || userStr === 'chef') {
      userStr = 'chef';
      pinStr = 'chef123';
    } else if (userStr === 'wtr-06' || userStr === 'wtr' || userStr === 'waiter') {
      userStr = 'waiter';
      pinStr = 'waiter123';
    }

    const res = await this.request<{
      success: boolean;
      token: string;
      user: any;
      message?: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: userStr,
        password: pinStr,
      }),
    });

    if (res.token) {
      await AsyncStorage.setItem('@bar_auth_token', res.token);
      await AsyncStorage.setItem('@bar_auth_user', JSON.stringify(res.user));
    }

    return res;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      await AsyncStorage.removeItem('@bar_auth_token');
      await AsyncStorage.removeItem('@bar_auth_user');
    }
  }

  async getMe() {
    return await this.request<any>('/auth/me');
  }

  async getUsers() {
    return await this.request<any[]>('/users');
  }

  // --- Customer Access APIs ---
  async validateCustomerAccess(tokenNumber: string) {
    return await this.request<{
      authorized: boolean;
      session?: any;
      paymentStatus?: string;
      sessionStatus?: string;
      bill?: any;
      error?: string;
    }>(`/check-in/verify-qr/${encodeURIComponent(tokenNumber)}`);
  }

  async recoverCustomerSession(params: { accessCode?: string; phoneNumber?: string }) {
    return await this.request<{
      tokenNumber?: string;
      error?: string;
    }>('/check-in/recover-session', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // --- Menu APIs ---
  async getMenu(includeUnavailable: boolean = false) {
    const query = includeUnavailable ? '?includeUnavailable=true' : '';
    return await this.request<any[]>(`/menu${query}`);
  }

  async updateMenuItemAvailability(itemId: string, isAvailable: boolean) {
    return await this.request<any>(`/menu/items/${itemId}/availability`, {
      method: 'POST',
      body: JSON.stringify({ isAvailable }),
    });
  }

  // --- Order APIs ---
  async createOrder(payload: {
    tokenNumber: string;
    items: Array<{
      menuItemId: string;
      variantId?: string | null;
      quantity: number;
      specialInstructions?: string;
      selectedModifiers?: Array<{
        groupId: string;
        groupName: string;
        optionId: string;
        optionName: string;
        priceDelta: number;
      }>;
    }>;
    notes?: string;
  }) {
    return await this.request<any>('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getActiveOrders(tokenNumber?: string) {
    const query = tokenNumber ? `?tokenNumber=${encodeURIComponent(tokenNumber)}` : '';
    return await this.request<any[]>(`/orders/active${query}`);
  }

  async getOrderHistory(tokenNumber?: string) {
    const query = tokenNumber ? `?tokenNumber=${encodeURIComponent(tokenNumber)}` : '';
    return await this.request<any[]>(`/orders/history${query}`);
  }

  async cancelOrderItem(orderItemId: string) {
    return await this.request<any>(`/orders/items/${orderItemId}/cancel`, {
      method: 'POST',
    });
  }

  async getKdsOrders(station: 'KITCHEN' | 'BAR') {
    return await this.request<any>(`/kds/orders/${station.toLowerCase()}`);
  }

  async updateOrderItemStatus(orderItemId: string, status: string, staffId?: string) {
    return await this.request<any>(`/orders/items/${orderItemId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, staffId }),
    });
  }

  async getReadyItems() {
    return await this.request<any[]>('/staff/ready');
  }

  // --- Billing APIs ---
  async getBillCalculation(tokenNumber: string) {
    return await this.request<any>('/bills/calculate', {
      method: 'POST',
      body: JSON.stringify({ tokenNumber }),
    });
  }

  async requestBill(tokenNumber: string) {
    return await this.request<any>('/bills/request', {
      method: 'POST',
      body: JSON.stringify({ tokenNumber }),
    });
  }

  async reopenOrdering(tableId: string) {
    return await this.request<any>('/bills/reopen-ordering', {
      method: 'POST',
      body: JSON.stringify({ tableId }),
    });
  }

  async settleBill(payload: {
    tableId?: string;
    tokenId?: string;
    tokenNumber?: string;
    paymentMethod: 'CASH' | 'CARD' | 'UPI' | 'SPLIT';
    splitDetails?: any;
    discountType?: 'PERCENTAGE' | 'FLAT' | 'NONE';
    discountValue?: number;
    notes?: string;
  }) {
    return await this.request<any>('/bills/settle', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getActiveBills() {
    return await this.request<any[]>('/bills/active');
  }

  async getSettledBills() {
    return await this.request<any[]>('/bills/settled');
  }

  // --- Service Request APIs ---
  async createServiceRequest(payload: {
    tokenNumber: string;
    tableId?: string;
    type: string;
    note?: string;
  }) {
    return await this.request<{
      id: string;
      isDuplicate?: boolean;
      alreadyActive?: boolean;
      message?: string;
      [key: string]: any;
    }>('/service-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getActiveServiceRequests() {
    return await this.request<any[]>('/service-requests');
  }

  async updateServiceRequestStatus(id: string, status: 'ACKNOWLEDGED' | 'COMPLETED' | 'CANCELLED') {
    return await this.request<any>(`/service-requests/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // --- Table APIs ---
  async getTables() {
    return await this.request<any[]>('/tables');
  }

  async getReservations() {
    return await this.request<any[]>('/reservations');
  }

  async lockTable(tableId: string, lockedBy: string, userId?: string) {
    return await this.request<any>(`/tables/${tableId}/lock`, {
      method: 'POST',
      body: JSON.stringify({ lockedBy, userId }),
    });
  }

  async unlockTable(tableId: string, unlockedBy: string) {
    return await this.request<any>(`/tables/${tableId}/unlock`, {
      method: 'POST',
      body: JSON.stringify({ unlockedBy }),
    });
  }

  async assignTable(payload: {
    tableId: string;
    tokenId: string;
    assignedBy?: string;
  }) {
    return await this.request<any>('/tables/assign', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async releaseTable(tableId: string, reason?: string) {
    return await this.request<any>(`/tables/${tableId}/release`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  }

  async extendToken(tokenId: string, extensionMinutes: number) {
    return await this.request<any>(`/tokens/${tokenId}/extend`, {
      method: 'POST',
      body: JSON.stringify({ extensionMinutes }),
    });
  }

  async createToken(payload: any) {
    return await this.request<any>('/tokens/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async createPendingToken(payload: any) {
    return await this.request<any>('/check-in/pending', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async activatePendingToken(tokenNumber: string, tableNumber: string, amountPaid: number) {
    return await this.request<any>('/check-in/activate', {
      method: 'POST',
      body: JSON.stringify({ tokenNumber, tableNumber, amountPaid }),
    });
  }

  async cancelPendingToken(tokenNumber: string, reason?: string) {
    return await this.request<any>('/check-in/cancel', {
      method: 'POST',
      body: JSON.stringify({ tokenNumber, reason }),
    });
  }

  // --- Facial Attendance Kiosk Proxy ---
  async quickAttendance(formData: FormData) {
    const baseUrl = await this.getBaseUrl();
    const token = await this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${baseUrl}/attendance/quick`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Facial verification failed. Please try again.');
    }
    return data;
  }
}

export const api = new ApiService();
export default api;
