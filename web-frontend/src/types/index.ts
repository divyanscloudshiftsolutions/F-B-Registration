export type UserRole = 'admin' | 'receptionist' | 'bartender' | 'manager' | 'chef' | 'waiter' | 'server';

export const UserRole = {
  ADMIN: 'admin' as UserRole,
  RECEPTIONIST: 'receptionist' as UserRole,
  BARTENDER: 'bartender' as UserRole,
  MANAGER: 'manager' as UserRole,
  CHEF: 'chef' as UserRole,
  WAITER: 'waiter' as UserRole,
  SERVER: 'server' as UserRole,
};

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  phoneNumber: string;
  name: string;
  email?: string;
  totalVisits: number;
  lastVisit?: string;
}

export interface PlaceTypeConfig {
  id: string;
  name: string;
  ratePerPerson: number;
  baseTimeMinutes: number;
  redemptionsPerPerson: number;
  isActive: boolean;
}

export interface Table {
  id: string;
  tableNumber: string;
  placeTypeId: string;
  placeType?: any;
  categoryName?: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance' | 'in_checkin';
  currentTokenId?: string;
  occupiedSince?: string;
  lastAssignedAt?: string;
  isActive: boolean;
  lockedBy?: string | null;
  lockedByRole?: string | null;
  lockedAt?: number | string | null;
  isBillRequested?: boolean;
  activeSession?: any;
  bill?: any;
}

export interface Token {
  id: string;
  tokenNumber: string;
  customerId: string;
  customer?: Customer;
  personsCount: number;
  placeTypeId: string;
  placeType?: PlaceTypeConfig;
  tableId?: string;
  table?: Table;
  amountPaid: number;
  paymentVerified: boolean;
  startTime: string;
  endTime: string;
  totalRedemptionsAllowed: number;
  redemptionsUsed: number;
  currentCheckInEntitlement?: number;
  carriedForwardBalance?: number;
  status: 'PENDING_PAYMENT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED' | 'EXPIRED' | 'EXTENDED';
  issuedBy: string;
  deliveryMode: 'NFC_CARD' | 'EMAIL_QR';
  emailSent?: boolean;
  emailDeliveryStatus?: string;
  tableNumber?: string;
  createdAt?: string;
  expiresAt?: string;
}

export interface Redemption {
  id: string;
  tokenId: string;
  redemptionSequence: number;
  redeemedAt: string;
  bartenderId: string;
  notes?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface DashboardReport {
  success: boolean;
  data: {
    salesSummary: {
      todaySales: number;
      todayRedemptions: number;
      totalCustomers: number;
      checkoutCount: number;
      period: {
        startDate: string;
        endDate: string;
      };
    };
    tableUtilization: {
      period: {
        start: string;
        end: string;
      };
      tables: Array<{
        tableNumber: string;
        placeType: string;
        totalOccupancyHours: number;
        averageOccupancyPerDay: number;
        turnoverCount: number;
        averageSessionDurationMinutes: number;
      }>;
      summary: {
        totalTableHours: number;
        averageOccupancyRate: number;
      };
    };
    hourlyBreakdown: {
      date: string;
      hourlyData: Array<{
        hour: number;
        redemptions: number;
        newTokens: number;
        activeTokens: number;
        revenue?: number;
      }>;
      peakHour: number;
      peakRedemptions: number;
    };
  };
}

export interface SessionAlert {
  id: string;
  tokenId: string;
  tableNumber: string;
  customerName: string;
  remainingMinutes: number;
  message: string;
  type?: 'warning' | 'urgent' | 'info' | 'danger';
  severity?: 'warning' | 'urgent' | 'info' | 'danger';
}

export type FoodType = 'VEG' | 'NON_VEG' | 'EGG' | 'VEGAN';
export type Station = 'KITCHEN' | 'BAR' | 'DESSERT' | 'CASHIER';
export type DiscountMode = 'AMOUNT' | 'PERCENTAGE';

export interface ItemVariant {
  id?: string;
  menuItemId?: string;
  name: string;
  priceDelta: number | string;
  sortOrder?: number;
}

export interface ModifierOption {
  id?: string;
  groupId?: string;
  name: string;
  priceDelta: number | string;
  sortOrder?: number;
}

export interface ModifierGroup {
  id?: string;
  menuItemId?: string;
  name: string;
  isRequired: boolean;
  isMulti: boolean;
  options: ModifierOption[];
}

export interface MenuSubcategory {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  sortOrder: number;
  items?: MenuItem[];
}

export interface MenuCategory {
  id: string;
  sectionId: string;
  name: string;
  slug: string;
  description?: string | null;
  sortOrder: number;
  section?: MenuSection;
  subcategories?: MenuSubcategory[];
  items?: MenuItem[];
}

export interface MenuSection {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  categories?: MenuCategory[];
  items?: MenuItem[];
}

export interface GstTaxTag {
  id: string;
  name: string;
  rate: number | string;
  isActive: boolean;
  createdAt?: string;
  _count?: {
    items: number;
  };
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  sectionId: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  gstTaxTagId?: string | null;
  gstTaxTag?: GstTaxTag | null;
  foodType?: FoodType | null;
  station: Station;
  image?: string | null;
  basePrice: number | string;
  discountMode: DiscountMode;
  discountValue: number | string;
  finalPrice: number | string;
  isAvailable: boolean;
  isFeatured: boolean;
  isPopular: boolean;
  isArchived?: boolean;
  tags: string[];
  allergens: string[];
  preparationTime: number;
  sortOrder: number;
  variants?: ItemVariant[];
  modifierGroups?: ModifierGroup[];
  category?: MenuCategory;
  subcategory?: MenuSubcategory;
}

export interface VenueConfig {
  id: string;
  gstEnabled: boolean;
  gstRate: number | string;
  scEnabled: boolean;
  scRate: number | string;
  roundingEnabled: boolean;
  updatedAt?: string;
  updatedBy?: string | null;
}
