import { PrismaClient, ServiceRequestType, ServiceRequestStatus } from '@prisma/client';
import { broadcastServiceRequestCreated, broadcastServiceRequestUpdated } from '../realtime';

const prisma = new PrismaClient();

export class ServiceRequestService {
  private normalizeType(type: any): ServiceRequestType {
    const raw = String(type || '').toUpperCase().trim();
    if (raw === 'WATER') return ServiceRequestType.WATER;
    if (raw === 'CUTLERY') return ServiceRequestType.CUTLERY;
    if (raw === 'NAPKINS') return ServiceRequestType.NAPKINS;
    if (raw === 'CLEAN_UP') return ServiceRequestType.CLEAN_UP;
    if (raw === 'BILL' || raw === 'BILL_REQUEST') return ServiceRequestType.BILL_REQUEST;
    if (raw === 'BILL_ASSISTANCE') return ServiceRequestType.BILL_ASSISTANCE;
    if (raw === 'ORDER_ASSISTANCE' || raw === 'ASSISTANCE') return ServiceRequestType.ORDER_ASSISTANCE;
    if (raw === 'OTHER') return ServiceRequestType.OTHER;
    return ServiceRequestType.ORDER_ASSISTANCE;
  }

  /**
   * Submit a customer service request with authoritative de-duplication
   */
  async createRequest(input: {
    tokenNumber: string;
    tableId?: string;
    type: ServiceRequestType | string;
    note?: string;
  }) {
    const token = await prisma.token.findUnique({
      where: { tokenNumber: input.tokenNumber },
      include: { table: true },
    });

    if (!token) {
      throw new Error('Table session not found. Please scan your table QR code.');
    }

    if (token.status !== 'ACTIVE' && token.status !== 'EXTENDED') {
      throw new Error('Cannot request service. This table session is no longer active.');
    }

    const tableId = input.tableId || token.tableId;
    if (!tableId || !token.table) {
      throw new Error('No active table assigned to this session.');
    }

    const normalizedType = this.normalizeType(input.type);

    // Authoritative Atomic Active Request De-duplication Check
    // Prevent duplicate waiter alerts if an open request (NEW) already exists for this table session and type
    const result = await prisma.$transaction(async (tx) => {
      const existingActive = await tx.serviceRequest.findFirst({
        where: {
          tokenId: token.id,
          type: normalizedType,
          status: ServiceRequestStatus.NEW,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingActive) {
        return {
          ...existingActive,
          isDuplicate: true,
          alreadyActive: true,
          message: 'You have already requested assistance. Your waiter has been notified and will acknowledge your request.',
        };
      }

      const created = await tx.serviceRequest.create({
        data: {
          tokenId: token.id,
          tableId,
          tableNumber: token.table.tableNumber,
          type: normalizedType,
          note: input.note || null,
          status: ServiceRequestStatus.NEW,
        },
      });

      return {
        ...created,
        isDuplicate: false,
        alreadyActive: false,
        message: 'Waiter has been notified.',
      };
    });

    // Broadcast service_request.created in real-time ONLY for genuine new requests
    if (!result.isDuplicate) {
      try {
        broadcastServiceRequestCreated({
          id: result.id,
          tokenId: token.id,
          tokenNumber: token.tokenNumber,
          tableId,
          tableNumber: token.table.tableNumber,
          type: result.type,
          note: result.note,
          status: result.status,
          createdAt: result.createdAt ? result.createdAt.toISOString() : new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Real-time service request broadcast error:', err);
      }
    }

    return result;
  }

  /**
   * Get all active service requests (optionally filtered by tokenNumber)
   */
  async getActiveRequests(tokenNumber?: string) {
    const where: any = {
      status: { in: [ServiceRequestStatus.NEW, ServiceRequestStatus.ACKNOWLEDGED] },
    };

    if (tokenNumber) {
      where.token = { tokenNumber };
    }

    return prisma.serviceRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        table: true,
        token: true,
        assignedStaff: {
          select: { id: true, username: true, fullName: true },
        },
      },
    });
  }

  /**
   * Acknowledge or Complete a service request
   */
  async updateStatus(requestId: string, status: ServiceRequestStatus, staffUserId?: string) {
    const data: any = { status };
    const now = new Date();

    if (status === ServiceRequestStatus.ACKNOWLEDGED) {
      data.acknowledgedAt = now;
      if (staffUserId) data.assignedStaffId = staffUserId;
    } else if (status === ServiceRequestStatus.COMPLETED) {
      data.completedAt = now;
    }

    const updated = await prisma.serviceRequest.update({
      where: { id: requestId },
      data,
      include: {
        token: true,
        assignedStaff: {
          select: { id: true, username: true, fullName: true },
        },
      },
    });

    // Broadcast service_request.updated in real-time
    try {
      broadcastServiceRequestUpdated({
        id: updated.id,
        tokenId: updated.tokenId,
        tokenNumber: updated.token?.tokenNumber || '',
        tableId: updated.tableId,
        tableNumber: updated.tableNumber,
        type: updated.type,
        status: updated.status,
        assignedStaffId: updated.assignedStaffId,
        assignedStaffName: updated.assignedStaff?.fullName || updated.assignedStaff?.username || null,
        assignedStaffUsername: updated.assignedStaff?.username || null,
        assignedStaff: updated.assignedStaff
          ? {
              id: updated.assignedStaff.id,
              fullName: updated.assignedStaff.fullName,
              username: updated.assignedStaff.username,
            }
          : null,
        acknowledgedAt: updated.acknowledgedAt ? updated.acknowledgedAt.toISOString() : null,
        completedAt: updated.completedAt ? updated.completedAt.toISOString() : null,
        updatedAt: now.toISOString(),
      });
    } catch (err) {
      console.warn('Real-time service request status broadcast error:', err);
    }

    return updated;
  }
}

export const serviceRequestService = new ServiceRequestService();
