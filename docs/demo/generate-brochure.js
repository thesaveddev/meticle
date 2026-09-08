const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function generatePDF() {
  const htmlPath = path.join(__dirname, 'MeticleCare-Brochure.html');
  const pdfPath = path.join(__dirname, 'MeticleCare-Product-Brochure.pdf');

  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

  let executablePath;
  const possiblePaths = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium', '/snap/bin/chromium',
  ].filter(Boolean);

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) { executablePath = p; break; }
  }

  if (!executablePath) { console.error('Chrome not found.'); process.exit(1); }

  console.log('Generating MeticleCare Product Brochure PDF...');

  const browser = await puppeteer.launch({
    executablePath, headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluateHandle('document.fonts.ready');

    await page.pdf({
      path: pdfPath, format: 'A4', printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    const stats = fs.statSync(pdfPath);
    console.log('PDF generated:', pdfPath);
    console.log('Size:', (stats.size / 1024).toFixed(1), 'KB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

generatePDF();
