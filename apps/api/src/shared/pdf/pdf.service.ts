import puppeteer, { Browser } from 'puppeteer-core'
import path from 'path'
import fs from 'fs'

let browser: Browser | null = null

function getChromePath(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return 'google-chrome'
}

async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser
  const executablePath = getChromePath()
  browser = await puppeteer.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    headless: true,
  })
  return browser
}

export async function generatePdf(
  html: string,
  options?: { margin?: { top?: string; right?: string; bottom?: string; left?: string }; landscape?: boolean; headerTemplate?: string; footerTemplate?: string }
): Promise<Buffer> {
  const b = await getBrowser()
  const page = await b.newPage()
  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const pdf = await page.pdf({
      format: 'a4',
      margin: options?.margin || { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
      landscape: options?.landscape || false,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: options?.headerTemplate || '<div style="font-size:9px;color:#9CA3AF;width:100%;text-align:center;padding:5px 15mm">CareDesk Report</div>',
      footerTemplate: options?.footerTemplate || '<div style="font-size:9px;color:#9CA3AF;width:100%;text-align:center;padding:5px 15mm">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
    })
    return Buffer.from(pdf)
  } finally {
    await page.close()
  }
}

export function buildReportStyles(): string {
  return `
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; line-height: 1.5; margin: 0; padding: 0; }
    .cover { text-align: center; padding: 80px 40px; page-break-after: always; }
    .cover h1 { color: #0F4C81; font-size: 28px; margin-bottom: 8px; }
    .cover .subtitle { color: #6B7280; font-size: 16px; }
    .cover .meta { margin-top: 40px; color: #9CA3AF; font-size: 13px; }
    .cover .badge { display: inline-block; background: #0F4C81; color: #fff; padding: 4px 16px; border-radius: 20px; font-size: 14px; font-weight: 700; margin-top: 16px; }
    h1 { color: #0F4C81; font-size: 22px; border-bottom: 2px solid #0F4C81; padding-bottom: 6px; }
    h2 { color: #0F4C81; font-size: 18px; margin-top: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11px; }
    th, td { border: 1px solid #D1D5DB; padding: 6px 10px; text-align: left; }
    th { background: #F3F4F6; font-weight: 700; }
    tr:nth-child(even) { background: #F9FAFB; }
    .summary-grid { display: flex; gap: 12px; margin: 16px 0; flex-wrap: wrap; }
    .summary-card { flex: 1; min-width: 120px; text-align: center; padding: 16px; border: 1px solid #E5E7EB; border-radius: 8px; }
    .summary-card .num { font-size: 24px; font-weight: 700; color: #0F4C81; }
    .summary-card .label { font-size: 11px; color: #6B7280; }
    .section-break { page-break-before: always; }
    .status-valid { background: #DCFCE7; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .status-warning { background: #FEF3C7; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .status-critical { background: #FEE2E2; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .status-neutral { background: #F3F4F6; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  `
}
