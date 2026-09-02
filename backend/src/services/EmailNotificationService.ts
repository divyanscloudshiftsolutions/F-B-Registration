import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const apiURL = process.env.NOTIFICATION_API_URL || 'https://notificationservice-virid.vercel.app/api/email/send';

export interface EmailJob {
  to: string;
  tokenNumber: string;
  customerName: string;
  attemptCount: number;
  type?: 'ENTRY_PASS' | 'EXTENSION';
  tableNumber?: string;
  extraMinutes?: number;
  newEndTime?: string;
  additionalAmount?: number;
  paymentMethod?: string;
}

export class EmailNotificationService {
  private static instance: EmailNotificationService;
  private queue: EmailJob[] = [];
  private isProcessing: boolean = false;

  private constructor() {}

  static getInstance(): EmailNotificationService {
    if (!EmailNotificationService.instance) {
      EmailNotificationService.instance = new EmailNotificationService();
    }
    return EmailNotificationService.instance;
  }

  /**
   * Enqueues an email dispatch job in the background (non-blocking)
   */
  enqueueEmailJob(to: string, tokenNumber: string, customerName: string): void {
    const job: EmailJob = {
      to,
      tokenNumber,
      customerName,
      attemptCount: 0,
      type: 'ENTRY_PASS'
    };
    this.queue.push(job);
    console.info(`[Email Queue] Enqueued email job for ${to} (token: ${tokenNumber})`);
    
    // Trigger queue processing asynchronously
    this.processQueue();
  }



  /**
   * Enqueues a session extension notification email
   */
  enqueueExtensionEmailJob(
    to: string,
    tokenNumber: string,
    customerName: string,
    tableNumber: string,
    extraMinutes: number,
    newEndTime: Date,
    additionalAmount: number,
    paymentMethod: string
  ): void {
    const job: EmailJob = {
      to,
      tokenNumber,
      customerName,
      attemptCount: 0,
      type: 'EXTENSION',
      tableNumber,
      extraMinutes,
      newEndTime: newEndTime.toISOString(),
      additionalAmount,
      paymentMethod
    };
    this.queue.push(job);
    console.info(`[Email Queue] Enqueued extension email job for ${to} (token: ${tokenNumber}, extra: ${extraMinutes} mins)`);
    this.processQueue();
  }

  /**
   * Background worker loop
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) continue;

      try {
        await this.executeJob(job);
      } catch (err: any) {
        console.error(`[Email Worker] Job execution failed: ${err.message}`);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Executes a single email job with validation, HTML sanitization, and retries
   */
  private async executeJob(job: EmailJob): Promise<void> {
    const { to, tokenNumber, customerName } = job;
    
    // 1. Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      await this.logFailure(job, 'INVALID_EMAIL_FORMAT', 'Recipient email format is invalid');
      return;
    }

    // Resolve the token details from database to see delivery mode and sign payload
    const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const accessUrl = `${frontendBaseUrl}/customer/access/${tokenNumber}`;
    let qrData = accessUrl;
    let personsCount = 1;
    let placeTypeName = 'Standing Bar';
    let tableNumber = 'Pending';
    try {
      const tokenRecord = await prisma.token.findUnique({
        where: { tokenNumber },
        include: {
          customer: true,
          placeType: true,
          table: true
        }
      });
      if (tokenRecord) {
        personsCount = tokenRecord.personsCount;
        placeTypeName = tokenRecord.placeType.name.replace(/_/g, ' ');
        tableNumber = tokenRecord.table ? tokenRecord.table.tableNumber : 'Pending';
      }
    } catch (e: any) {
      console.warn(`[Email Worker] Failed to check token details, falling back to defaults: ${e.message}`);
    }

    let subject = 'Welcome to Pegs N Bottles — Your Digital Table Pass';
    let rawHtml = '';

