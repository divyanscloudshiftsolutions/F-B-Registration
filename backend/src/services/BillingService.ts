import { PrismaClient, BillStatus, PaymentMethod, CloseReason } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { broadcastBillSettled, broadcastTableUpdated, broadcastTableSessionClosed } from '../realtime';

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
            items: true,
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
              items: true,
            },
          },
        },
      });
    }

    if (!token) {
      throw new Error(`Token ${tokenNumberOrId} not found`);
    }

    // 1. Calculate Section Subtotals from all non-cancelled order items
    let foodSubtotal = new Decimal(0);
    let drinkSubtotal = new Decimal(0);
    let merchandiseSubtotal = new Decimal(0);
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
          station: item.station,
          status: item.status,
        });
      }
    }

    const grossSubtotal = foodSubtotal.plus(drinkSubtotal).plus(merchandiseSubtotal);
    const discountTotal = new Decimal(0); // Optional promo discounts

    // 2. Taxes & Charges (5% SC + 5% GST default)
    const serviceChargeRate = new Decimal(0.05);
    const gstRate = new Decimal(0.05);

    const discountedSubtotal = Decimal.max(new Decimal(0), grossSubtotal.minus(discountTotal));
    const serviceChargeTotal = discountedSubtotal.times(serviceChargeRate).toDecimalPlaces(2);
    const taxableAmount = discountedSubtotal.plus(serviceChargeTotal);
    const taxTotal = taxableAmount.times(gstRate).toDecimalPlaces(2);

    const grossPayable = taxableAmount.plus(taxTotal);

    // 3. Redemption Entitlement Offset (Entitlement from entry fee, applied against eligible drinks)
    const entryFeePaid = new Decimal(token.amountPaid);
    // Eligible redemption is the minimum of entry fee and drink subtotal
    const redemptionDeduction = Decimal.min(entryFeePaid, drinkSubtotal).toDecimalPlaces(2);

    // 4. Final Balance & Cash Rounding
    const netBeforeRounding = Decimal.max(new Decimal(0), grossPayable.minus(redemptionDeduction));
    const roundedFinalPayable = new Decimal(Math.round(netBeforeRounding.toNumber()));
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
   * Settle Bill, collect remaining payment, and trigger complete table turnover
   */
  async settleBill(input: {
    tokenNumberOrId: string;
    paymentMethod: PaymentMethod;
    settledByStaffId?: string;
    settlementReference?: string;
  }) {
    const calc = await this.calculateBill(input.tokenNumberOrId);

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
      const billNumber = `PNB-${Date.now().toString().slice(-6)}`;

      // 1. Create or Update Bill Record
      const createdBill = await tx.bill.create({
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

      // 2. Link orders to this bill
      await tx.order.updateMany({
        where: { tokenId: token.id },
        data: { billId: createdBill.id },
      });

      // 3. Close Token
      await tx.token.update({
        where: { id: token.id },
        data: {
          status: 'CLOSED',
          closedAt: now,
          closedBy: input.settledByStaffId || null,
          closeReason: CloseReason.CHECKOUT,
        },
      });

      // 4. Release Table
      if (token.tableId) {
        await tx.table.update({
          where: { id: token.tableId },
          data: {
            status: 'available',
            currentTokenId: null,
            occupiedSince: null,
          },
        });

        // 5. Finalize Table Occupancy Log
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
        bill: createdBill,
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
}

export const billingService = new BillingService();
