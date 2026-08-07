import type { Token, NotificationItem } from '../types';

export const MOCK_KPIs = {
  activeSessions: 12,
  inHouseGuests: 36,
  occupiedTables: 8,
  totalTables: 24,
  totalCapacity: 96,
  drinksRedeemed: 24,
  totalDrinksAllowed: 72,
  revenue: 28400,
};

export const MOCK_TOKENS: Token[] = [
  {
    id: "mock-1",
    tokenNumber: "TKB-0104",
    customerId: "c-1",
    customer: {
      id: "c-1",
      name: "Aditya Sharma",
      phoneNumber: "+91 98765 43210",
      email: "aditya.sharma@gmail.com",
      totalVisits: 4
    },
    personsCount: 4,
    placeTypeId: "pt-1",
    placeType: {
      id: "pt-1",
      name: "Premium Lounge",
      ratePerPerson: 1500,
      baseTimeMinutes: 120,
      redemptionsPerPerson: 3,
      isActive: true
    },
    tableId: "tb-1",
    table: {
      id: "tb-1",
      tableNumber: "L-3",
      placeTypeId: "pt-1",
      capacity: 6,
      status: "occupied",
      isActive: true
    },
    amountPaid: 6000,
    paymentVerified: true,
    startTime: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 75 * 60 * 1000).toISOString(),
    totalRedemptionsAllowed: 12,
    redemptionsUsed: 4,
    status: "ACTIVE",
    issuedBy: "recep-01",
    deliveryMode: "EMAIL_QR"
  },
  {
    id: "mock-2",
    tokenNumber: "TKS-0218",
    customerId: "c-2",
    customer: {
      id: "c-2",
      name: "Pooja Hegde",
      phoneNumber: "+91 87654 32109",
      email: "pooja.hegde@yahoo.com",
      totalVisits: 12
    },
    personsCount: 2,
    placeTypeId: "pt-2",
    placeType: {
      id: "pt-2",
      name: "Standard Standing Bar",
      ratePerPerson: 800,
      baseTimeMinutes: 90,
      redemptionsPerPerson: 2,
      isActive: true
    },
    tableId: "tb-2",
    table: {
      id: "tb-2",
      tableNumber: "S-5",
      placeTypeId: "pt-2",
      capacity: 2,
      status: "occupied",
      isActive: true
    },
    amountPaid: 1600,
    paymentVerified: true,
    startTime: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 75 * 60 * 1000).toISOString(),
    totalRedemptionsAllowed: 4,
    redemptionsUsed: 1,
    status: "ACTIVE",
    issuedBy: "recep-01",
    deliveryMode: "EMAIL_QR"
  },
  {
    id: "mock-3",
    tokenNumber: "TKB-0112",
    customerId: "c-3",
    customer: {
      id: "c-3",
      name: "Vikram Malhotra",
      phoneNumber: "+91 76543 21098",
      email: "vikram.m@rediffmail.com",
      totalVisits: 2
    },
    personsCount: 6,
    placeTypeId: "pt-1",
    placeType: {
      id: "pt-1",
      name: "Premium Lounge",
      ratePerPerson: 1500,
      baseTimeMinutes: 120,
      redemptionsPerPerson: 3,
      isActive: true
    },
    tableId: "tb-3",
    table: {
      id: "tb-3",
      tableNumber: "L-1",
      placeTypeId: "pt-1",
      capacity: 8,
      status: "occupied",
      isActive: true
    },
    amountPaid: 9000,
    paymentVerified: true,
    startTime: new Date(Date.now() - 100 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    totalRedemptionsAllowed: 18,
    redemptionsUsed: 15,
    status: "ACTIVE",
    issuedBy: "recep-02",
    deliveryMode: "EMAIL_QR"
  },
  {
    id: "mock-4",
    tokenNumber: "TKS-0224",
    customerId: "c-4",
    customer: {
      id: "c-4",
      name: "Rahul Dravid",
      phoneNumber: "+91 99887 76655",
      email: "rahul.dravid@cricket.in",
      totalVisits: 1
    },
    personsCount: 3,
    placeTypeId: "pt-2",
    placeType: {
      id: "pt-2",
      name: "Standard Standing Bar",
      ratePerPerson: 800,
      baseTimeMinutes: 90,
      redemptionsPerPerson: 2,
      isActive: true
    },
    tableId: "tb-4",
    table: {
      id: "tb-4",
      tableNumber: "S-12",
      placeTypeId: "pt-2",
      capacity: 4,
      status: "occupied",
      isActive: true
    },
    amountPaid: 2400,
    paymentVerified: true,
    startTime: new Date(Date.now() - 80 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    totalRedemptionsAllowed: 6,
    redemptionsUsed: 5,
    status: "ACTIVE",
    issuedBy: "recep-01",
    deliveryMode: "EMAIL_QR"
  }
];

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n-1",
    title: "Session Expiring Soon",
    message: "Premium Lounge Table L-1 (Vikram Malhotra) session expires in 20 minutes.",
    timestamp: "10 mins ago",
    read: false
  },
  {
    id: "n-2",
    title: "QR Check-In Active",
    message: "New check-in registered at Standard Zone Table S-5 for 2 guests.",
    timestamp: "15 mins ago",
    read: false
  },
  {
    id: "n-3",
    title: "Payment Confirmed",
    message: "Billing of ₹6,000 for Token TKB-0104 confirmed via reception portal.",
    timestamp: "45 mins ago",
    read: true
  },
  {
    id: "n-4",
    title: "Bartender Dispense Triggered",
    message: "Standard ticket TKS-0224 dispensed 2 beers at Bar Station 2.",
    timestamp: "1 hour ago",
    read: true
  }
];

export const MOCK_REVENUE_TRENDS = [
  { time: "18:00", value: 14800, count: 4 },
  { time: "19:00", value: 24500, count: 8 },
  { time: "20:00", value: 38200, count: 12 },
  { time: "21:00", value: 45000, count: 15 },
  { time: "22:00", value: 62000, count: 22 },
  { time: "23:00", value: 52000, count: 18 }
];

export const MOCK_ACTIVITIES = [
  { id: "act-1", type: "checkin", desc: "Aditya Sharma checked in at Table L-3 (4 guests)", time: "45m ago" },
  { id: "act-2", type: "redeem", desc: "Redeemed 2 Whiskeys on Token TKB-0104", time: "30m ago" },
  { id: "act-3", type: "checkin", desc: "Pooja Hegde checked in at Table S-5 (2 guests)", time: "15m ago" },
  { id: "act-4", type: "extend", desc: "Table S-12 session extended by 30 mins", time: "10m ago" },
  { id: "act-5", type: "checkout", desc: "Token TKB-0092 checked out. Table L-4 released", time: "5m ago" }
];
