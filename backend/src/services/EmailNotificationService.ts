import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import redisService from './RedisService';

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
    let isPremium = false;
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
        isPremium = tokenRecord.placeType.name === 'PREMIUM_LOUNGE';
        tableNumber = tokenRecord.table ? tokenRecord.table.tableNumber : (isPremium ? 'Pending' : 'Standing Bar');
      }
    } catch (e: any) {
      console.warn(`[Email Worker] Failed to check token details, falling back to defaults: ${e.message}`);
    }

    // Fetch existing 6-digit access code for this token, or generate a new one if not yet created
    let accessCode: string | null = null;
    try {
      accessCode = await redisService.get(`token-code:${tokenNumber}`);
    } catch (e: any) {
      console.warn(`[Email Worker] Could not fetch cached token-code: ${e.message}`);
    }

    if (!accessCode || !/^\d{6}$/.test(accessCode)) {
      accessCode = Math.floor(100000 + Math.random() * 900000).toString();
    }

    try {
      // 30 days TTL so active session codes never expire or conflict
      await redisService.setex(`customer-code:${accessCode}`, 86400 * 30, tokenNumber);
      await redisService.setex(`token-code:${tokenNumber}`, 86400 * 30, accessCode);
    } catch (e: any) {
      console.warn(`[Email Worker] Could not cache access code in redis: ${e.message}`);
    }

    let subject = isPremium
      ? 'Your Table Access is Ready — Pegs N Bottles'
      : 'Your Entry Pass is Ready — Pegs N Bottles';
    let rawHtml = '';

    if (job.type === 'EXTENSION') {
      subject = 'Session Extension Confirmed — Pegs N Bottles';
      const formattedEndTime = job.newEndTime ? new Date(job.newEndTime).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }) : 'N/A';
      
      if (isPremium) {
        rawHtml = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Session Extension Confirmed — Pegs N Bottles</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #0A0A0E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
            <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;">
              Your dining session is extended (+${job.extraMinutes} mins). Access code: ${accessCode}. Table: ${job.tableNumber || tableNumber}.
            </div>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0A0A0E; width: 100%; padding: 36px 12px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%; background-color: #13131B; border: 1px solid #262638; border-radius: 20px; overflow: hidden; box-shadow: 0 16px 48px rgba(0,0,0,0.65);">
                    
                    <!-- 1. Pegs N Bottles Brand Header -->
                    <tr>
                      <td style="padding: 36px 32px 24px 32px; text-align: center; background: linear-gradient(180deg, #1C1C28 0%, #13131B 100%); border-bottom: 1px solid #232334;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                          <tr>
                            <td align="center">
                              <div style="width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, #8D6CE5 0%, #5B45BA 100%); color: #FFFFFF; font-size: 26px; font-weight: 900; line-height: 52px; text-align: center; display: inline-block; box-shadow: 0 6px 20px rgba(141, 108, 229, 0.4); border: 1px solid rgba(255,255,255,0.15);">P</div>
                            </td>
                          </tr>
                        </table>
                        <h1 style="margin: 16px 0 4px 0; font-size: 20px; font-weight: 800; letter-spacing: 3.5px; color: #FFFFFF; text-transform: uppercase;">Pegs N Bottles</h1>
                        <p style="margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #D4AF37; text-transform: uppercase;">Session Extension Confirmed</p>
                      </td>
                    </tr>

                    <!-- 2. Natural Greeting -->
                    <tr>
                      <td style="padding: 30px 32px 20px 32px; text-align: center;">
                        <h2 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.3px;">Session Extended</h2>
                        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #94A3B8;">
                          Dear <strong style="color: #F1F5F9;">${customerName || 'Guest'}</strong>, your dining session at Pegs N Bottles has been extended by <strong style="color: #A78BFA;">+${job.extraMinutes} minutes</strong>. Continue ordering and enjoying your table experience.
                        </p>
                      </td>
                    </tr>

                    <!-- 3. Primary Visual Centered QR Code -->
                    <tr>
                      <td style="padding: 0 32px 24px 32px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #181824; border: 1px solid #28283C; border-radius: 16px; padding: 24px 16px; text-align: center;">
                          <tr>
                            <td align="center">
                              <p style="margin: 0 0 14px 0; font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #A78BFA; text-transform: uppercase;">Digital Dining Pass QR</p>
                              <div style="background-color: #FFFFFF; padding: 12px; border-radius: 14px; display: inline-block; box-shadow: 0 4px 20px rgba(0,0,0,0.4);">
                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(accessUrl)}" alt="Dining Pass QR Code" width="160" height="160" style="display: block; width: 160px; height: 160px; border: 0;" />
                              </div>
                              <p style="margin: 12px 0 0 0; font-size: 12px; color: #64748B;">Scan with your phone camera to access your table session</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- 4. Pass / Barcode ID (No Line Wrapping) -->
                    <tr>
                      <td style="padding: 0 32px 20px 32px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #161622; border: 1px solid #262638; border-radius: 12px; padding: 12px 18px;">
                          <tr>
                            <td style="font-size: 12px; font-weight: 600; color: #94A3B8; vertical-align: middle;">
                              Pass ID:
                            </td>
                            <td align="right" style="vertical-align: middle; white-space: nowrap;">
                              <span style="font-family: 'SF Mono', Consolas, Monaco, monospace; font-size: 13px; font-weight: 700; color: #F1F5F9; letter-spacing: 0.5px; white-space: nowrap; word-break: keep-all; display: inline-block; vertical-align: middle;">${tokenNumber}</span>
                              <a href="${accessUrl}?copy=id&id=${tokenNumber}" target="_blank" style="margin-left: 8px; display: inline-block; background-color: #242436; border: 1px solid #383850; color: #A78BFA; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; text-decoration: none; vertical-align: middle; white-space: nowrap;">📋 Copy</a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- 5. 6-Digit Access Code -->
                    <tr>
                      <td style="padding: 0 32px 24px 32px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(180deg, #1B1B2A 0%, #151522 100%); border: 1px solid #32324A; border-radius: 16px; padding: 22px 20px; text-align: center;">
                          <tr>
                            <td>
                              <p style="margin: 0 0 10px 0; font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #D4AF37; text-transform: uppercase;">Table Access Code</p>
                              <div style="background-color: #0B0B10; border: 1px solid #383852; border-radius: 12px; padding: 14px 24px; display: inline-block; margin: 0 auto; box-shadow: inset 0 2px 6px rgba(0,0,0,0.5);">
                                <span style="font-family: 'SF Mono', Consolas, Monaco, monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #FFFFFF; vertical-align: middle; display: inline-block; margin-right: -8px;">${accessCode}</span>
                              </div>
                              <div style="margin-top: 12px;">
                                <a href="${accessUrl}?copy=code&code=${accessCode}" target="_blank" style="display: inline-block; background-color: #262638; border: 1px solid #3E3E58; color: #E2E8F0; font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 8px; text-decoration: none;">📋 Copy Access Code</a>
                              </div>
                              <p style="margin: 10px 0 0 0; font-size: 12px; color: #64748B;">Enter this 6-digit code if prompted on your device</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Primary Customer Portal CTA -->
                    <tr>
                      <td style="padding: 0 32px 28px 32px; text-align: center;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td align="center">
                              <a href="${accessUrl}" target="_blank" style="display: inline-block; width: 100%; max-width: 380px; box-sizing: border-box; background: linear-gradient(135deg, #8D6CE5 0%, #6366F1 100%); background-color: #8D6CE5; color: #FFFFFF; font-size: 15px; font-weight: 800; letter-spacing: 0.5px; text-decoration: none; padding: 16px 28px; border-radius: 12px; text-align: center; box-shadow: 0 6px 20px rgba(141, 108, 229, 0.4);">
                                Enter Your Dining Experience &rarr;
                              </a>
                            </td>
                          </tr>
                        </table>
                        <p style="margin: 10px 0 0 0; font-size: 12px; color: #64748B;">Opens instantly in your phone browser &bull; No app download required</p>
                      </td>
                    </tr>

                    <!-- 6-8. Extension & Table Details Summary Card (Members, Table, Seating Area) -->
                    <tr>
                      <td style="padding: 0 32px 28px 32px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #171722; border: 1px solid #262636; border-radius: 14px; overflow: hidden;">
                          <tr>
                            <td colspan="2" style="padding: 14px 18px; border-bottom: 1px solid #232332; background-color: #1B1B26;">
                              <span style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #94A3B8; text-transform: uppercase;">Extension Summary</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 13px; color: #94A3B8;">Number of Members</td>
                            <td align="right" style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 13px; font-weight: 600; color: #E2E8F0;">${personsCount} ${personsCount === 1 ? 'Guest' : 'Guests'}</td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 13px; color: #94A3B8;">Assigned Table</td>
                            <td align="right" style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 14px; font-weight: 800; color: #D4AF37;">Table ${job.tableNumber || tableNumber}</td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 13px; color: #94A3B8;">Seating Area</td>
                            <td align="right" style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 13px; font-weight: 600; color: #E2E8F0;">${placeTypeName}</td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 13px; color: #94A3B8;">Added Time</td>
                            <td align="right" style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 13px; font-weight: 700; color: #A78BFA;">+${job.extraMinutes} Minutes</td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 13px; color: #94A3B8;">New End Time</td>
                            <td align="right" style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 13px; font-weight: 600; color: #F1F5F9;">${formattedEndTime}</td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 18px; font-size: 13px; color: #94A3B8;">Extension Amount</td>
                            <td align="right" style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #F1F5F9;">₹${job.additionalAmount}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- 9. Premium Thank-You Closing & Footer -->
                    <tr>
                      <td style="padding: 24px 32px 32px 32px; border-top: 1px solid #232334; text-align: center; background-color: #0F0F16;">
                        <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #CBD5E1;">Thank you for dining with us.</p>
                        <p style="margin: 0; font-size: 11px; color: #64748B;">Pegs N Bottles &bull; Premium Hospitality &amp; Bar Experience</p>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;
      } else {
        rawHtml = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Session Extension Confirmed — Pegs N Bottles</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #0A0A0E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
            <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;">
              Your bar session is extended (+${job.extraMinutes} mins). Pass: ${tokenNumber}. Present your QR code at the counter.
            </div>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0A0A0E; width: 100%; padding: 36px 12px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%; background-color: #13131B; border: 1px solid #262638; border-radius: 20px; overflow: hidden; box-shadow: 0 16px 48px rgba(0,0,0,0.65);">
                    
                    <!-- 1. Pegs N Bottles Brand Header -->
                    <tr>
                      <td style="padding: 36px 32px 24px 32px; text-align: center; background: linear-gradient(180deg, #1C1C28 0%, #13131B 100%); border-bottom: 1px solid #232334;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                          <tr>
                            <td align="center">
                              <div style="width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, #8D6CE5 0%, #5B45BA 100%); color: #FFFFFF; font-size: 26px; font-weight: 900; line-height: 52px; text-align: center; display: inline-block; box-shadow: 0 6px 20px rgba(141, 108, 229, 0.4); border: 1px solid rgba(255,255,255,0.15);">P</div>
                            </td>
                          </tr>
                        </table>
                        <h1 style="margin: 16px 0 4px 0; font-size: 20px; font-weight: 800; letter-spacing: 3.5px; color: #FFFFFF; text-transform: uppercase;">Pegs N Bottles</h1>
                        <p style="margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #D4AF37; text-transform: uppercase;">Session Extension Confirmed</p>
                      </td>
                    </tr>

                    <!-- 2. Natural Greeting -->
                    <tr>
                      <td style="padding: 30px 32px 20px 32px; text-align: center;">
                        <h2 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.3px;">Session Extended</h2>
                        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #94A3B8;">
                          Dear <strong style="color: #F1F5F9;">${customerName || 'Guest'}</strong>, your bar session at Pegs N Bottles has been extended by <strong style="color: #A78BFA;">+${job.extraMinutes} minutes</strong>. Please present your pass QR code at the bar counter for beverage redemption.
                        </p>
                      </td>
                    </tr>

                    <!-- 3. Primary Visual Centered QR Code -->
                    <tr>
                      <td style="padding: 0 32px 24px 32px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #181824; border: 1px solid #28283C; border-radius: 16px; padding: 24px 16px; text-align: center;">
                          <tr>
                            <td align="center">
                              <p style="margin: 0 0 14px 0; font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #A78BFA; text-transform: uppercase;">Entry Pass QR Code</p>
                              <div style="background-color: #FFFFFF; padding: 12px; border-radius: 14px; display: inline-block; box-shadow: 0 4px 20px rgba(0,0,0,0.4);">
                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(tokenNumber)}" alt="Entry Pass QR Code" width="160" height="160" style="display: block; width: 160px; height: 160px; border: 0;" />
                              </div>
                              <p style="margin: 12px 0 0 0; font-size: 12px; color: #64748B;">Present to your bartender or server at the bar counter</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- 4. Pass / Barcode ID (No Line Wrapping) -->
                    <tr>
                      <td style="padding: 0 32px 20px 32px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #161622; border: 1px solid #262638; border-radius: 12px; padding: 12px 18px;">
                          <tr>
                            <td style="font-size: 12px; font-weight: 600; color: #94A3B8; vertical-align: middle;">
                              Pass ID:
                            </td>
                            <td align="right" style="vertical-align: middle; white-space: nowrap;">
                              <span style="font-family: 'SF Mono', Consolas, Monaco, monospace; font-size: 13px; font-weight: 700; color: #F1F5F9; letter-spacing: 0.5px; white-space: nowrap; word-break: keep-all; display: inline-block; vertical-align: middle;">${tokenNumber}</span>
                              <a href="${accessUrl}?copy=id&id=${tokenNumber}" target="_blank" style="margin-left: 8px; display: inline-block; background-color: #242436; border: 1px solid #383850; color: #A78BFA; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; text-decoration: none; vertical-align: middle; white-space: nowrap;">📋 Copy</a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- 6-8. Session Details Card (Members, Table/Area, Seating Area) -->
                    <tr>
                      <td style="padding: 0 32px 28px 32px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #171722; border: 1px solid #262636; border-radius: 14px; overflow: hidden;">
                          <tr>
                            <td colspan="2" style="padding: 14px 18px; border-bottom: 1px solid #232332; background-color: #1B1B26;">
                              <span style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #94A3B8; text-transform: uppercase;">Session Details</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 13px; color: #94A3B8;">Number of Members</td>
                            <td align="right" style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 13px; font-weight: 600; color: #E2E8F0;">${personsCount} ${personsCount === 1 ? 'Guest' : 'Guests'}</td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 13px; color: #94A3B8;">Seating Area</td>
                            <td align="right" style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 13px; font-weight: 600; color: #E2E8F0;">${placeTypeName}</td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 13px; color: #94A3B8;">Added Time</td>
                            <td align="right" style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 13px; font-weight: 700; color: #A78BFA;">+${job.extraMinutes} Minutes</td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 13px; color: #94A3B8;">New End Time</td>
                            <td align="right" style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 13px; font-weight: 600; color: #F1F5F9;">${formattedEndTime}</td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 18px; font-size: 13px; color: #94A3B8;">Extension Amount</td>
                            <td align="right" style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #F1F5F9;">₹${job.additionalAmount}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- 9. Premium Thank-You Closing & Footer -->
                    <tr>
                      <td style="padding: 24px 32px 32px 32px; border-top: 1px solid #232334; text-align: center; background-color: #0F0F16;">
                        <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #CBD5E1;">Thank you for visiting Pegs N Bottles.</p>
                        <p style="margin: 0; font-size: 11px; color: #64748B;">Pegs N Bottles &bull; Premium Hospitality &amp; Bar Experience</p>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;
      }
    } else {
      if (isPremium) {
        rawHtml = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your Table Access is Ready — Pegs N Bottles</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #0A0A0E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
            <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;">
              Welcome to Pegs N Bottles! Table: ${tableNumber}. Access code: ${accessCode}. Scan or tap to open menu.
            </div>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0A0A0E; width: 100%; padding: 36px 12px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%; background-color: #13131B; border: 1px solid #262638; border-radius: 20px; overflow: hidden; box-shadow: 0 16px 48px rgba(0,0,0,0.65);">
                    
                    <!-- 1. Pegs N Bottles Brand Header -->
                    <tr>
                      <td style="padding: 36px 32px 24px 32px; text-align: center; background: linear-gradient(180deg, #1C1C28 0%, #13131B 100%); border-bottom: 1px solid #232334;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                          <tr>
                            <td align="center">
                              <div style="width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, #8D6CE5 0%, #5B45BA 100%); color: #FFFFFF; font-size: 26px; font-weight: 900; line-height: 52px; text-align: center; display: inline-block; box-shadow: 0 6px 20px rgba(141, 108, 229, 0.4); border: 1px solid rgba(255,255,255,0.15);">P</div>
                            </td>
                          </tr>
                        </table>
                        <h1 style="margin: 16px 0 4px 0; font-size: 20px; font-weight: 800; letter-spacing: 3.5px; color: #FFFFFF; text-transform: uppercase;">Pegs N Bottles</h1>
                        <p style="margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #D4AF37; text-transform: uppercase;">Digital Dining Pass</p>
                      </td>
                    </tr>

                    <!-- 2. Natural Greeting -->
                    <tr>
                      <td style="padding: 30px 32px 20px 32px; text-align: center;">
                        <h2 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.3px;">Welcome, ${customerName || 'Guest'}</h2>
                        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #94A3B8;">
                          Your table is ready. Use your digital pass below to explore our curated food & beverage menu, customize your order, and request service directly from your phone.
                        </p>
                      </td>
                    </tr>

                    <!-- 3. Primary Visual Centered QR Code -->
                    <tr>
                      <td style="padding: 0 32px 24px 32px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #181824; border: 1px solid #28283C; border-radius: 16px; padding: 24px 16px; text-align: center;">
                          <tr>
                            <td align="center">
                              <p style="margin: 0 0 14px 0; font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #A78BFA; text-transform: uppercase;">Digital Dining Pass QR</p>
                              <div style="background-color: #FFFFFF; padding: 12px; border-radius: 14px; display: inline-block; box-shadow: 0 4px 20px rgba(0,0,0,0.4);">
                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(accessUrl)}" alt="Dining Pass QR Code" width="160" height="160" style="display: block; width: 160px; height: 160px; border: 0;" />
                              </div>
                              <p style="margin: 12px 0 0 0; font-size: 12px; color: #64748B;">Scan with your phone camera to access your table session</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- 4. Pass / Barcode ID (No Line Wrapping) -->
                    <tr>
                      <td style="padding: 0 32px 20px 32px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #161622; border: 1px solid #262638; border-radius: 12px; padding: 12px 18px;">
                          <tr>
                            <td style="font-size: 12px; font-weight: 600; color: #94A3B8; vertical-align: middle;">
                              Pass ID:
                            </td>
                            <td align="right" style="vertical-align: middle; white-space: nowrap;">
                              <span style="font-family: 'SF Mono', Consolas, Monaco, monospace; font-size: 13px; font-weight: 700; color: #F1F5F9; letter-spacing: 0.5px; white-space: nowrap; word-break: keep-all; display: inline-block; vertical-align: middle;">${tokenNumber}</span>
                              <a href="${accessUrl}?copy=id&id=${tokenNumber}" target="_blank" style="margin-left: 8px; display: inline-block; background-color: #242436; border: 1px solid #383850; color: #A78BFA; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; text-decoration: none; vertical-align: middle; white-space: nowrap;">📋 Copy</a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- 5. 6-Digit Access Code -->
                    <tr>
                      <td style="padding: 0 32px 24px 32px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(180deg, #1B1B2A 0%, #151522 100%); border: 1px solid #32324A; border-radius: 16px; padding: 22px 20px; text-align: center;">
                          <tr>
                            <td>
                              <p style="margin: 0 0 10px 0; font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #D4AF37; text-transform: uppercase;">Table Access Code</p>
                              <div style="background-color: #0B0B10; border: 1px solid #383852; border-radius: 12px; padding: 14px 24px; display: inline-block; margin: 0 auto; box-shadow: inset 0 2px 6px rgba(0,0,0,0.5);">
                                <span style="font-family: 'SF Mono', Consolas, Monaco, monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #FFFFFF; vertical-align: middle; display: inline-block; margin-right: -8px;">${accessCode}</span>
                              </div>
                              <div style="margin-top: 12px;">
                                <a href="${accessUrl}?copy=code&code=${accessCode}" target="_blank" style="display: inline-block; background-color: #262638; border: 1px solid #3E3E58; color: #E2E8F0; font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 8px; text-decoration: none;">📋 Copy Access Code</a>
                              </div>
                              <p style="margin: 10px 0 0 0; font-size: 12px; color: #64748B;">Enter this 6-digit code if prompted on your device</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Primary Customer Portal CTA -->
                    <tr>
                      <td style="padding: 0 32px 28px 32px; text-align: center;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td align="center">
                              <a href="${accessUrl}" target="_blank" style="display: inline-block; width: 100%; max-width: 380px; box-sizing: border-box; background: linear-gradient(135deg, #8D6CE5 0%, #6366F1 100%); background-color: #8D6CE5; color: #FFFFFF; font-size: 15px; font-weight: 800; letter-spacing: 0.5px; text-decoration: none; padding: 16px 28px; border-radius: 12px; text-align: center; box-shadow: 0 6px 20px rgba(141, 108, 229, 0.4);">
                                Enter Your Dining Experience &rarr;
                              </a>
                            </td>
                          </tr>
                        </table>
                        <p style="margin: 10px 0 0 0; font-size: 12px; color: #64748B;">Opens instantly in your phone browser &bull; No app download required</p>
                      </td>
                    </tr>

                    <!-- 6-8. Table Details Summary Card (Members, Table, Seating Area) -->
                    <tr>
                      <td style="padding: 0 32px 28px 32px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #171722; border: 1px solid #262636; border-radius: 14px; overflow: hidden;">
                          <tr>
                            <td colspan="2" style="padding: 14px 18px; border-bottom: 1px solid #232332; background-color: #1B1B26;">
                              <span style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #94A3B8; text-transform: uppercase;">Your Table Details</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 13px; color: #94A3B8;">Number of Members</td>
                            <td align="right" style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 13px; font-weight: 600; color: #E2E8F0;">${personsCount} ${personsCount === 1 ? 'Guest' : 'Guests'}</td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 13px; color: #94A3B8;">Assigned Table</td>
                            <td align="right" style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 14px; font-weight: 800; color: #D4AF37;">Table ${tableNumber}</td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 18px; font-size: 13px; color: #94A3B8;">Seating Area</td>
                            <td align="right" style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #E2E8F0;">${placeTypeName}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- 9. Premium Thank-You Closing & Footer -->
                    <tr>
                      <td style="padding: 24px 32px 32px 32px; border-top: 1px solid #232334; text-align: center; background-color: #0F0F16;">
                        <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #CBD5E1;">We look forward to serving you an exceptional experience.</p>
                        <p style="margin: 0; font-size: 11px; color: #64748B;">Pegs N Bottles &bull; Premium Hospitality &amp; Bar Experience</p>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;
      } else {
        rawHtml = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your Entry Pass is Ready — Pegs N Bottles</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #0A0A0E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
            <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all;">
              Welcome to Pegs N Bottles! Pass: ${tokenNumber}. Present your QR code at the bar counter.
            </div>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0A0A0E; width: 100%; padding: 36px 12px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%; background-color: #13131B; border: 1px solid #262638; border-radius: 20px; overflow: hidden; box-shadow: 0 16px 48px rgba(0,0,0,0.65);">
                    
                    <!-- 1. Pegs N Bottles Brand Header -->
                    <tr>
                      <td style="padding: 36px 32px 24px 32px; text-align: center; background: linear-gradient(180deg, #1C1C28 0%, #13131B 100%); border-bottom: 1px solid #232334;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                          <tr>
                            <td align="center">
                              <div style="width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, #8D6CE5 0%, #5B45BA 100%); color: #FFFFFF; font-size: 26px; font-weight: 900; line-height: 52px; text-align: center; display: inline-block; box-shadow: 0 6px 20px rgba(141, 108, 229, 0.4); border: 1px solid rgba(255,255,255,0.15);">P</div>
                            </td>
                          </tr>
                        </table>
                        <h1 style="margin: 16px 0 4px 0; font-size: 20px; font-weight: 800; letter-spacing: 3.5px; color: #FFFFFF; text-transform: uppercase;">Pegs N Bottles</h1>
                        <p style="margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #D4AF37; text-transform: uppercase;">Digital Entry Pass</p>
                      </td>
                    </tr>

                    <!-- 2. Natural Greeting -->
                    <tr>
                      <td style="padding: 30px 32px 20px 32px; text-align: center;">
                        <h2 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.3px;">Welcome, ${customerName || 'Guest'}</h2>
                        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #94A3B8;">
                          Your check-in is complete! Please present your pass QR code at the bar counter to redeem included drinks and place orders directly with our bartender.
                        </p>
                      </td>
                    </tr>

                    <!-- 3. Primary Visual Centered QR Code -->
                    <tr>
                      <td style="padding: 0 32px 24px 32px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #181824; border: 1px solid #28283C; border-radius: 16px; padding: 24px 16px; text-align: center;">
                          <tr>
                            <td align="center">
                              <p style="margin: 0 0 14px 0; font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #A78BFA; text-transform: uppercase;">Entry Pass QR Code</p>
                              <div style="background-color: #FFFFFF; padding: 12px; border-radius: 14px; display: inline-block; box-shadow: 0 4px 20px rgba(0,0,0,0.4);">
                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(tokenNumber)}" alt="Entry Pass QR Code" width="160" height="160" style="display: block; width: 160px; height: 160px; border: 0;" />
                              </div>
                              <p style="margin: 12px 0 0 0; font-size: 12px; color: #64748B;">Present to your bartender or server at the bar counter</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- 4. Pass / Barcode ID (No Line Wrapping) -->
                    <tr>
                      <td style="padding: 0 32px 20px 32px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #161622; border: 1px solid #262638; border-radius: 12px; padding: 12px 18px;">
                          <tr>
                            <td style="font-size: 12px; font-weight: 600; color: #94A3B8; vertical-align: middle;">
                              Pass ID:
                            </td>
                            <td align="right" style="vertical-align: middle; white-space: nowrap;">
                              <span style="font-family: 'SF Mono', Consolas, Monaco, monospace; font-size: 13px; font-weight: 700; color: #F1F5F9; letter-spacing: 0.5px; white-space: nowrap; word-break: keep-all; display: inline-block; vertical-align: middle;">${tokenNumber}</span>
                              <a href="${accessUrl}?copy=id&id=${tokenNumber}" target="_blank" style="margin-left: 8px; display: inline-block; background-color: #242436; border: 1px solid #383850; color: #A78BFA; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; text-decoration: none; vertical-align: middle; white-space: nowrap;">📋 Copy</a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- 6-8. Session Details Card (Members, Seating Area) -->
                    <tr>
                      <td style="padding: 0 32px 28px 32px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #171722; border: 1px solid #262636; border-radius: 14px; overflow: hidden;">
                          <tr>
                            <td colspan="2" style="padding: 14px 18px; border-bottom: 1px solid #232332; background-color: #1B1B26;">
                              <span style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #94A3B8; text-transform: uppercase;">Session Details</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 13px; color: #94A3B8;">Number of Members</td>
                            <td align="right" style="padding: 12px 18px; border-bottom: 1px solid #1F1F2C; font-size: 13px; font-weight: 600; color: #E2E8F0;">${personsCount} ${personsCount === 1 ? 'Guest' : 'Guests'}</td>
                          </tr>
                          <tr>
                            <td style="padding: 12px 18px; font-size: 13px; color: #94A3B8;">Seating Area</td>
                            <td align="right" style="padding: 12px 18px; font-size: 13px; font-weight: 600; color: #E2E8F0;">${placeTypeName}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- 9. Premium Thank-You Closing & Footer -->
                    <tr>
                      <td style="padding: 24px 32px 32px 32px; border-top: 1px solid #232334; text-align: center; background-color: #0F0F16;">
                        <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #CBD5E1;">We look forward to serving you an exceptional experience.</p>
                        <p style="margin: 0; font-size: 11px; color: #64748B;">Pegs N Bottles &bull; Premium Hospitality &amp; Bar Experience</p>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;
      }
    }

    // 2. HTML Sanitization
    const sanitizedHtml = this.sanitizeHtml(rawHtml);
    let bodyText = '';
    if (job.type === 'EXTENSION') {
      bodyText = isPremium
        ? `Dear ${customerName || 'Guest'},\n\nYour dining session at Pegs N Bottles has been extended (+${job.extraMinutes} mins).\n\nPass ID: ${tokenNumber}\nTable Access Code: ${accessCode}\nAssigned Table: Table ${job.tableNumber || tableNumber}\nNumber of Members: ${personsCount} Guest(s)\nSeating Area: ${placeTypeName}\nNew End Time: ${job.newEndTime ? new Date(job.newEndTime).toLocaleString() : 'N/A'}\n\nEnter your dining experience: ${accessUrl}\n\nThank you for dining with us.\nPegs N Bottles`
        : `Dear ${customerName || 'Guest'},\n\nYour bar session at Pegs N Bottles has been extended (+${job.extraMinutes} mins).\n\nPass ID: ${tokenNumber}\nNumber of Members: ${personsCount} Guest(s)\nSeating Area: ${placeTypeName}\nNew End Time: ${job.newEndTime ? new Date(job.newEndTime).toLocaleString() : 'N/A'}\n\nPlease present your pass at the bar counter for service.\n\nThank you for visiting Pegs N Bottles.`;
    } else {
      bodyText = isPremium
        ? `Dear ${customerName || 'Guest'},\n\nWelcome to Pegs N Bottles! Your table check-in has been confirmed.\n\nPass ID: ${tokenNumber}\nTable Access Code: ${accessCode}\nAssigned Table: Table ${tableNumber}\nNumber of Members: ${personsCount} Guest(s)\nSeating Area: ${placeTypeName}\n\nEnter your dining experience: ${accessUrl}\n\nWe look forward to serving you an exceptional experience.\nPegs N Bottles`
        : `Dear ${customerName || 'Guest'},\n\nWelcome to Pegs N Bottles! Your check-in is complete.\n\nPass ID: ${tokenNumber}\nNumber of Members: ${personsCount} Guest(s)\nSeating Area: ${placeTypeName}\n\nPlease present your pass at the bar counter for service.\n\nWe look forward to serving you.\nPegs N Bottles`;
    }

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
