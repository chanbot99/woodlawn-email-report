/**
 * SendGrid email integration for weekly reports
 */

import sgMail from '@sendgrid/mail';
import type { CleanedSale, ExtractorConfig, DateRange } from '../types/index.js';
import { getSalesStats, formatSalePrice, formatDisplayDate } from '../processors/transform.js';
import { cleanedSalesToCsvString } from '../output/csv-writer.js';
import { logger, logEmailSent } from '../utils/logger.js';
import { getPropertyImageUrl, getGoogleMapsLink, buildFullAddress } from '../utils/maps.js';

/**
 * Initialize SendGrid with API key
 */
export function initializeSendGrid(apiKey: string): void {
  sgMail.setApiKey(apiKey);
}

/**
 * Generate a property card with image for the email
 */
function generatePropertyCard(
  sale: CleanedSale,
  config: ExtractorConfig,
  index: number
): string {
  const imageUrl = getPropertyImageUrl(
    sale,
    config.googleMapsApiKey,
    config.mapImageType,
    config.mapImageWidth,
    config.mapImageHeight
  );
  const mapsLink = getGoogleMapsLink(buildFullAddress(sale));
  
  const imageHtml = imageUrl
    ? `<a href="${mapsLink}" target="_blank" style="display: block;">
        <img src="${imageUrl}" alt="Property at ${sale.situs_address}" 
             style="width: 100%; height: 180px; object-fit: cover; border-radius: 8px 8px 0 0;" />
       </a>`
    : `<a href="${mapsLink}" target="_blank" style="display: block; background: #e5e7eb; height: 180px; border-radius: 8px 8px 0 0; text-decoration: none; text-align: center; padding-top: 70px;">
        <span style="color: #6b7280; font-size: 14px;">📍 View on Google Maps</span>
       </a>`;

  return `
    <div style="background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; margin-bottom: 16px;">
      ${imageHtml}
      <div style="padding: 16px;">
        <div style="font-weight: 600; font-size: 16px; color: #1f2937; margin-bottom: 4px;">
          <a href="${mapsLink}" target="_blank" style="color: #1f2937; text-decoration: none;">${sale.situs_address}</a>
        </div>
        <div style="color: #6b7280; font-size: 14px; margin-bottom: 16px;">${sale.city}, ${sale.state} ${sale.zip || ''}</div>
        
        <table style="width: 100%; border-top: 1px solid #e5e7eb; padding-top: 12px; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; vertical-align: top; width: 60%;">
              <div style="font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Owner</div>
              <div style="font-size: 14px; color: #1f2937; font-weight: 500;">${sale.owner_name || 'N/A'}</div>
            </td>
            <td style="padding: 12px 0; vertical-align: top; width: 40%; text-align: right;">
              <div style="font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Sold ${formatDisplayDate(sale.sale_date)}</div>
              <div style="font-size: 20px; font-weight: 700; color: #059669;">${formatSalePrice(sale.sale_price)}</div>
            </td>
          </tr>
        </table>
      </div>
    </div>
  `;
}

/**
 * Generate HTML email template for the report
 */
