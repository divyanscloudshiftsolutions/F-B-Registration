import { PrismaClient, ServiceRequestType, ServiceRequestStatus } from '@prisma/client';

const prisma = new PrismaClient();

export class ServiceRequestService {
  /**
   * Submit a customer service request with 3-minute de-duplication
   */
  async createRequest(input: {
    tokenNumber: string;
    tableId?: string;
    type: ServiceRequestType;
    note?: string;
  }) {
    const token = await prisma.token.findUnique({
      where: { tokenNumber: input.tokenNumber },
      include: { table: true },
    });

    if (!token) {
      throw new Error(`Token ${input.tokenNumber} not found`);
    }

    if (token.status !== 'ACTIVE' && token.status !== 'EXTENDED') {
      throw new Error(`Cannot call service. Token is in ${token.status} status`);
    }

    const tableId = input.tableId || token.tableId;
    if (!tableId || !token.table) {
      throw new Error(`No active table associated with token ${input.tokenNumber}`);
    }

    // 3-Minute De-duplication Check
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    const existingRecent = await prisma.serviceRequest.findFirst({
      where: {
        tokenId: token.id,
        type: input.type,
        status: { in: [ServiceRequestStatus.NEW, ServiceRequestStatus.ACKNOWLEDGED] },
        createdAt: { gte: threeMinutesAgo },
      },
    });

    if (existingRecent) {
      return {
        ...existingRecent,
        isDuplicate: true,
        message: `Your request for ${input.type} is already registered with our staff.`,
      };
    }

    const created = await prisma.serviceRequest.create({
      data: {
        tokenId: token.id,
        tableId,
        tableNumber: token.table.tableNumber,
        type: input.type,
        note: input.note || null,
        status: ServiceRequestStatus.NEW,
      },
    });

    return {
      ...created,
      isDuplicate: false,
      message: `Request for ${input.type} received. Staff alerted.`,
    };
  }

  /**
   * Get all active service requests
   */
  async getActiveRequests() {
    return prisma.serviceRequest.findMany({
      where: {
        status: { in: [ServiceRequestStatus.NEW, ServiceRequestStatus.ACKNOWLEDGED] },
      },
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

    return prisma.serviceRequest.update({
      where: { id: requestId },
      data,
    });
  }
}

export const serviceRequestService = new ServiceRequestService();
