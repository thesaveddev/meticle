import { extname } from 'path';
import { readFileSync } from 'fs';

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
  '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.ps1',
  '.psm1', '.psd1', '.jar', '.zip', '.rar', '.7z',
]);

const TEXT_MIME_PREFIXES = ['text/', 'application/json', 'application/xml', 'application/javascript'];

function getFileSignature(buffer: Buffer): string {
  return buffer.slice(0, 8).toString('hex').toUpperCase();
}

const MAGIC_SIGNATURES: Record<string, string> = {
  '504B0304': 'zip/office',
  '504B0506': 'zip',
  '504B0708': 'zip',
  '52617221': 'rar',
  '377ABCAF271C': '7z',
  '4D5A': 'exe/dll',
  '7F454C46': 'elf',
  'FFD8FF': 'jpeg',
  '89504E47': 'png',
  '25504446': 'pdf',
};

export interface ScanResult {
  safe: boolean;
  reason?: string;
}

export function scanBuffer(buffer: Buffer, originalName: string): ScanResult {
  const ext = extname(originalName).toLowerCase();

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { safe: false, reason: `File type .${ext} is not allowed for security reasons` };
  }

  const sig = getFileSignature(buffer);
  for (const [magic, label] of Object.entries(MAGIC_SIGNATURES)) {
    if (sig.startsWith(magic)) {
      if (['exe/dll', 'zip', 'zip/office', 'rar', '7z'].includes(label)) {
        return { safe: false, reason: `Executable or archive files are not allowed (detected: ${label})` };
      }
      break;
    }
  }

  return { safe: true };
}

export function scanFile(filePath: string): ScanResult {
  const buffer = readFileSync(filePath);
  return scanBuffer(buffer, filePath);
}
