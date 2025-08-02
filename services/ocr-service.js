// services/ocr-service.js
const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp');

class OCRService {
  constructor() {
    // ใช้ OCR.space API (ฟรี 25,000 requests/month)
    this.ocrSpaceApiKey = process.env.OCR_SPACE_API_KEY || 'helloworld'; // ใช้ demo key หรือสมัครฟรี
    this.ocrSpaceUrl = 'https://api.ocr.space/parse/image';
  }

  // ปรับปรุงคุณภาพรูปก่อนส่ง OCR
  async preprocessImage(imageBuffer) {
    try {
      const processedImage = await sharp(imageBuffer)
        .resize(1200, null, { 
          withoutEnlargement: true,
          fit: 'inside'
        })
        .sharpen()
        .normalize()
        .greyscale()
        .png({ quality: 90 })
        .toBuffer();

      return processedImage;
    } catch (error) {
      console.error('Error preprocessing image:', error);
      return imageBuffer; // ส่งรูปต้นฉบับถ้าประมวลผลไม่ได้
    }
  }

  // อ่านข้อความจากรูปด้วย OCR.space API
  async extractTextWithOCRSpace(imageBuffer) {
    try {
      const processedImage = await this.preprocessImage(imageBuffer);
      
      const formData = new FormData();
      formData.append('file', processedImage, {
        filename: 'receipt.png',
        contentType: 'image/png'
      });
      formData.append('apikey', this.ocrSpaceApiKey);
      formData.append('language', 'tha'); // รองรับภาษาไทย
      formData.append('isOverlayRequired', 'false');
      formData.append('detectOrientation', 'true');
      formData.append('isTable', 'true');
      formData.append('OCREngine', '2');

      const response = await axios.post(this.ocrSpaceUrl, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 30000
      });

      if (response.data.IsErroredOnProcessing) {
        throw new Error(`OCR Error: ${response.data.ErrorMessage}`);
      }

      const extractedText = response.data.ParsedResults?.[0]?.ParsedText || '';
      
      return {
        text: extractedText,
        confidence: response.data.ParsedResults?.[0]?.TextOverlay?.HasOverlay ? 0.8 : 0.6,
        source: 'ocr.space'
      };
    } catch (error) {
      console.error('OCR.space API error:', error);
      throw error;
    }
  }

  // Backup OCR ด้วย Google Cloud Vision API (ฟรี 1,000 requests/month)
  async extractTextWithGoogleVision(imageBuffer) {
    try {
      if (!process.env.GOOGLE_VISION_API_KEY) {
        throw new Error('Google Vision API key not found');
      }

      const base64Image = imageBuffer.toString('base64');
      
      const requestBody = {
        requests: [
          {
            image: {
              content: base64Image
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 1
              }
            ],
            imageContext: {
              languageHints: ['th', 'en']
            }
          }
        ]
      };

      const response = await axios.post(
        `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const textAnnotations = response.data.responses?.[0]?.textAnnotations;
      if (!textAnnotations || textAnnotations.length === 0) {
        throw new Error('No text detected');
      }

      return {
        text: textAnnotations[0].description,
        confidence: 0.9,
        source: 'google-vision'
      };
    } catch (error) {
      console.error('Google Vision API error:', error);
      throw error;
    }
  }

  // OCR แบบ Fallback - ใช้หลายบริการตามลำดับ
  async extractTextFromImage(imageBuffer) {
    const methods = [
      () => this.extractTextWithOCRSpace(imageBuffer),
      () => this.extractTextWithGoogleVision(imageBuffer)
    ];

    for (const method of methods) {
      try {
        const result = await method();
        if (result.text && result.text.trim().length > 10) {
          console.log(`OCR successful with ${result.source}`);
          return result;
        }
      } catch (error) {
        console.log(`OCR method failed, trying next...`);
        continue;
      }
    }

    // ถ้าทุกวิธีล้มเหลว ส่งข้อความเปล่า
    return {
      text: '',
      confidence: 0,
      source: 'fallback',
      error: 'All OCR methods failed'
    };
  }

  // ล้างข้อความที่ได้จาก OCR
  cleanOCRText(text) {
    if (!text) return '';

    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // แยกข้อมูลพื้นฐานจากข้อความ OCR
  extractBasicInfo(ocrText) {
    const cleanText = this.cleanOCRText(ocrText);
    const lines = cleanText.split('\n').filter(line => line.trim());

    // หาวันที่
    const dateRegex = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|(\d{1,2}\s+(มค|กพ|มีค|เมย|พค|มิย|กค|สค|กย|ตค|พย|ธค|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))/i;
    const dateMatch = cleanText.match(dateRegex);
    
    // หาเลขที่มีสัญลักษณ์เงิน หรือจำนวนเงินรวม
    const totalRegex = /(?:รวม|total|sum|รวมทั้งสิ้น).*?(\d{1,6}(?:[,\.]\d{2})?)/i;
    const priceRegex = /(\d{1,6}(?:[,\.]\d{2})?)\s*(?:บาท|฿|\$)/g;
    
    const totalMatch = cleanText.match(totalRegex);
    const priceMatches = [...cleanText.matchAll(priceRegex)];

    // หาชื่อร้าน (มักจะอยู่บรรทัดแรกๆ)
    const merchantRegex = /^[ก-๙a-zA-Z\s\-\.]{3,50}/;
    const merchantMatch = lines[0]?.match(merchantRegex);

    return {
      date: dateMatch ? dateMatch[0] : null,
      total: totalMatch ? parseFloat(totalMatch[1].replace(',', '')) : null,
      merchant: merchantMatch ? merchantMatch[0].trim() : null,
      prices: priceMatches.map(match => parseFloat(match[1].replace(',', ''))),
      rawLines: lines
    };
  }

  // ตรวจสอบว่าข้อความมีลักษณะเป็นใบเสร็จหรือไม่
  validateReceiptText(ocrText) {
    if (!ocrText || ocrText.trim().length < 20) {
      return { isValid: false, reason: 'ข้อความสั้นเกินไป' };
    }

    const text = ocrText.toLowerCase();
    
    // คำที่บ่งบอกว่าเป็นใบเสร็จ
    const receiptKeywords = [
      'รวม', 'total', 'บาท', '฿', 'ใบเสร็จ', 'receipt', 
      'tax', 'vat', 'ภาษี', 'เงินสด', 'cash', 'card',
      'เครดิต', 'change', 'ทอน'
    ];

    const foundKeywords = receiptKeywords.filter(keyword => 
      text.includes(keyword.toLowerCase())
    );

    if (foundKeywords.length < 2) {
      return { 
        isValid: false, 
        reason: 'ไม่พบคำที่บ่งบอกว่าเป็นใบเสร็จ' 
      };
    }

    // ตรวจสอบว่ามีตัวเลขที่เป็นราคา
    const pricePattern = /\d{1,6}(?:[,\.]\d{2})?/g;
    const prices = ocrText.match(pricePattern);
    
    if (!prices || prices.length < 1) {
      return { 
        isValid: false, 
        reason: 'ไม่พบตัวเลขราคา' 
      };
    }

    return { 
      isValid: true, 
      confidence: Math.min(0.9, foundKeywords.length * 0.2 + 0.3),
      foundKeywords 
    };
  }

  // ทดสอบการเชื่อมต่อ OCR services
  async testOCRServices() {
    try {
      // สร้างรูปทดสอบง่ายๆ
      const testImage = await sharp({
        create: {
          width: 400,
          height: 200,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      })
      .png()
      .toBuffer();

      console.log('Testing OCR services...');
      
      // ทดสอบ OCR.space
      try {
        await this.extractTextWithOCRSpace(testImage);
        console.log('✅ OCR.space is working');
      } catch (error) {
        console.log('❌ OCR.space failed:', error.message);
      }

      // ทดสอบ Google Vision (ถ้ามี API key)
      if (process.env.GOOGLE_VISION_API_KEY) {
        try {
          await this.extractTextWithGoogleVision(testImage);
          console.log('✅ Google Vision is working');
        } catch (error) {
          console.log('❌ Google Vision failed:', error.message);
        }
      } else {
        console.log('ℹ️ Google Vision API key not configured');
      }

      return true;
    } catch (error) {
      console.error('Error testing OCR services:', error);
      return false;
    }
  }
}

module.exports = new OCRService();