export function generateEmailHtml(
  sales: CleanedSale[],
  dateRange: DateRange,
  countyName: string,
  config?: ExtractorConfig
): string {
  const stats = getSalesStats(sales);
  const hasImages = config?.googleMapsApiKey;
  
  // Generate property cards if we have Google Maps API key, otherwise use table
  let propertiesHtml: string;
  
  if (hasImages && config) {
    // Card layout with images
    const propertyCards = sales
      .slice(0, 20) // Limit to 20 with images to avoid huge email
      .map((sale, index) => generatePropertyCard(sale, config, index))
      .join('');
    
    propertiesHtml = `
      <div style="padding: 15px 20px; border-bottom: 1px solid #e5e7eb;">
        <h2 style="margin: 0; font-size: 18px; color: #1f2937;">Properties${sales.length > 20 ? ` (showing 20 of ${sales.length})` : ''}</h2>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #6b7280;">Click images to open in Google Maps</p>
      </div>
      <div style="padding: 16px;">
        ${propertyCards}
      </div>
    `;
  } else {
    // Table layout (no images)
    const tableRows = sales
      .slice(0, 50)
      .map((sale, index) => `
        <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${sale.situs_address}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${sale.city}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${sale.owner_name || 'N/A'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${formatDisplayDate(sale.sale_date)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatSalePrice(sale.sale_price)}</td>
        </tr>
      `)
      .join('');

    propertiesHtml = `
      <div style="padding: 15px 20px; border-bottom: 1px solid #e5e7eb;">
        <h2 style="margin: 0; font-size: 18px; color: #1f2937;">Recent Sales${sales.length > 50 ? ` (showing 50 of ${sales.length})` : ''}</h2>
      </div>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: 600;">Address</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: 600;">City</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: 600;">Owner</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: 600;">Sale Date</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #6b7280; font-weight: 600;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #6b7280;">No sales found for this period</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }

  const limitNote = hasImages && sales.length > 20
    ? `<p style="margin-top: 15px; color: #6b7280; font-size: 14px; text-align: center;">📎 Full list of ${sales.length} properties attached as CSV</p>`
    : sales.length > 50
    ? `<p style="margin-top: 15px; color: #6b7280; font-size: 14px; text-align: center;">📎 Full list of ${sales.length} properties attached as CSV</p>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Homeowners Report - ${countyName} County</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 800px; margin: 0 auto; padding: 20px;">
  
  <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="margin: 0 0 10px 0; font-size: 24px;">Woodlawn New Homeowners Report</h1>
    <p style="margin: 0; opacity: 0.9; font-size: 16px;">${countyName} County, TN - ${dateRange.label}</p>
  </div>
  
  <div style="background: #f3f4f6; padding: 20px; border-radius: 0 0 12px 12px;">
    
    <!-- Summary Stats -->
    <div style="display: flex; gap: 15px; margin-bottom: 25px; flex-wrap: wrap;">
      <div style="flex: 1; min-width: 150px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="font-size: 32px; font-weight: bold; color: #059669;">${stats.count}</div>
        <div style="color: #6b7280; font-size: 14px;">New Sales</div>
      </div>
      <div style="flex: 1; min-width: 150px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="font-size: 24px; font-weight: bold; color: #059669;">${formatSalePrice(stats.totalValue)}</div>
        <div style="color: #6b7280; font-size: 14px;">Total Value</div>
      </div>
      <div style="flex: 1; min-width: 150px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="font-size: 24px; font-weight: bold; color: #059669;">${formatSalePrice(stats.averagePrice)}</div>
        <div style="color: #6b7280; font-size: 14px;">Avg Price</div>
      </div>
      <div style="flex: 1; min-width: 150px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="font-size: 24px; font-weight: bold; color: #059669;">${formatSalePrice(stats.medianPrice)}</div>
        <div style="color: #6b7280; font-size: 14px;">Median Price</div>
      </div>
    </div>

    <!-- Properties Section -->
    <div style="background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
      ${propertiesHtml}
    </div>

    ${limitNote}

    <!-- Footer -->
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #d1d5db; text-align: center; color: #9ca3af; font-size: 12px;">
      <p style="margin: 0;">Generated by New Homeowners Extractor</p>
      <p style="margin: 5px 0 0 0;">Data source: Tennessee Property Assessment Data (TPAD)</p>
    </div>

  </div>
</body>
</html>
`;
}

/**
 * Generate plain text version of the email
 */
export function generateEmailText(
  sales: CleanedSale[],
  dateRange: DateRange,
  countyName: string
): string {
  const stats = getSalesStats(sales);
  
  let text = `
NEW HOMEOWNERS REPORT
${countyName} County, TN - ${dateRange.label}
${'='.repeat(50)}

SUMMARY
-------
New Sales: ${stats.count}
Total Value: ${formatSalePrice(stats.totalValue)}
Average Price: ${formatSalePrice(stats.averagePrice)}
Median Price: ${formatSalePrice(stats.medianPrice)}

RECENT SALES
------------
`;

  for (const sale of sales.slice(0, 30)) {
    text += `
${sale.situs_address}, ${sale.city}
  Owner: ${sale.owner_name || 'N/A'}
  Sale Date: ${formatDisplayDate(sale.sale_date)}
  Price: ${formatSalePrice(sale.sale_price)}
`;
  }

  if (sales.length > 30) {
    text += `\n... and ${sales.length - 30} more (see attached CSV)\n`;
  }

  text += `
${'='.repeat(50)}
Generated by New Homeowners Extractor
Data source: Tennessee Property Assessment Data (TPAD)
`;

  return text;
}

/**
 * Send the weekly report email
 */
export async function sendReportEmail(
  config: ExtractorConfig,
  sales: CleanedSale[],
  dateRange: DateRange
): Promise<boolean> {
  if (!config.sendgridApiKey) {
    logger.warn('SendGrid API key not configured - skipping email');
    return false;
  }

  if (!config.emailTo) {
    logger.warn('Email recipient not configured - skipping email');
    return false;
  }

  initializeSendGrid(config.sendgridApiKey);

  const htmlContent = generateEmailHtml(sales, dateRange, config.countyName, config);
  const textContent = generateEmailText(sales, dateRange, config.countyName);
  const csvContent = cleanedSalesToCsvString(sales);

  const dateLabel = dateRange.label.replace('Week of ', '').replace(/-/g, '_');
  const attachmentFilename = `new_homeowners_${config.countyName.toLowerCase()}_${dateLabel}.csv`;

  // Support multiple recipients (comma-separated in EMAIL_TO)
  const recipients = config.emailTo.split(',').map(email => email.trim()).filter(Boolean);

  const msg = {
    to: recipients,
    from: config.emailFrom,
    subject: `Woodlawn New Homeowners Report - ${config.countyName} County - ${dateRange.label}`,
    text: textContent,
    html: htmlContent,
    attachments: [
      {
        content: Buffer.from(csvContent).toString('base64'),
        filename: attachmentFilename,
        type: 'text/csv',
        disposition: 'attachment' as const,
      },
    ],
  };

  try {
    await sgMail.send(msg);
    logEmailSent(config.emailTo, sales.length);
    return true;
  } catch (error) {
    logger.error('Failed to send email', error as Error);
    return false;
  }
}

/**
 * Send a test email to verify configuration
 */
export async function sendTestEmail(config: ExtractorConfig): Promise<boolean> {
  if (!config.sendgridApiKey || !config.emailTo) {
    logger.warn('Email not configured - cannot send test');
    return false;
  }

  initializeSendGrid(config.sendgridApiKey);

  const msg = {
    to: config.emailTo,
    from: config.emailFrom,
    subject: '✅ New Homeowners Extractor - Test Email',
    text: 'This is a test email from the New Homeowners Extractor. If you received this, your email configuration is working correctly.',
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #059669;">✅ Email Configuration Test</h2>
        <p>This is a test email from the New Homeowners Extractor.</p>
        <p>If you received this, your email configuration is working correctly.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px;">Sent at: ${new Date().toISOString()}</p>
      </div>
    `,
  };

  try {
    await sgMail.send(msg);
    logger.info('Test email sent successfully', { to: config.emailTo });
    return true;
  } catch (error) {
    logger.error('Failed to send test email', error as Error);
    return false;
  }
}