    if (job.type === 'EXTENSION') {
      subject = 'Session Extension — Pegs N Bottles';
      const formattedEndTime = job.newEndTime ? new Date(job.newEndTime).toLocaleString() : 'N/A';
      rawHtml = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <h2 style="color: #8D6CE5; margin-bottom: 16px; font-weight: 800;">Session Extension Confirmed</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.5;">Dear ${customerName || 'Customer'},</p>
          <p style="color: #475569; font-size: 14px; line-height: 1.5;">Your dining session at Pegs N Bottles has been extended. You can continue ordering directly from your phone below:</p>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${accessUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #8D6CE5 0%, #6366F1 100%); color: #ffffff; text-decoration: none; font-weight: bold; font-size: 16px; padding: 14px 28px; border-radius: 12px; box-shadow: 0 4px 14px rgba(141, 108, 229, 0.4);">
              Resume Table Experience
            </a>
          </div>

          <div style="text-align: center; margin: 25px 0; padding: 20px; background-color: #f8fafc; border-radius: 12px;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(accessUrl)}" alt="QR Code" style="border: 4px solid #8D6CE5; border-radius: 12px; max-width: 220px; height: auto;" />
            <p style="color: #64748b; font-size: 12px; margin-top: 10px; margin-bottom: 0;">Scan to access ordering on your smartphone</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: bold;">Token Number:</td>
              <td style="padding: 10px 0; color: #111827; font-size: 14px; text-align: right; font-family: monospace; font-weight: bold;">${tokenNumber}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: bold;">Assigned Table:</td>
              <td style="padding: 10px 0; color: #111827; font-size: 14px; text-align: right; font-weight: bold;">${job.tableNumber || tableNumber}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: bold;">Extension Duration:</td>
              <td style="padding: 10px 0; color: #111827; font-size: 14px; text-align: right;">+${job.extraMinutes} Minutes</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: bold;">New End Time:</td>
              <td style="padding: 10px 0; color: #111827; font-size: 14px; text-align: right; font-weight: bold;">${formattedEndTime}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: bold;">Additional Amount:</td>
              <td style="padding: 10px 0; color: #111827; font-size: 14px; text-align: right;">₹${job.additionalAmount}</td>
            </tr>
          </table>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px;">
            <p>Pegs N Bottles — Thank you for visiting.</p>
          </div>
        </div>
      `;
    } else {
      rawHtml = `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #8D6CE5 0%, #6366F1 100%); color: #ffffff; font-size: 22px; font-weight: 900; line-height: 44px; text-align: center;">P</div>
            <h2 style="color: #111827; margin: 12px 0 4px 0; font-weight: 800; font-size: 22px;">Welcome to Pegs N Bottles</h2>
            <p style="color: #64748b; font-size: 14px; margin: 0;">Your Digital Dining Pass & Self-Order Hub</p>
          </div>

          <p style="color: #475569; font-size: 15px; line-height: 1.5;">Dear <strong>${customerName || 'Guest'}</strong>,</p>
          <p style="color: #475569; font-size: 14px; line-height: 1.5;">Your check-in is complete! Tap the button below on your smartphone to start browsing the food & drink menu, ordering, and calling for assistance directly from your table:</p>
          
          <div style="text-align: center; margin: 28px 0 20px 0;">
            <a href="${accessUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #8D6CE5 0%, #6366F1 100%); color: #ffffff; text-decoration: none; font-weight: 800; font-size: 16px; padding: 15px 32px; border-radius: 14px; box-shadow: 0 4px 16px rgba(141, 108, 229, 0.4);">
              Open Your Table Experience
            </a>
            <p style="color: #64748b; font-size: 12px; margin-top: 10px;">No app download required. Opens instantly on your phone browser.</p>
          </div>

          <div style="text-align: center; margin: 20px 0; padding: 20px; background-color: #f8fafc; border-radius: 14px; border: 1px dashed #cbd5e1;">
            <p style="color: #8D6CE5; font-size: 13px; font-weight: bold; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">Or Scan QR Code with Phone Camera</p>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(accessUrl)}" alt="Access QR Code" style="border: 4px solid #8D6CE5; border-radius: 12px; max-width: 200px; height: auto;" />
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-top: 24px;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; color: #64748b; font-size: 13px; font-weight: bold;">Token Number:</td>
              <td style="padding: 10px 0; color: #111827; font-size: 13px; text-align: right; font-family: monospace; font-weight: bold;">${tokenNumber}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; color: #64748b; font-size: 13px; font-weight: bold;">Seating Area:</td>
              <td style="padding: 10px 0; color: #111827; font-size: 13px; text-align: right;">${placeTypeName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; color: #64748b; font-size: 13px; font-weight: bold;">Party Size:</td>
              <td style="padding: 10px 0; color: #111827; font-size: 13px; text-align: right;">${personsCount} Person(s)</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; color: #64748b; font-size: 13px; font-weight: bold;">Assigned Table:</td>
              <td style="padding: 10px 0; color: #8D6CE5; font-size: 14px; text-align: right; font-weight: 800;">Table ${tableNumber}</td>
            </tr>
          </table>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px;">
            <p>Pegs N Bottles — Have a wonderful dining experience.</p>
          </div>
        </div>
      `;
    }

    // 2. HTML Sanitization
    const sanitizedHtml = this.sanitizeHtml(rawHtml);
    const bodyText = `Your digital check-in has been successfully completed. Token: ${tokenNumber}.`;

    // 3. API Dispatch with x-api-key authentication
    const apiKey = process.env.NOTIFICATION_API_KEY || '';
    const isTesting = process.env.NODE_ENV === 'test';
    const sendRealEmails = process.env.SEND_REAL_EMAILS !== 'false' && !isTesting;

    if (!sendRealEmails) {
      console.warn(`[Email Worker] Email dispatch to ${to} (token: ${tokenNumber}) skipped. Real emails are disabled in environment.`);
      return;
    }

    try {
      const response = await fetch(apiURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({
          to,
          subject,
          bodyHtml: sanitizedHtml,
          bodyText
        })
      });

      if (response.ok) {
        // Success database updates
        await prisma.token.update({
          where: { tokenNumber },
          data: {
            emailSent: true,
            emailSentAt: new Date(),
            emailDeliveryStatus: 'SENT'
          }
        }).catch(() => {});

        // Success audit log
        await prisma.syncLog.create({
          data: {
            operationId: `EMAIL-SUCCESS-${tokenNumber}-${Date.now()}`,
            deviceId: 'SERVER-NOTIFICATION-WORKER',
            operationType: 'EMAIL_NOTIFICATION',
            payload: { recipient: to, tokenNumber, attemptCount: job.attemptCount, status: 'SUCCESS' },
            status: 'SUCCESS'
          }
        }).catch(() => {});
        console.info(`[Email Worker] Successfully sent email to ${to} for token ${tokenNumber}`);
      } else {
        const errorText = await response.text().catch(() => 'No error response body');
        throw new Error(`Notification service returned ${response.status}: ${errorText}`);
      }
    } catch (err: any) {
      console.warn(`[Email Worker] Attempt ${job.attemptCount + 1} failed: ${err.message}`);
      job.attemptCount += 1;

      if (job.attemptCount < 3) {
        // Exponential backoff delay: 1s, 2s, 4s...
        const delayMs = 1000 * Math.pow(2, job.attemptCount);
        console.info(`[Email Worker] Scheduling retry in ${delayMs}ms...`);
        
        setTimeout(() => {
          this.queue.push(job);
          this.processQueue();
        }, delayMs);
      } else {
        // Final failure database update
        await prisma.token.update({
          where: { tokenNumber },
          data: {
            emailDeliveryStatus: 'FAILED'
          }
        }).catch(() => {});

        // Final failure audit logging
        await this.logFailure(job, 'MAX_RETRIES_EXCEEDED', `Failed to send notification after 3 attempts. Error: ${err.message}`);
      }
    }
  }

  /**
   * Helper to strip dangerous HTML structures (sanitization)
   */
  private sanitizeHtml(html: string): string {
    return html
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '') // Strip script blocks
      .replace(/on\w+="[^"]*"/g, '') // Strip inline event handlers
      .replace(/on\w+='[^']*'/g, '')
      .replace(/javascript:[^\s"']*/gi, ''); // Strip javascript URIs
  }

  /**
   * Logs a failed operation in sync_logs table
   */
  private async logFailure(job: EmailJob, errorCode: string, message: string): Promise<void> {
    console.error(`[Email Worker] Final notification failure for ${job.to} (token: ${job.tokenNumber}): ${message}`);
    await prisma.syncLog.create({
      data: {
        operationId: `EMAIL-FAILURE-${job.tokenNumber}-${Date.now()}`,
        deviceId: 'SERVER-NOTIFICATION-WORKER',
        operationType: 'EMAIL_NOTIFICATION',
        payload: { recipient: job.to, tokenNumber: job.tokenNumber, attemptCount: job.attemptCount, status: 'FAILED' },
        status: 'ERROR',
        conflictReason: `${errorCode}: ${message}`
      }
    }).catch(() => {});
  }
}

export const emailNotificationService = EmailNotificationService.getInstance();
export default emailNotificationService;
