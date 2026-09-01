import { OrderStatus, Station, ServiceRequestStatus, ServiceRequestType } from '@prisma/client';

export type SocketRole = 'Admin' | 'Manager' | 'Receptionist' | 'Bartender' | 'Server' | 'Chef' | 'Customer';

export interface StaffSocketUser {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
}

export interface CustomerSocketSession {
  tokenId: string;
  tokenNumber: string;
  tableId: string;
  tableNumber?: string;
  customerId: string;
}

export interface SocketAuthData {
  type: 'STAFF' | 'CUSTOMER';
  staffUser?: StaffSocketUser;
  customerSession?: CustomerSocketSession;
}

// Payload Types
export interface OrderCreatedPayload {
  orderId: string;
  orderNumber: number;
  tokenNumber: string;
  tableId: string;
  tableNumber: string;
  orderSource: string;
  handlerId?: string | null;
  items: Array<{
    id: string;
    menuItemId: string;
    itemName: string;
    variantName?: string | null;
    selectedModifiers?: any;
    specialInstructions?: string | null;
    quantity: number;
    unitPrice: number | string;
    lineTotal: number | string;
    station: Station;
    status: OrderStatus;
    foodType?: string | null;
  }>;
  subtotal: number | string;
  placedAt: string;
}

export interface OrderItemUpdatedPayload {
  orderId: string;
  orderItemId: string;
  orderNumber: number;
  tokenNumber: string;
  tableId: string;
  tableNumber?: string;
  station: Station;
  itemName: string;
  variantName?: string | null;
  selectedModifiers?: any;
  specialInstructions?: string | null;
  quantity: number;
  previousStatus?: OrderStatus;
  status: OrderStatus;
  preparedAt?: string | null;
  readyAt?: string | null;
  servedAt?: string | null;
  updatedAt: string;
}

export interface ServiceRequestCreatedPayload {
  id: string;
  tokenId: string;
  tokenNumber: string;
  tableId: string;
  tableNumber: string;
  type: ServiceRequestType;
  note?: string | null;
  status: ServiceRequestStatus;
  createdAt: string;
}

export interface ServiceRequestUpdatedPayload {
  id: string;
  tokenId: string;
  tokenNumber: string;
  tableId: string;
  tableNumber: string;
  type: ServiceRequestType;
  status: ServiceRequestStatus;
  assignedStaffId?: string | null;
  assignedStaffName?: string | null;
  acknowledgedAt?: string | null;
  completedAt?: string | null;
  updatedAt: string;
}

export interface TableUpdatedPayload {
  tableId: string;
  tableNumber: string;
  status: string;
  currentTokenId?: string | null;
  occupiedSince?: string | null;
  updatedAt: string;
}

export interface BillUpdatedPayload {
  billId: string;
  billNumber: string;
  tokenId: string;
  tokenNumber: string;
  tableId: string;
  grandTotal: number | string;
  status: string;
  paymentMethod: string;
  paidAt: string;
}

export interface SessionUpdatedPayload {
  tokenId: string;
  tokenNumber: string;
  tableId?: string | null;
  status: string;
  updatedAt: string;
}
