import { PrismaClient, BillStatus, PaymentMethod, CloseReason, ServiceRequestType, ServiceRequestStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { broadcastBillSettled, broadcastTableUpdated, broadcastTableSessionClosed, broadcastServiceRequestCreated } from '../realtime';

const prisma = new PrismaClient();

export class BillingService {
  /**
   * Authoritative calculation of a table session's bill from PostgreSQL order items
   */
  async calculateBill(tokenNumberOrId: string) {
    let token = await prisma.token.findUnique({
      where: { tokenNumber: tokenNumberOrId },
      include: {
        table: true,
        customer: true,
        orders: {
          include: {
            items: {
              include: {
                menuItem: {
                  include: {
                    gstTaxTag: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!token) {
      token = await prisma.token.findUnique({
        where: { id: tokenNumberOrId },
        include: {
          table: true,
          customer: true,
          orders: {
            include: {
              items: {
                include: {
                  menuItem: {
                    include: {
                      gstTaxTag: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    }

    if (!token) {
      throw new Error(`Token ${tokenNumberOrId} not found`);
    }

    // 1. Fetch Venue Configuration (Dynamic GST & Service Charge settings)
    const venueConfig = await prisma.venueConfig.findUnique({ where: { id: 'default' } });
    const isGstGloballyEnabled = venueConfig?.gstEnabled ?? true;
    const serviceChargeRate = (venueConfig?.scEnabled ?? true) ? new Decimal(venueConfig?.scRate ?? 0.05) : new Decimal(0);
    const defaultFallbackGstRate = new Decimal(venueConfig?.gstRate ?? 0.05);
    const roundingEnabled = venueConfig?.roundingEnabled ?? true;

    // 2. Calculate Section Subtotals & Item-level GST from non-cancelled order items
    let foodSubtotal = new Decimal(0);
    let drinkSubtotal = new Decimal(0);
    let merchandiseSubtotal = new Decimal(0);
    let itemTaxTotalSum = new Decimal(0);
    const consolidatedItems: any[] = [];

    for (const order of token.orders) {
      for (const item of order.items) {
        if (item.status === 'CANCELLED') continue;

        const lineTot = new Decimal(item.lineTotal);
        if (item.sectionSlug === 'drink') {
          drinkSubtotal = drinkSubtotal.plus(lineTot);
        } else if (item.sectionSlug === 'merchandise') {
          merchandiseSubtotal = merchandiseSubtotal.plus(lineTot);
        } else {
          foodSubtotal = foodSubtotal.plus(lineTot);
        }

        // Authoritative resolution of product-level GST rate
        let effectiveGstRate = new Decimal(0);
        let effectiveGstTagName = 'No GST';

        if (isGstGloballyEnabled) {
          if (item.gstRate !== null && item.gstRate !== undefined) {
            effectiveGstRate = new Decimal(item.gstRate);
            effectiveGstTagName = item.gstTaxTagName || `${effectiveGstRate.times(100).toNumber()}% GST`;
          } else if ((item as any).menuItem?.gstTaxTag) {
            effectiveGstRate = new Decimal((item as any).menuItem.gstTaxTag.rate);
            effectiveGstTagName = (item as any).menuItem.gstTaxTag.name;
          } else {
            effectiveGstRate = defaultFallbackGstRate;
            effectiveGstTagName = `${effectiveGstRate.times(100).toNumber()}% GST`;
          }
        }

        // Taxable basis per item includes service charge proportionate share
        const itemTaxableBasis = lineTot.times(new Decimal(1).plus(serviceChargeRate));
        const itemGstAmount = itemTaxableBasis.times(effectiveGstRate).toDecimalPlaces(2);
        itemTaxTotalSum = itemTaxTotalSum.plus(itemGstAmount);

        consolidatedItems.push({
          id: item.id,
          orderNumber: order.orderNumber,
          itemName: item.itemName,
          variantName: item.variantName,
          selectedModifiers: item.selectedModifiers,
          sectionSlug: item.sectionSlug,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          gstRate: effectiveGstRate.toNumber(),
          gstPercentage: effectiveGstRate.times(100).toNumber(),
          gstTaxTagName: effectiveGstTagName,
          gstAmount: itemGstAmount.toDecimalPlaces(2),
          station: item.station,
          status: item.status,
        });
      }
    }

    const grossSubtotal = foodSubtotal.plus(drinkSubtotal).plus(merchandiseSubtotal);
    const discountTotal = new Decimal(0); // Optional promo discounts

    const discountedSubtotal = Decimal.max(new Decimal(0), grossSubtotal.minus(discountTotal));
    const serviceChargeTotal = discountedSubtotal.times(serviceChargeRate).toDecimalPlaces(2);
    const taxTotal = itemTaxTotalSum.toDecimalPlaces(2);
    const taxableAmount = discountedSubtotal.plus(serviceChargeTotal);
    const grossPayable = taxableAmount.plus(taxTotal);

    // 3. Redemption Entitlement Offset (Entitlement from entry fee, applied against eligible drinks)
    const entryFeePaid = new Decimal(token.amountPaid);
    // Eligible redemption is the minimum of entry fee and drink subtotal
    const redemptionDeduction = Decimal.min(entryFeePaid, drinkSubtotal).toDecimalPlaces(2);

    // 4. Final Balance & Cash Rounding
    const netBeforeRounding = Decimal.max(new Decimal(0), grossPayable.minus(redemptionDeduction));
    const roundedFinalPayable = roundingEnabled
      ? new Decimal(Math.round(netBeforeRounding.toNumber()))
      : netBeforeRounding.toDecimalPlaces(2);
    const rounding = roundedFinalPayable.minus(netBeforeRounding).toDecimalPlaces(2);

    return {
      tokenId: token.id,
      tokenNumber: token.tokenNumber,
      tableId: token.tableId,
      tableNumber: token.table?.tableNumber || 'N/A',
      customerName: token.customer?.name || 'Guest',
      customerPhone: token.customer?.phoneNumber || '',
      items: consolidatedItems,
      foodSubtotal: foodSubtotal.toDecimalPlaces(2),
      drinkSubtotal: drinkSubtotal.toDecimalPlaces(2),
      merchandiseSubtotal: merchandiseSubtotal.toDecimalPlaces(2),
      grossSubtotal: grossSubtotal.toDecimalPlaces(2),
      discountTotal: discountTotal.toDecimalPlaces(2),
      serviceChargeTotal,
      taxTotal,
      surchargeTotal: new Decimal(0),
      rounding,
      entryFeePaid: entryFeePaid.toDecimalPlaces(2),
      redemptionDeduction,
      grandTotal: roundedFinalPayable.toDecimalPlaces(2),
      remainingPayable: roundedFinalPayable.toDecimalPlaces(2),
      status: token.status === 'CLOSED' ? 'PAID' : 'DRAFT',
    };
  }

  /**
   * Customer-initiated persistent Bill Request (PostgreSQL Bill with status REQUESTED)
   */
  async requestBill(tokenNumberOrId: string) {
    const calc = await this.calculateBill(tokenNumberOrId);

    const result = await prisma.$transaction(async (tx) => {
      const token = await tx.token.findUnique({
        where: { id: calc.tokenId },
        include: { table: true },
      });

      if (!token) throw new Error('Token not found');

      if (token.status === 'CLOSED' || token.status === 'CANCELLED') {
        throw new Error(`Cannot request bill for a session with status ${token.status}`);
      }

      if (!token.tableId) {
        throw new Error('No active table assigned to this dining session');
      }

      const now = new Date();

      // Check if an existing open bill exists for this token
      let bill = await tx.bill.findFirst({
        where: {
          tokenId: token.id,
          status: { in: [BillStatus.REQUESTED, BillStatus.DRAFT] },
        },
      });

      if (bill) {
        // Update bill amounts with latest calculation
        bill = await tx.bill.update({
          where: { id: bill.id },
          data: {
            foodSubtotal: calc.foodSubtotal,
            drinkSubtotal: calc.drinkSubtotal,
            merchandiseSubtotal: calc.merchandiseSubtotal,
            subtotal: calc.grossSubtotal,
            discountTotal: calc.discountTotal,
            serviceChargeTotal: calc.serviceChargeTotal,
            taxTotal: calc.taxTotal,
            rounding: calc.rounding,
            grandTotal: calc.grandTotal,
            status: BillStatus.REQUESTED,
          },
        });
      } else {
        const billNumber = `PNB-BILL-${token.table?.tableNumber || 'TAB'}-${Date.now().toString().slice(-4)}`;
        bill = await tx.bill.create({
          data: {
            billNumber,
            tokenId: token.id,
            tableId: token.tableId,
            foodSubtotal: calc.foodSubtotal,
            drinkSubtotal: calc.drinkSubtotal,
            merchandiseSubtotal: calc.merchandiseSubtotal,
            subtotal: calc.grossSubtotal,
            discountTotal: calc.discountTotal,
            serviceChargeTotal: calc.serviceChargeTotal,
            taxTotal: calc.taxTotal,
            rounding: calc.rounding,
            grandTotal: calc.grandTotal,
            status: BillStatus.REQUESTED,
            createdAt: now,
          },
        });
      }

      // Link any unlinked orders to this bill
      await tx.order.updateMany({
        where: { tokenId: token.id, billId: null },
        data: { billId: bill.id },
      });

      // Update table status to BILL_REQUESTED so floor plan and waiter dashboard recognize it immediately
      await tx.table.update({
        where: { id: token.tableId },
        data: {
          status: 'BILL_REQUESTED',
          currentTokenId: token.id,
        },
      });

      // Ensure a persistent ServiceRequest of type BILL_REQUEST exists for waiter operational tracking
      const recentReq = await tx.serviceRequest.findFirst({
        where: {
          tokenId: token.id,
          type: ServiceRequestType.BILL_REQUEST,
          status: { in: [ServiceRequestStatus.NEW, ServiceRequestStatus.ACKNOWLEDGED] },
        },
      });

      let serviceReq = recentReq;
      let isNewRequest = false;
      if (!serviceReq) {
        serviceReq = await tx.serviceRequest.create({
          data: {
            tokenId: token.id,
            tableId: token.tableId,
            tableNumber: token.table?.tableNumber || 'N/A',
            type: ServiceRequestType.BILL_REQUEST,
            note: `Bill requested for Table ${token.table?.tableNumber || 'N/A'} - Total ₹${calc.grandTotal}`,
            status: ServiceRequestStatus.NEW,
          },
        });
        isNewRequest = true;
      }

      return {
        bill,
        token,
        serviceRequest: serviceReq,
        isNewRequest,
      };
    });

    // Real-time broadcasts
    try {
      broadcastTableUpdated({
        tableId: result.token.tableId!,
        tableNumber: calc.tableNumber,
        status: 'BILL_REQUESTED',
        currentTokenId: result.token.id,
        updatedAt: new Date().toISOString(),
      });

      if (result.isNewRequest && result.serviceRequest) {
        broadcastServiceRequestCreated({
          id: result.serviceRequest.id,
          tokenId: result.token.id,
          tokenNumber: calc.tokenNumber,
          tableId: result.token.tableId!,
          tableNumber: calc.tableNumber,
          type: ServiceRequestType.BILL_REQUEST,
          note: result.serviceRequest.note,
          status: result.serviceRequest.status,
          createdAt: result.serviceRequest.createdAt.toISOString(),
        });
      }
    } catch (err) {
      console.warn('Real-time bill request broadcast error:', err);
    }

    return {
      success: true,
      bill: result.bill,
      calculated: calc,
    };
  }

  /**
   * Initiate Settlement: locks ordering for the table and sets table status to SETTLING
   */
  async initiateSettlement(tokenNumberOrId: string) {
    const calc = await this.calculateBill(tokenNumberOrId);

    const unservedCount = (calc.items || []).filter(
      (it: any) => it.status !== 'SERVED' && it.status !== 'CANCELLED'
    ).length;

    if (unservedCount > 0) {
      throw new Error(`Cannot initiate settlement. There are ${unservedCount} unserved item(s). All items must be SERVED or CANCELLED before proceeding to payment.`);
    }

    const token = await prisma.token.findUnique({
      where: { id: calc.tokenId },
      include: { table: true },
    });

    if (!token) throw new Error('Token not found');
    if (token.status === 'CLOSED' || token.status === 'CANCELLED') {
      throw new Error(`Cannot initiate settlement for a session with status ${token.status}`);
    }
    if (!token.tableId) {
      throw new Error('No active table assigned to this dining session');
    }

    await prisma.table.update({
      where: { id: token.tableId },
      data: {
        status: 'SETTLING',
      },
    });

    try {
      broadcastTableUpdated({
        tableId: token.tableId,
        tableNumber: calc.tableNumber,
        status: 'SETTLING',
        currentTokenId: token.id,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Failed to broadcast settlement initiation:', err);
    }

    return {
      success: true,
      tableStatus: 'SETTLING',
      tableId: token.tableId,
      tableNumber: calc.tableNumber,
      calculated: calc,
    };
  }

  /**
   * Cancel Settlement: returns table status to BILL_REQUESTED (unlocking ordering if unpaid)
   */
  async cancelSettlement(tokenNumberOrId: string) {
    const calc = await this.calculateBill(tokenNumberOrId);

    const token = await prisma.token.findUnique({
      where: { id: calc.tokenId },
      include: { table: true },
    });

    if (!token) throw new Error('Token not found');
    if (token.status === 'CLOSED') {
      return { success: false, message: 'Session is already settled and closed' };
    }
    if (!token.tableId) {
      throw new Error('No active table assigned to this dining session');
    }

    await prisma.table.update({
      where: { id: token.tableId },
      data: {
        status: 'BILL_REQUESTED',
      },
    });

    try {
      broadcastTableUpdated({
        tableId: token.tableId,
        tableNumber: calc.tableNumber,
        status: 'BILL_REQUESTED',
        currentTokenId: token.id,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Failed to broadcast settlement cancellation:', err);
    }

    return {
      success: true,
      tableStatus: 'BILL_REQUESTED',
      tableId: token.tableId,
      tableNumber: calc.tableNumber,
    };
  }

  /**
   * Settle Bill, collect remaining payment, and trigger complete table turnover
   */
  async settleBill(input: {
    tokenNumberOrId: string;
    paymentMethod: PaymentMethod;
    settledByStaffId?: string;
    settlementReference?: string;
  }) {
    const calc = await this.calculateBill(input.tokenNumberOrId);

    // Enforce unserved items check authoritatively
    const unservedCount = (calc.items || []).filter(
      (it: any) => it.status !== 'SERVED' && it.status !== 'CANCELLED'
    ).length;

    if (unservedCount > 0) {
      throw new Error(`Cannot settle bill. There are ${unservedCount} unserved item(s). All items must be SERVED or CANCELLED before payment confirmation.`);
    }

    const result = await prisma.$transaction(async (tx) => {
      const token = await tx.token.findUnique({
        where: { id: calc.tokenId },
        include: { table: true },
      });

      if (!token) throw new Error('Token not found');

      if (token.status === 'CLOSED') {
        const existingBill = await tx.bill.findFirst({
          where: { tokenId: token.id },
        });
        if (existingBill) {
          return {
            bill: existingBill,
            turnoverStatus: 'ALREADY_SETTLED',
          };
        }
        throw new Error('This session has already been settled and closed');
      }

      const now = new Date();

      // Check for existing bill or create new
      let existingBill = await tx.bill.findFirst({
        where: { tokenId: token.id },
      });

      let settledBill;
      if (existingBill) {
        settledBill = await tx.bill.update({
          where: { id: existingBill.id },
          data: {
            foodSubtotal: calc.foodSubtotal,
            drinkSubtotal: calc.drinkSubtotal,
            merchandiseSubtotal: calc.merchandiseSubtotal,
            subtotal: calc.grossSubtotal,
            discountTotal: calc.discountTotal,
            serviceChargeTotal: calc.serviceChargeTotal,
            taxTotal: calc.taxTotal,
            rounding: calc.rounding,
            grandTotal: calc.grandTotal,
            status: BillStatus.PAID,
            paymentMethod: input.paymentMethod,
            settledBy: input.settledByStaffId || null,
            settlementReference: input.settlementReference || null,
            paidAt: now,
          },
        });
      } else {
        const billNumber = `PNB-${Date.now().toString().slice(-6)}`;
        settledBill = await tx.bill.create({
          data: {
            billNumber,
            tokenId: token.id,
            tableId: token.tableId!,
            foodSubtotal: calc.foodSubtotal,
            drinkSubtotal: calc.drinkSubtotal,
            merchandiseSubtotal: calc.merchandiseSubtotal,
            subtotal: calc.grossSubtotal,
            discountTotal: calc.discountTotal,
            serviceChargeTotal: calc.serviceChargeTotal,
            taxTotal: calc.taxTotal,
            rounding: calc.rounding,
            grandTotal: calc.grandTotal,
            status: BillStatus.PAID,
            paymentMethod: input.paymentMethod,
            settledBy: input.settledByStaffId || null,
            settlementReference: input.settlementReference || null,
            paidAt: now,
          },
        });
      }

      // 2. Link orders to this bill
      await tx.order.updateMany({
        where: { tokenId: token.id },
        data: { billId: settledBill.id },
      });

      // 3. Mark ONLY active bill-related requests for this checkout as COMPLETED (leave unrelated service requests intact)
      await tx.serviceRequest.updateMany({
        where: {
          tokenId: token.id,
          type: { in: [ServiceRequestType.BILL_REQUEST, ServiceRequestType.BILL_ASSISTANCE] },
          status: { in: [ServiceRequestStatus.NEW, ServiceRequestStatus.ACKNOWLEDGED] },
        },
        data: {
          status: ServiceRequestStatus.COMPLETED,
          completedAt: now,
          assignedStaffId: input.settledByStaffId || undefined,
        },
      });

      // 4. Close Token
      await tx.token.update({
        where: { id: token.id },
        data: {
          status: 'CLOSED',
          closedAt: now,
          closedBy: input.settledByStaffId || null,
          closeReason: CloseReason.CHECKOUT,
          paymentVerified: true,
          paymentConfirmedAt: now,
          paymentConfirmedBy: input.settledByStaffId || null,
        },
      });

      // 5. Release Table
      if (token.tableId) {
        await tx.table.update({
          where: { id: token.tableId },
          data: {
            status: 'available',
            currentTokenId: null,
            occupiedSince: null,
          },
        });

        // 6. Finalize Table Occupancy Log
        const activeOccupancies = await tx.tableOccupancyLog.findMany({
          where: {
            tableId: token.tableId,
            tokenId: token.id,
            vacatedAt: null,
          },
        });

        for (const occ of activeOccupancies) {
          const durationMinutes = Math.max(
            1,
            Math.round((now.getTime() - new Date(occ.occupiedAt).getTime()) / (1000 * 60))
          );
          await tx.tableOccupancyLog.update({
            where: { id: occ.id },
            data: {
              vacatedAt: now,
              durationMinutes,
            },
          });
        }
      }

      return {
        bill: settledBill,
        turnoverStatus: 'TABLE_RELEASED_AND_SESSION_CLOSED',
      };
    });

    if (result.bill && result.turnoverStatus === 'TABLE_RELEASED_AND_SESSION_CLOSED') {
      try {
        broadcastBillSettled({
          billId: result.bill.id,
          billNumber: result.bill.billNumber,
          tokenId: result.bill.tokenId,
          tokenNumber: calc.tokenNumber,
          tableId: result.bill.tableId,
          grandTotal: Number(result.bill.grandTotal),
          status: result.bill.status,
          paymentMethod: result.bill.paymentMethod || 'CASH',
          paidAt: result.bill.paidAt ? result.bill.paidAt.toISOString() : new Date().toISOString(),
        });

        broadcastTableUpdated({
          tableId: result.bill.tableId,
          tableNumber: calc.tableNumber,
          status: 'available',
          currentTokenId: null,
          occupiedSince: null,
          updatedAt: new Date().toISOString(),
        });

        broadcastTableSessionClosed({
          tableId: result.bill.tableId,
          tableNumber: calc.tableNumber,
          tokenNumber: calc.tokenNumber,
          closedAt: result.bill.paidAt ? result.bill.paidAt.toISOString() : new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Real-time bill settlement broadcast error:', err);
      }
    }

    return result;
  }

  /**
   * Fetch active bills and tables awaiting bill settlement
   */
  async getActiveBills() {
    // 1. Bills in REQUESTED status for active dining tokens
    const requestedBills = await prisma.bill.findMany({
      where: {
        status: BillStatus.REQUESTED,
        token: { status: { in: ['ACTIVE', 'EXTENDED'] } },
      },
      include: {
        table: true,
        token: {
          include: {
            customer: true,
            placeType: true,
          },
        },
        orders: {
          include: { items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const activeList: any[] = [];
    const processedTableIds = new Set<string>();

    for (const b of requestedBills) {
      processedTableIds.add(b.tableId);
      const allItems: any[] = [];
      b.orders.forEach((o) => {
        allItems.push(...o.items);
      });

      const unservedCount = allItems.filter(
        (it) => it.status !== 'SERVED' && it.status !== 'CANCELLED'
      ).length;

      activeList.push({
        id: b.id,
        billNumber: b.billNumber,
        tableId: b.tableId,
        tableNumber: b.table?.tableNumber || 'N/A',
        placeType: b.token?.placeType?.name || '',
        tokenId: b.tokenId,
        tokenNumber: b.token?.tokenNumber || '',
        customerName: b.token?.customer?.name || 'Guest',
        customerPhone: b.token?.customer?.phoneNumber || '',
        personsCount: b.token?.personsCount || b.table?.capacity || 2,
        itemCount: allItems.length,
        unservedCount,
        foodSubtotal: Number(b.foodSubtotal),
        drinkSubtotal: Number(b.drinkSubtotal),
        subtotal: Number(b.subtotal),
        serviceChargeTotal: Number(b.serviceChargeTotal),
        taxTotal: Number(b.taxTotal),
        discountTotal: Number(b.discountTotal),
        rounding: Number(b.rounding),
        grandTotal: Number(b.grandTotal),
        status: b.status,
        requestedAt: b.createdAt.toISOString(),
      });
    }

    // 2. Tables in BILL_REQUESTED or SETTLING status that may not have a Bill record yet
    const billRequestedTables = await prisma.table.findMany({
      where: {
        status: { in: ['BILL_REQUESTED', 'SETTLING'] },
        id: { notIn: Array.from(processedTableIds) },
      },
      include: {
        placeType: true,
        tokens: {
          where: { status: { in: ['ACTIVE', 'EXTENDED'] } },
          include: {
            customer: true,
            placeType: true,
          },
          take: 1,
        },
      },
    });

    for (const t of billRequestedTables) {
      const activeToken = t.tokens?.[0];
      if (!activeToken) continue;

      try {
        const calc = await this.calculateBill(activeToken.tokenNumber);
        const unservedCount = (calc.items || []).filter(
          (it: any) => it.status !== 'SERVED' && it.status !== 'CANCELLED'
        ).length;

        activeList.push({
          id: `tbl-${t.id}`,
          billNumber: `BILL-${t.tableNumber}`,
          tableId: t.id,
          tableNumber: t.tableNumber,
          placeType: t.placeType?.name || '',
          tokenId: activeToken.id,
          tokenNumber: activeToken.tokenNumber,
          customerName: activeToken.customer?.name || 'Guest',
          customerPhone: activeToken.customer?.phoneNumber || '',
          personsCount: activeToken.personsCount || t.capacity || 2,
          itemCount: calc.items?.length || 0,
          unservedCount,
          foodSubtotal: Number(calc.foodSubtotal),
          drinkSubtotal: Number(calc.drinkSubtotal),
          subtotal: Number(calc.grossSubtotal),
          serviceChargeTotal: Number(calc.serviceChargeTotal),
          taxTotal: Number(calc.taxTotal),
          discountTotal: Number(calc.discountTotal),
          rounding: Number(calc.rounding),
          grandTotal: Number(calc.grandTotal),
          status: 'REQUESTED',
          requestedAt: t.updatedAt ? t.updatedAt.toISOString() : new Date().toISOString(),
        });
      } catch (err) {
        console.warn(`Could not calculate bill preview for table ${t.tableNumber}:`, err);
      }
    }

    // Sort by requestedAt ascending (longest waiting request appears first for waiter priority)
    activeList.sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime());

    return activeList;
  }

  /**
   * Fetch settled bills (PAID status) with real historical audit data
   */
  async getSettledBills(limit = 50) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [todayCount, todayRevenueAgg, bills] = await Promise.all([
      prisma.bill.count({
        where: {
          status: BillStatus.PAID,
          paidAt: { gte: startOfToday },
        },
      }),
      prisma.bill.aggregate({
        where: {
          status: BillStatus.PAID,
          paidAt: { gte: startOfToday },
        },
        _sum: { grandTotal: true },
      }),
      prisma.bill.findMany({
        where: { status: BillStatus.PAID },
        include: {
          table: true,
          token: {
            include: { customer: true },
          },
          settler: {
            select: { id: true, username: true, fullName: true },
          },
        },
        orderBy: { paidAt: 'desc' },
        take: limit,
      }),
    ]);

    const formattedBills = bills.map((b) => ({
      id: b.id,
      billNumber: b.billNumber,
      tableNumber: b.table?.tableNumber || 'N/A',
      tokenNumber: b.token?.tokenNumber || '',
      customerName: b.token?.customer?.name || 'Guest',
      customerPhone: b.token?.customer?.phoneNumber || '',
      grandTotal: Number(b.grandTotal),
      paymentMethod: b.paymentMethod || 'CASH',
      settlementReference: b.settlementReference || '',
      paidAt: b.paidAt ? b.paidAt.toISOString() : b.createdAt.toISOString(),
      settledBy: b.settler?.fullName || b.settler?.username || 'Staff',
      status: b.status,
    }));

    return {
      bills: formattedBills,
      summary: {
        completedTodayCount: todayCount,
        completedTodayRevenue: Number(todayRevenueAgg._sum.grandTotal || 0),
      },
    };
  }
}

export const billingService = new BillingService();
