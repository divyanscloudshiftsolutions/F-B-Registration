/**
 * Centralized Dictionary of Socket.io Real-Time Event Names
 */
export const SOCKET_EVENTS = {
  // Order & Item events
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_ITEM_UPDATED: 'order.item.updated',
  KDS_UPDATED: 'kds.updated',

  // Service Request events
  SERVICE_REQUEST_CREATED: 'service_request.created',
  SERVICE_REQUEST_UPDATED: 'service_request.updated',

  // Floor & Billing events
  TABLE_UPDATED: 'table.updated',
  TABLE_SESSION_ACTIVATED: 'table.session.activated',
  TABLE_SESSION_CLOSED: 'table.session.closed',
  BILL_UPDATED: 'bill.updated',
  SESSION_UPDATED: 'session.updated',

  // Room Subscription events
  JOIN_ROOM: 'room:join',
  LEAVE_ROOM: 'room:leave',
} as const;

export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
