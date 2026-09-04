import { PrismaClient, TokenStatus, OrderStatus, FoodType, Station, ServiceRequestType, ServiceRequestStatus, PaymentMethod, BillStatus, OrderSource, CloseReason } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function populateTestData() {
  console.log('====================================================');
  console.log('🚀 POPULATING COMPREHENSIVE REALISTIC TEST DATA');
  console.log('🔒 EMAIL SAFETY: ZERO EXTERNAL EMAILS WILL BE SENT');
  console.log('====================================================');

  const now = new Date();

  // Helper for dates in the past
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000);
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);
  const daysAgo = (d: number, hoursOffset = 0) => new Date(now.getTime() - (d * 24 * 60 * 60 * 1000) + (hoursOffset * 60 * 60 * 1000));
  const minutesFromNow = (m: number) => new Date(now.getTime() + m * 60 * 1000);

  // 1. ROLES & USERS
  console.log('1. Ensuring all Staff Roles & Users exist...');
  const roles = await prisma.role.findMany();
  const roleMap: Record<string, string> = {};
  roles.forEach(r => { roleMap[r.name] = r.id; });

  const hashedPw = await bcrypt.hash('password123', 10);

  const staffMembers = [
    { username: 'admin', fullName: 'Divyan (Lead Admin)', role: 'admin' },
    { username: 'manager_david', fullName: 'David Sterling (Venue Manager)', role: 'manager' },
    { username: 'recep_sarah', fullName: 'Sarah Jenkins (Host / Reception)', role: 'receptionist' },
    { username: 'recep_priya', fullName: 'Priya Sharma (Reception Lead)', role: 'receptionist' },
    { username: 'bar_john', fullName: 'Johnathan "John" Miller (Mixologist)', role: 'bartender' },
    { username: 'bar_marcus', fullName: 'Marcus Vance (Senior Bartender)', role: 'bartender' },
    { username: 'chef_gordon', fullName: 'Gordon Vance (Head Chef)', role: 'chef' },
    { username: 'chef_vikram', fullName: 'Vikram Mehta (Sous Chef)', role: 'chef' },
    { username: 'waiter_ravi', fullName: 'Ravi Kumar (Floor Captain)', role: 'waiter' },
    { username: 'waiter_anita', fullName: 'Anita Desai (Service Staff)', role: 'waiter' },
    { username: 'waiter_carlos', fullName: 'Carlos Gomez (Server)', role: 'waiter' },
  ];

  const userMap: Record<string, any> = {};
  for (const staff of staffMembers) {
    if (!roleMap[staff.role]) continue;
    const user = await prisma.user.upsert({
      where: { username: staff.username },
      update: {
        fullName: staff.fullName,
        roleId: roleMap[staff.role],
        isActive: true,
        lastLogin: minutesAgo(Math.floor(Math.random() * 120)),
      },
      create: {
        username: staff.username,
        fullName: staff.fullName,
        passwordHash: hashedPw,
        roleId: roleMap[staff.role],
        isActive: true,
        lastLogin: minutesAgo(15),
      },
    });
    userMap[staff.username] = user;
  }
  console.log(`✓ Seeded/Verified ${Object.keys(userMap).length} Staff Users across all 6 roles.`);

  // 2. PLACE TYPES
  console.log('2. Verifying Place Types Config...');
  const standingBar = await prisma.placeTypeConfig.upsert({
    where: { name: 'STANDING_BAR' },
    update: { ratePerPerson: 500.0, baseTimeMinutes: 60, redemptionsPerPerson: 2, isActive: true },
    create: { name: 'STANDING_BAR', ratePerPerson: 500.0, baseTimeMinutes: 60, redemptionsPerPerson: 2, isActive: true },
  });

  const premiumLounge = await prisma.placeTypeConfig.upsert({
    where: { name: 'PREMIUM_LOUNGE' },
    update: { ratePerPerson: 1000.0, baseTimeMinutes: 120, redemptionsPerPerson: 3, isActive: true },
    create: { name: 'PREMIUM_LOUNGE', ratePerPerson: 1000.0, baseTimeMinutes: 120, redemptionsPerPerson: 3, isActive: true },
  });

  // 3. TABLES
  console.log('3. Ensuring complete Floor Plan tables...');
  const tableData = [
    // Standing Bar (S-01 to S-10)
    { number: 'S-01', placeTypeId: standingBar.id, capacity: 2, status: 'available' },
    { number: 'S-02', placeTypeId: standingBar.id, capacity: 2, status: 'available' },
    { number: 'S-03', placeTypeId: standingBar.id, capacity: 4, status: 'available' },
    { number: 'S-04', placeTypeId: standingBar.id, capacity: 4, status: 'available' },
    { number: 'S-05', placeTypeId: standingBar.id, capacity: 4, status: 'available' },
    { number: 'S-06', placeTypeId: standingBar.id, capacity: 6, status: 'available' },
    { number: 'S-07', placeTypeId: standingBar.id, capacity: 6, status: 'available' },
    { number: 'S-08', placeTypeId: standingBar.id, capacity: 2, status: 'reserved' },
    { number: 'S-09', placeTypeId: standingBar.id, capacity: 4, status: 'maintenance' },
    { number: 'S-10', placeTypeId: standingBar.id, capacity: 8, status: 'available' },
    // Premium Lounge (L-01 to L-08)
    { number: 'L-01', placeTypeId: premiumLounge.id, capacity: 4, status: 'available' },
    { number: 'L-02', placeTypeId: premiumLounge.id, capacity: 4, status: 'available' },
    { number: 'L-03', placeTypeId: premiumLounge.id, capacity: 6, status: 'available' },
    { number: 'L-04', placeTypeId: premiumLounge.id, capacity: 6, status: 'available' },
    { number: 'L-05', placeTypeId: premiumLounge.id, capacity: 8, status: 'available' },
    { number: 'L-06', placeTypeId: premiumLounge.id, capacity: 8, status: 'reserved' },
    { number: 'L-07', placeTypeId: premiumLounge.id, capacity: 10, status: 'available' },
    { number: 'L-08', placeTypeId: premiumLounge.id, capacity: 12, status: 'available' },
  ];

  const tableMap: Record<string, any> = {};
  for (const t of tableData) {
    const tbl = await prisma.table.upsert({
      where: {
        tableNumber_placeTypeId: {
          tableNumber: t.number,
          placeTypeId: t.placeTypeId,
        },
      },
      update: { capacity: t.capacity, status: t.status, isActive: true },
      create: { tableNumber: t.number, placeTypeId: t.placeTypeId, capacity: t.capacity, status: t.status, isActive: true },
    });
    tableMap[t.number] = tbl;
  }
  console.log(`✓ Seeded/Verified ${Object.keys(tableMap).length} Floor Plan Tables.`);

  // 4. CUSTOMERS
  console.log('4. Seeding diverse realistic customers...');
  const customerSpecs = [
    { phone: '9876543210', name: 'Aarav Singhania', email: 'aarav.singhania@gmail.com', totalVisits: 5 },
    { phone: '9811223344', name: 'Rohan Deshmukh', email: 'rohan.deshmukh@gmail.com', totalVisits: 2 },
    { phone: '9822334455', name: 'Meera Nambiar', email: 'meera.nambiar@gmail.com', totalVisits: 8 },
    { phone: '9833445566', name: 'Dr. Siddharth Sen', email: 'siddharth.sen@gmail.com', totalVisits: 12 },
    { phone: '9844556677', name: 'Kavita & Aditya Roy', email: 'aditya.roy@gmail.com', totalVisits: 3 },
    { phone: '9855667788', name: 'Nikhil Kashyap', email: 'nikhil.kashyap@gmail.com', totalVisits: 1 },
    { phone: '9866778899', name: 'Zoya Akhtar', email: 'zoya.akhtar@gmail.com', totalVisits: 4 },
    { phone: '9877889900', name: 'Raghavan Pillai', email: 'raghavan.pillai@gmail.com', totalVisits: 6 },
    { phone: '9888990011', name: 'Tanvi Kapoor', email: 'tanvi.kapoor@gmail.com', totalVisits: 7 },
    { phone: '9899001122', name: 'Vikramaditya Oberoi', email: 'vikram.oberoi@gmail.com', totalVisits: 15 },
    { phone: '9700112233', name: 'Ananya & Friends', email: 'ananya.f@gmail.com', totalVisits: 3 },
    { phone: '9711223344', name: 'Kabir Varma', email: 'kabir.varma@gmail.com', totalVisits: 9 },
  ];

  const customerMap: Record<string, any> = {};
  for (const c of customerSpecs) {
    const cust = await prisma.customer.upsert({
      where: { phoneNumber: c.phone },
      update: { name: c.name, email: c.email, totalVisits: c.totalVisits, lastVisit: daysAgo(Math.floor(Math.random() * 5)) },
      create: { phoneNumber: c.phone, name: c.name, email: c.email, totalVisits: c.totalVisits, lastVisit: now },
    });
    customerMap[c.phone] = cust;
  }
  console.log(`✓ Seeded/Verified ${Object.keys(customerMap).length} Customer Records.`);

  // 5. RESERVATIONS
  console.log('5. Seeding Reservations...');
  const reservationSpecs = [
    {
      customerName: 'Ananya & Friends',
      phoneNumber: '9700112233',
      email: 'ananya.f@gmail.com',
      personsCount: 6,
      tableId: tableMap['L-06']?.id,
      status: 'ASSIGNED',
    },
    {
      customerName: 'Kabir Varma',
      phoneNumber: '9711223344',
      email: 'kabir.varma@gmail.com',
      personsCount: 2,
      tableId: tableMap['S-08']?.id,
      status: 'ASSIGNED',
    },
    {
      customerName: 'Rajesh Mehra (Corporate Dinner)',
      phoneNumber: '9722334455',
      email: 'rajesh.mehra@gmail.com',
      personsCount: 10,
      tableId: null,
      status: 'PENDING',
    },
    {
      customerName: 'Simran Chadha',
      phoneNumber: '9733445566',
      email: 'simran.c@gmail.com',
      personsCount: 4,
      tableId: null,
      status: 'CANCELLED',
    },
  ];

  for (const res of reservationSpecs) {
    const existing = await prisma.reservation.findFirst({
      where: { phoneNumber: res.phoneNumber },
    });
    if (!existing) {
      await prisma.reservation.create({
        data: {
          customerName: res.customerName,
          phoneNumber: res.phoneNumber,
          email: res.email,
          personsCount: res.personsCount,
          tableId: res.tableId,
          status: res.status,
          userId: userMap['recep_sarah']?.id,
        },
      });
    }
  }
  console.log('✓ Seeded Reservations across PENDING, ASSIGNED, and CANCELLED states.');

  // 6. MENU CATALOG & STOCK
  console.log('6. Ensuring Menu Items & Stock Catalog...');
  const menuItems = await prisma.menuItem.findMany();
  const itemMap: Record<string, any> = {};
  menuItems.forEach(i => { itemMap[i.id] = i; });

  // Ensure stock items
  for (const item of menuItems) {
    const existingStock = await prisma.stockItem.findUnique({ where: { menuItemId: item.id } });
    if (!existingStock) {
      await prisma.stockItem.create({
        data: {
          menuItemId: item.id,
          currentStock: Math.floor(Math.random() * 40) + 10,
          unitOfMeasure: item.station === Station.BAR ? 'bottles/pegs' : 'portions',
          lowStockThreshold: 8,
          isActive: true,
        },
      });
    }
  }

  // 7. HISTORICAL & ACTIVE SESSIONS / TOKENS
  console.log('7. Seeding Historical & Active Customer Check-In Sessions...');

  // Helper function to safely create token without sending emails
  const createTokenSafe = async (spec: {
    tokenNumber: string;
    customerPhone: string;
    tableNumber: string | null;
    placeType: any;
    persons: number;
    startTime: Date;
    endTime: Date;
    redemptionsUsed: number;
    status: TokenStatus;
    closedAt?: Date;
    closeReason?: CloseReason;
  }) => {
    const cust = customerMap[spec.customerPhone];
    const tbl = spec.tableNumber ? tableMap[spec.tableNumber] : null;
    const totalDrinks = spec.persons * spec.placeType.redemptionsPerPerson;
    const amount = Number(spec.placeType.ratePerPerson) * spec.persons;

    const existingToken = await prisma.token.findUnique({ where: { tokenNumber: spec.tokenNumber } });
    if (existingToken) return existingToken;

    const token = await prisma.token.create({
      data: {
        tokenNumber: spec.tokenNumber,
        customerId: cust.id,
        personsCount: spec.persons,
        placeTypeId: spec.placeType.id,
        tableId: tbl?.id || null,
        amountPaid: amount,
        paymentVerified: true,
        startTime: spec.startTime,
        endTime: spec.endTime,
        totalRedemptionsAllowed: totalDrinks,
        redemptionsUsed: spec.redemptionsUsed,
        status: spec.status,
        issuedBy: userMap['recep_sarah']?.id || userMap['admin']?.id,
        issuedAt: spec.startTime,
        closedAt: spec.closedAt || null,
        closedBy: spec.closedAt ? (userMap['bar_john']?.id || userMap['admin']?.id) : null,
        closeReason: spec.closeReason || null,
        deliveryMode: 'EMAIL_QR',
        emailSent: true, // Marked as sent in DB without external sending
        emailDeliveryStatus: 'SENT',
        activatedAt: spec.startTime,
        activatedBy: userMap['recep_sarah']?.id || userMap['admin']?.id,
      },
    });

    if (spec.status === TokenStatus.ACTIVE && tbl) {
      await prisma.table.update({
        where: { id: tbl.id },
        data: {
          status: 'occupied',
          currentTokenId: token.id,
          occupiedSince: spec.startTime,
          lastAssignedAt: spec.startTime,
        },
      });
    }

    return token;
  };

  // ACTIVE SESSIONS (Tables S-01, S-02, S-03, L-01, L-02, L-03)
  const tokenActive1 = await createTokenSafe({
    tokenNumber: 'PNB-701',
    customerPhone: '9876543210',
    tableNumber: 'S-01',
    placeType: standingBar,
    persons: 2,
    startTime: minutesAgo(45),
    endTime: minutesFromNow(15),
    redemptionsUsed: 2,
    status: TokenStatus.ACTIVE,
  });

  const tokenActive2 = await createTokenSafe({
    tokenNumber: 'PNB-702',
    customerPhone: '9811223344',
    tableNumber: 'S-02',
    placeType: standingBar,
    persons: 2,
    startTime: minutesAgo(20),
    endTime: minutesFromNow(40),
    redemptionsUsed: 1,
    status: TokenStatus.ACTIVE,
  });

  const tokenActive3 = await createTokenSafe({
    tokenNumber: 'PNB-703',
    customerPhone: '9822334455',
    tableNumber: 'S-03',
    placeType: standingBar,
    persons: 4,
    startTime: minutesAgo(50),
    endTime: minutesFromNow(10),
    redemptionsUsed: 4,
    status: TokenStatus.ACTIVE,
  });

  const tokenActive4 = await createTokenSafe({
    tokenNumber: 'PNB-704',
    customerPhone: '9833445566',
    tableNumber: 'L-01',
    placeType: premiumLounge,
    persons: 4,
    startTime: minutesAgo(30),
    endTime: minutesFromNow(90),
    redemptionsUsed: 3,
    status: TokenStatus.ACTIVE,
  });

  const tokenActive5 = await createTokenSafe({
    tokenNumber: 'PNB-705',
    customerPhone: '9844556677',
    tableNumber: 'L-02',
    placeType: premiumLounge,
    persons: 4,
    startTime: minutesAgo(75),
    endTime: minutesFromNow(45),
    redemptionsUsed: 6,
    status: TokenStatus.ACTIVE,
  });

  const tokenActive6 = await createTokenSafe({
    tokenNumber: 'PNB-706',
    customerPhone: '9855667788',
    tableNumber: 'L-03',
    placeType: premiumLounge,
    persons: 6,
    startTime: minutesAgo(10),
    endTime: minutesFromNow(110),
    redemptionsUsed: 2,
    status: TokenStatus.ACTIVE,
  });

  // HISTORICAL CLOSED SESSIONS (Past 7 days for Analytics & Customer Sessions)
  const historicalTokens = [
    { tokenNumber: 'PNB-680', customerPhone: '9866778899', tableNumber: 'S-04', placeType: standingBar, persons: 4, startTime: daysAgo(1, 2), endTime: daysAgo(1, 3), redemptionsUsed: 8, status: TokenStatus.CLOSED, closedAt: daysAgo(1, 3), closeReason: CloseReason.CHECKOUT },
    { tokenNumber: 'PNB-681', customerPhone: '9877889900', tableNumber: 'L-04', placeType: premiumLounge, persons: 6, startTime: daysAgo(1, 4), endTime: daysAgo(1, 6), redemptionsUsed: 18, status: TokenStatus.CLOSED, closedAt: daysAgo(1, 6), closeReason: CloseReason.CHECKOUT },
    { tokenNumber: 'PNB-682', customerPhone: '9888990011', tableNumber: 'S-05', placeType: standingBar, persons: 2, startTime: daysAgo(2, 1), endTime: daysAgo(2, 2), redemptionsUsed: 4, status: TokenStatus.CLOSED, closedAt: daysAgo(2, 2), closeReason: CloseReason.QR_SCAN },
    { tokenNumber: 'PNB-683', customerPhone: '9899001122', tableNumber: 'L-05', placeType: premiumLounge, persons: 8, startTime: daysAgo(2, 5), endTime: daysAgo(2, 7), redemptionsUsed: 24, status: TokenStatus.CLOSED, closedAt: daysAgo(2, 7), closeReason: CloseReason.CHECKOUT },
    { tokenNumber: 'PNB-684', customerPhone: '9876543210', tableNumber: 'S-06', placeType: standingBar, persons: 4, startTime: daysAgo(3, 3), endTime: daysAgo(3, 4), redemptionsUsed: 8, status: TokenStatus.CLOSED, closedAt: daysAgo(3, 4), closeReason: CloseReason.CHECKOUT },
    { tokenNumber: 'PNB-685', customerPhone: '9811223344', tableNumber: 'L-07', placeType: premiumLounge, persons: 10, startTime: daysAgo(4, 6), endTime: daysAgo(4, 8), redemptionsUsed: 30, status: TokenStatus.CLOSED, closedAt: daysAgo(4, 8), closeReason: CloseReason.CHECKOUT },
    { tokenNumber: 'PNB-686', customerPhone: '9822334455', tableNumber: 'S-07', placeType: standingBar, persons: 6, startTime: daysAgo(5, 2), endTime: daysAgo(5, 3), redemptionsUsed: 12, status: TokenStatus.CLOSED, closedAt: daysAgo(5, 3), closeReason: CloseReason.CHECKOUT },
  ];

  for (const ht of historicalTokens) {
    await createTokenSafe(ht);
  }
  console.log('✓ Seeded Active Sessions (S-01..03, L-01..03) and Historical Completed Sessions.');

  // 8. DRINK REDEMPTIONS (Bartender View)
  console.log('8. Seeding Drink Redemptions for Bartender verification...');
  const activeTokensList = [tokenActive1, tokenActive2, tokenActive3, tokenActive4, tokenActive5, tokenActive6];
  for (const tok of activeTokensList) {
    if (!tok || tok.redemptionsUsed === 0) continue;
    for (let seq = 1; seq <= tok.redemptionsUsed; seq++) {
      const existingRed = await prisma.redemption.findFirst({
        where: { tokenId: tok.id, redemptionSequence: seq },
      });
      if (!existingRed) {
        await prisma.redemption.create({
          data: {
            tokenId: tok.id,
            redemptionSequence: seq,
            redeemedAt: minutesAgo(Math.floor(Math.random() * 30) + 5),
            bartenderId: userMap['bar_john']?.id || userMap['admin']?.id,
            notes: seq % 2 === 0 ? 'Bira 91 White Draft Pint' : 'Old Monk 60ml with Soda',
          },
        });
      }
    }
  }

  // 9. SERVICE REQUESTS (Waiter Station View)
  console.log('9. Seeding Service Requests for Waiter & Captain Stations...');
  const serviceReqSpecs = [
    {
      tokenId: tokenActive1.id,
      tableId: tableMap['S-01'].id,
      tableNumber: 'S-01',
      type: ServiceRequestType.WATER,
      note: 'Extra chilled mineral water bottles requested',
      status: ServiceRequestStatus.NEW,
      createdAt: minutesAgo(5),
    },
    {
      tokenId: tokenActive4.id,
      tableId: tableMap['L-01'].id,
      tableNumber: 'L-01',
      type: ServiceRequestType.CUTLERY,
      note: 'Additional cocktail forks and napkins',
      status: ServiceRequestStatus.ACKNOWLEDGED,
      assignedStaffId: userMap['waiter_ravi']?.id,
      createdAt: minutesAgo(12),
      acknowledgedAt: minutesAgo(8),
    },
    {
      tokenId: tokenActive5.id,
      tableId: tableMap['L-02'].id,
      tableNumber: 'L-02',
      type: ServiceRequestType.BILL_REQUEST,
      note: 'Customer ready for final printed bill check',
      status: ServiceRequestStatus.NEW,
      createdAt: minutesAgo(3),
    },
    {
      tokenId: tokenActive3.id,
      tableId: tableMap['S-03'].id,
      tableNumber: 'S-03',
      type: ServiceRequestType.CLEAN_UP,
      note: 'Spilled drink on table edge cleaned',
      status: ServiceRequestStatus.COMPLETED,
      assignedStaffId: userMap['waiter_anita']?.id,
      createdAt: minutesAgo(25),
      acknowledgedAt: minutesAgo(22),
      completedAt: minutesAgo(18),
    },
  ];

  for (const sr of serviceReqSpecs) {
    const existing = await prisma.serviceRequest.findFirst({
      where: { tokenId: sr.tokenId, type: sr.type, status: sr.status },
    });
    if (!existing) {
      await prisma.serviceRequest.create({ data: sr });
    }
  }
  console.log('✓ Seeded Service Requests (Water, Cutlery, Bill Request, Cleanup).');

  // 10. ORDERS & ORDER ITEMS (Kitchen KDS, Bar KDS, Ready Queue, Analytics)
  console.log('10. Seeding Orders for Kitchen KDS & Bar KDS...');

  const foodItem1 = itemMap['itm_gcc'] || menuItems.find(i => i.station === Station.KITCHEN);
  const foodItem2 = itemMap['itm_wings'] || menuItems.find(i => i.station === Station.KITCHEN);
  const drinkItem1 = itemMap['itm_bira'] || menuItems.find(i => i.station === Station.BAR);
  const drinkItem2 = itemMap['itm_oldmonk'] || menuItems.find(i => i.station === Station.BAR);

  // ORDER 1: Table S-01 (PREPARING in Kitchen & Bar)
  const order1 = await prisma.order.create({
    data: {
      orderNumber: 101,
      tokenId: tokenActive1.id,
      tableId: tableMap['S-01'].id,
      customerId: tokenActive1.customerId,
      orderSource: OrderSource.CUSTOMER,
      placedAt: minutesAgo(18),
      subtotal: 655.0,
      status: OrderStatus.PREPARING,
      notes: 'Please make wings extra crispy',
      handlerId: userMap['waiter_ravi']?.id,
      items: {
        create: [
          {
            menuItemId: foodItem2.id,
            itemName: foodItem2.name,
            sectionSlug: 'eat',
            variantName: 'Full (8 Pcs)',
            selectedModifiers: [{ name: 'Hot', priceDelta: 0 }],
            specialInstructions: 'Extra crispy',
            quantity: 1,
            unitPrice: 390.0,
            lineTotal: 390.0,
            station: Station.KITCHEN,
            foodType: FoodType.NON_VEG,
            status: OrderStatus.PREPARING,
          },
          {
            menuItemId: drinkItem1.id,
            itemName: drinkItem1.name,
            sectionSlug: 'drink',
            variantName: 'Pint (330ml)',
            selectedModifiers: [{ name: 'Chilled Glass', priceDelta: 0 }],
            quantity: 1,
            unitPrice: 265.0,
            lineTotal: 265.0,
            station: Station.BAR,
            foodType: FoodType.VEG,
            status: OrderStatus.READY,
            readyAt: minutesAgo(5),
          },
        ],
      },
    },
  });

  // ORDER 2: Table L-01 (NEW / PLACED in Kitchen KDS)
  const order2 = await prisma.order.create({
    data: {
      orderNumber: 102,
      tokenId: tokenActive4.id,
      tableId: tableMap['L-01'].id,
      customerId: tokenActive4.customerId,
      orderSource: OrderSource.SERVER,
      placedAt: minutesAgo(8),
      subtotal: 920.0,
      status: OrderStatus.PLACED,
      handlerId: userMap['waiter_anita']?.id,
      items: {
        create: [
          {
            menuItemId: foodItem1.id,
            itemName: foodItem1.name,
            sectionSlug: 'eat',
            variantName: 'Full',
            selectedModifiers: [{ name: 'Medium', priceDelta: 0 }],
            quantity: 2,
            unitPrice: 315.0,
            lineTotal: 630.0,
            station: Station.KITCHEN,
            foodType: FoodType.VEG,
            status: OrderStatus.PLACED,
          },
          {
            menuItemId: drinkItem2.id,
            itemName: drinkItem2.name,
            sectionSlug: 'drink',
            variantName: '60ml (Double)',
            selectedModifiers: [{ name: 'Cola', priceDelta: 40 }],
            quantity: 1,
            unitPrice: 290.0,
            lineTotal: 290.0,
            station: Station.BAR,
            foodType: FoodType.VEG,
            status: OrderStatus.PREPARING,
          },
        ],
      },
    },
  });

  // ORDER 3: Table L-02 (READY for Waiter Pickup)
  const order3 = await prisma.order.create({
    data: {
      orderNumber: 103,
      tokenId: tokenActive5.id,
      tableId: tableMap['L-02'].id,
      customerId: tokenActive5.customerId,
      orderSource: OrderSource.CUSTOMER,
      placedAt: minutesAgo(28),
      subtotal: 1250.0,
      status: OrderStatus.READY,
      handlerId: userMap['waiter_carlos']?.id,
      items: {
        create: [
          {
            menuItemId: foodItem2.id,
            itemName: foodItem2.name,
            sectionSlug: 'eat',
            variantName: 'Full (8 Pcs)',
            quantity: 2,
            unitPrice: 390.0,
            lineTotal: 780.0,
            station: Station.KITCHEN,
            foodType: FoodType.NON_VEG,
            status: OrderStatus.READY,
            readyAt: minutesAgo(4),
          },
          {
            menuItemId: drinkItem1.id,
            itemName: drinkItem1.name,
            sectionSlug: 'drink',
            variantName: 'Pitcher (1500ml)',
            quantity: 1,
            unitPrice: 470.0,
            lineTotal: 470.0,
            station: Station.BAR,
            foodType: FoodType.VEG,
            status: OrderStatus.READY,
            readyAt: minutesAgo(2),
          },
        ],
      },
    },
  });

  // ORDER 4: Table S-03 (SERVED)
  const order4 = await prisma.order.create({
    data: {
      orderNumber: 104,
      tokenId: tokenActive3.id,
      tableId: tableMap['S-03'].id,
      customerId: tokenActive3.customerId,
      orderSource: OrderSource.CUSTOMER,
      placedAt: minutesAgo(45),
      subtotal: 580.0,
      status: OrderStatus.SERVED,
      handlerId: userMap['waiter_ravi']?.id,
      items: {
        create: [
          {
            menuItemId: foodItem1.id,
            itemName: foodItem1.name,
            sectionSlug: 'eat',
            quantity: 2,
            unitPrice: 215.0,
            lineTotal: 430.0,
            station: Station.KITCHEN,
            foodType: FoodType.VEG,
            status: OrderStatus.SERVED,
            servedAt: minutesAgo(20),
          },
          {
            menuItemId: drinkItem2.id,
            itemName: drinkItem2.name,
            sectionSlug: 'drink',
            quantity: 1,
            unitPrice: 150.0,
            lineTotal: 150.0,
            station: Station.BAR,
            foodType: FoodType.VEG,
            status: OrderStatus.SERVED,
            servedAt: minutesAgo(25),
          },
        ],
      },
    },
  });

  console.log('✓ Seeded Orders and OrderItems across PLACED, PREPARING, READY, and SERVED states.');

  // 11. BILLS & SETTLEMENTS (Billing & Waiter Tabs)
  console.log('11. Seeding Customer Bills (Requested & Settled)...');

  // Active Bill for Table L-02 (REQUESTED)
  const existingBill1 = await prisma.bill.findUnique({ where: { billNumber: 'PNB-BILL-1001' } });
  if (!existingBill1) {
    await prisma.bill.create({
      data: {
        billNumber: 'PNB-BILL-1001',
        tokenId: tokenActive5.id,
        tableId: tableMap['L-02'].id,
        foodSubtotal: 780.0,
        drinkSubtotal: 470.0,
        subtotal: 1250.0,
        discountTotal: 0.0,
        serviceChargeTotal: 62.5, // 5% Service Charge
        taxTotal: 62.5, // 5% GST
        grandTotal: 1375.0,
        status: BillStatus.REQUESTED,
        createdAt: minutesAgo(10),
      },
    });
  }

  // Settled Historical Bills
  const settledBills = [
    { billNumber: 'PNB-BILL-0995', tokenNum: 'PNB-680', table: 'S-04', food: 1100, drink: 650, total: 1750, gst: 87.5, sc: 87.5, grand: 1925, method: PaymentMethod.UPI, daysAgoVal: 1 },
    { billNumber: 'PNB-BILL-0996', tokenNum: 'PNB-681', table: 'L-04', food: 2400, drink: 1200, total: 3600, gst: 180, sc: 180, grand: 3960, method: PaymentMethod.CARD, daysAgoVal: 1 },
    { billNumber: 'PNB-BILL-0997', tokenNum: 'PNB-682', table: 'S-05', food: 650, drink: 450, total: 1100, gst: 55, sc: 55, grand: 1210, method: PaymentMethod.CASH, daysAgoVal: 2 },
    { billNumber: 'PNB-BILL-0998', tokenNum: 'PNB-683', table: 'L-05', food: 3800, drink: 2100, total: 5900, gst: 295, sc: 295, grand: 6490, method: PaymentMethod.CARD, daysAgoVal: 2 },
  ];

  for (const sb of settledBills) {
    const existing = await prisma.bill.findUnique({ where: { billNumber: sb.billNumber } });
    const tok = await prisma.token.findUnique({ where: { tokenNumber: sb.tokenNum } });
    if (!existing && tok) {
      await prisma.bill.create({
        data: {
          billNumber: sb.billNumber,
          tokenId: tok.id,
          tableId: tableMap[sb.table]?.id || tableMap['S-01'].id,
          foodSubtotal: sb.food,
          drinkSubtotal: sb.drink,
          subtotal: sb.total,
          discountTotal: 0.0,
          serviceChargeTotal: sb.sc,
          taxTotal: sb.gst,
          grandTotal: sb.grand,
          status: BillStatus.PAID,
          paymentMethod: sb.method,
          settledBy: userMap['waiter_ravi']?.id || userMap['admin']?.id,
          settlementReference: `TXN-${Math.floor(Math.random() * 900000 + 100000)}`,
          createdAt: daysAgo(sb.daysAgoVal, 2),
          paidAt: daysAgo(sb.daysAgoVal, 3),
        },
      });
    }
  }
  console.log('✓ Seeded Bills (Active Requested Bill + Settled Historical Bills).');

  // 12. RATE CARD LOGS (Rate Management Audit)
  console.log('12. Seeding Rate Card Audit Logs...');
  const existingRateLogs = await prisma.rateLog.findMany();
  if (existingRateLogs.length === 0) {
    await prisma.rateLog.createMany({
      data: [
        {
          placeTypeId: standingBar.id,
          oldRate: 450.0,
          newRate: 500.0,
          changedBy: userMap['admin'].id,
          changedAt: daysAgo(10),
        },
        {
          placeTypeId: premiumLounge.id,
          oldRate: 1200.0,
          newRate: 1000.0,
          changedBy: userMap['admin'].id,
          changedAt: daysAgo(7),
        },
      ],
    });
  }
  console.log('✓ Seeded Rate Card Change Logs.');

  console.log('====================================================');
  console.log('🎉 TEST DATA SETUP COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
}

populateTestData()
  .catch((err) => {
    console.error('❌ Error during test data setup:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
