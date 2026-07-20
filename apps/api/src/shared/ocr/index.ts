let tesseract: any = null;

async function loadTesseract() {
  if (!tesseract) {
    try {
      tesseract = await import('tesseract.js');
    } catch {
      throw new Error('tesseract.js is not installed. Run: npm install tesseract.js');
    }
  }
  return tesseract;
}

export interface OcrResult {
  text: string;
  confidence: number;
}

export async function recognizeImage(imagePath: string, lang = 'eng'): Promise<OcrResult> {
  const { recognize } = await loadTesseract();
  const { data } = await recognize(imagePath, lang, {
    logger: () => {},
  });
  return { text: data.text, confidence: data.confidence };
}

export async function recognizeBuffer(buffer: Buffer, lang = 'eng'): Promise<OcrResult> {
  const { recognize } = await loadTesseract();
  const { data } = await recognize(buffer, lang, {
    logger: () => {},
  });
  return { text: data.text, confidence: data.confidence };
}
