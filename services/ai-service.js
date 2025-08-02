// services/ai-service.js
const axios = require('axios');

class AIService {
  constructor() {
    // ใช้หลายบริการฟรี
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.huggingfaceApiKey = process.env.HUGGINGFACE_API_KEY;
  }

  // วิเคราะห์ใบเสร็จด้วย OpenAI (ฟรี $5 credit สำหรับ account ใหม่)
  async analyzeReceiptWithOpenAI(ocrText) {
    try {
      if (!this.openaiApiKey) {
        throw new Error('OpenAI API key not found');
      }

      const prompt = `
วิเคราะห์ข้อความจากใบเสร็จต่อไปนี้และแปลงเป็น JSON:

${ocrText}

กรุณาส่งคืนข้อมูลในรูปแบบ JSON เท่านั้น:
{
  "merchant": "ชื่อร้าน",
  "date": "วันที่ในรูปแบบ YYYY-MM-DD",
  "total": ยอดรวมเป็นตัวเลข,
  "items": [
    {
      "name": "ชื่อสินค้า",
      "price": ราคาเป็นตัวเลข,
      "quantity": จำนวนเป็นตัวเลข,
      "category": "หมวดหมู่สินค้า"
    }
  ]
}

หมวดหมู่ที่ใช้: "อาหาร", "เครื่องดื่ม", "ของใช้", "เสื้อผ้า", "ยา", "เครื่องสำอาง", "อื่นๆ"
`;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'คุณเป็นผู้เชี่ยวชาญในการวิเคราะห์ใบเสร็จ ตอบเป็น JSON เท่านั้น'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.1
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const content = response.data.choices[0].message.content.trim();
      
      // ลองแปลง JSON
      let parsedData;
      try {
        // ลบ markdown code block ถ้ามี
        const cleanContent = content.replace(/```json\n?|```\n?/g, '');
        parsedData = JSON.parse(cleanContent);
      } catch (parseError) {
        throw new Error('Invalid JSON response from OpenAI');
      }

      return {
        ...parsedData,
        confidence: 0.9,
        source: 'openai'
      };
    } catch (error) {
      console.error('OpenAI analysis error:', error);
      throw error;
    }
  }

  // วิเคราะห์ใบเสร็จด้วย Google Gemini (ฟรี)
  async analyzeReceiptWithGemini(ocrText) {
    try {
      if (!this.geminiApiKey) {
        throw new Error('Gemini API key not found');
      }

      const prompt = `
วิเคราะห์ข้อความจากใบเสร็จและส่งคืนเป็น JSON:

ข้อความ: ${ocrText}

ส่งคืน JSON ในรูปแบบนี้เท่านั้น:
{
  "merchant": "ชื่อร้าน",
  "date": "วันที่ YYYY-MM-DD",
  "total": ยอดรวม,
  "items": [
    {"name": "ชื่อสินค้า", "price": ราคา, "quantity": จำนวน, "category": "หมวดหมู่"}
  ]
}

หมวดหมู่: อาหาร, เครื่องดื่ม, ของใช้, เสื้อผ้า, ยา, เครื่องสำอาง, อื่นๆ
`;

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.geminiApiKey}`,
        {
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1000
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const content = response.data.candidates[0].content.parts[0].text.trim();
      
      let parsedData;
      try {
        const cleanContent = content.replace(/```json\n?|```\n?/g, '');
        parsedData = JSON.parse(cleanContent);
      } catch (parseError) {
        throw new Error('Invalid JSON response from Gemini');
      }

      return {
        ...parsedData,
        confidence: 0.85,
        source: 'gemini'
      };
    } catch (error) {
      console.error('Gemini analysis error:', error);
      throw error;
    }
  }

  // วิเคราะห์แบบง่ายด้วย Rule-based (ฟรี - fallback)
  async analyzeReceiptWithRules(ocrText) {
    try {
      const lines = ocrText.split('\n').filter(line => line.trim());
      
      // หาชื่อร้าน (บรรทัดแรกที่มีตัวอักษร)
      const merchant = lines.find(line => 
        line.match(/[ก-๙a-zA-Z]/) && 
        !line.match(/^\d+$/) && 
        line.length > 3
      )?.trim() || 'ไม่ระบุ';

      // หาวันที่
      const dateRegex = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/;
      const dateMatch = ocrText.match(dateRegex);
      let date = new Date().toISOString().split('T')[0];
      
      if (dateMatch) {
        const [, day, month, year] = dateMatch;
        const fullYear = year.length === 2 ? `20${year}` : year;
        date = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }

      // หายอดรวม
      const totalRegex = /(?:รวม|total|sum).*?(\d{1,6}(?:[,\.]\d{2})?)/i;
      const totalMatch = ocrText.match(totalRegex);
      const total = totalMatch ? parseFloat(totalMatch[1].replace(',', '')) : 0;

      // หารายการสินค้า (บรรทัดที่มีราคา)
      const itemRegex = /^(.+?)\s+(\d{1,6}(?:[,\.]\d{2})?)(?:\s*บาท|฿)?$/;
      const items = [];

      for (const line of lines) {
        const match = line.match(itemRegex);
        if (match && !line.match(/รวม|total|sum|tax|vat/i)) {
          const [, name, priceStr] = match;
          const price = parseFloat(priceStr.replace(',', ''));
          
          if (price > 0 && name.length > 1) {
            items.push({
              name: name.trim(),
              price: price,
              quantity: 1,
              category: this.categorizeItem(name.trim())
            });
          }
        }
      }

      // ถ้าไม่เจอรายการ ลองหาราคาทั้งหมด
      if (items.length === 0) {
        const priceMatches = [...ocrText.matchAll(/(\d{1,6}(?:[,\.]\d{2})?)/g)];
        priceMatches.forEach((match, index) => {
          const price = parseFloat(match[1].replace(',', ''));
          if (price > 0 && price !== total) {
            items.push({
              name: `รายการ ${index + 1}`,
              price: price,
              quantity: 1,
              category: 'อื่นๆ'
            });
          }
        });
      }

      return {
        merchant,
        date,
        total: total || items.reduce((sum, item) => sum + item.price, 0),
        items,
        confidence: 0.6,
        source: 'rules'
      };
    } catch (error) {
      console.error('Rule-based analysis error:', error);
      throw error;
    }
  }

  // จัดหมวดหมู่สินค้าแบบง่าย
  categorizeItem(itemName) {
    const name = itemName.toLowerCase();
    
    const categories = {
      'อาหาร': ['ข้าว', 'แกง', 'ผัด', 'ต้ม', 'ยำ', 'ลาบ', 'น้ำพริก', 'ปลา', 'ไก่', 'หมู', 'เนื้อ', 'ไข่', 'pizza', 'burger', 'sandwich'],
      'เครื่องดื่ม': ['น้ำ', 'กาแฟ', 'ชา', 'นม', 'เบียร์', 'โซดา', 'น้ำผลไม้', 'coffee', 'tea', 'milk', 'beer', 'coke', 'pepsi'],
      'ของใช้': ['สบู่', 'ยาสีฟัน', 'แชมพู', 'กระดาษ', 'soap', 'shampoo', 'tissue'],
      'เสื้อผ้า': ['เสื้อ', 'กางเกง', 'กระโปรง', 'รองเท้า', 'shirt', 'pants', 'shoes'],
      'ยา': ['ยา', 'วิตามิน', 'medicine', 'vitamin', 'paracetamol'],
      'เครื่องสำอาง': ['ครีม', 'โลชั่น', 'ลิปสติก', 'cream', 'lotion', 'lipstick']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => name.includes(keyword))) {
        return category;
      }
    }

    return 'อื่นๆ';
  }

  // วิเคราะห์ใบเสร็จด้วยหลายวิธี (fallback)
  async analyzeReceipt(ocrText) {
    if (!ocrText || ocrText.trim().length < 10) {
      throw new Error('ข้อความจาก OCR ไม่เพียงพอสำหรับการวิเคราะห์');
    }

    const methods = [
      () => this.analyzeReceiptWithOpenAI(ocrText),
      () => this.analyzeReceiptWithGemini(ocrText),
      () => this.analyzeReceiptWithRules(ocrText)
    ];

    for (const method of methods) {
      try {
        const result = await method();
        
        // ตรวจสอบความถูกต้องของผลลัพธ์
        if (this.validateAnalysisResult(result)) {
          console.log(`Analysis successful with ${result.source}`);
          return result;
        }
      } catch (error) {
        console.log(`Analysis method failed, trying next...`);
        continue;
      }
    }

    // ถ้าทุกวิธีล้มเหลว ใช้ข้อมูลพื้นฐาน
    return {
      merchant: 'ไม่ระบุ',
      date: new Date().toISOString().split('T')[0],
      total: 0,
      items: [{
        name: 'รายการไม่สามารถอ่านได้',
        price: 0,
        quantity: 1,
        category: 'อื่นๆ'
      }],
      confidence: 0.1,
      source: 'fallback',
      error: 'All analysis methods failed'
    };
  }

  // ตรวจสอบความถูกต้องของผลการวิเคราะห์
  validateAnalysisResult(result) {
    if (!result || typeof result !== 'object') return false;
    
    // ต้องมี merchant, date, total, items
    if (!result.merchant || !result.date || result.total === undefined) return false;
    
    // items ต้องเป็น array
    if (!Array.isArray(result.items)) return false;
    
    // ตรวจสอบ items แต่ละตัว
    for (const item of result.items) {
      if (!item.name || item.price === undefined || item.quantity === undefined) {
        return false;
      }
    }

    // ตรวจสอบว่า total สมเหตุสมผล
    const itemsTotal = result.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (Math.abs(result.total - itemsTotal) > result.total * 0.2 && result.total > 0) {
      // อนุญาตให้ต่างกันได้ไม่เกิน 20%
      console.warn('Total amount mismatch with items total');
    }

    return true;
  }

  // ทดสอบการเชื่อมต่อ AI services
  async testAIServices() {
    const testText = `
ร้าน 7-eleven
วันที่ 15/03/2024
น้ำดื่ม 15 บาท
ขนมปัง 25 บาท
รวม 40 บาท
`;

    console.log('Testing AI services...');

    // ทดสอบ OpenAI
    if (this.openaiApiKey) {
      try {
        const result = await this.analyzeReceiptWithOpenAI(testText);
        console.log('✅ OpenAI is working:', result.source);
      } catch (error) {
        console.log('❌ OpenAI failed:', error.message);
      }
    } else {
      console.log('ℹ️ OpenAI API key not configured');
    }

    // ทดสอบ Gemini
    if (this.geminiApiKey) {
      try {
        const result = await this.analyzeReceiptWithGemini(testText);
        console.log('✅ Gemini is working:', result.source);
      } catch (error) {
        console.log('❌ Gemini failed:', error.message);
      }
    } else {
      console.log('ℹ️ Gemini API key not configured');
    }

    // ทดสอบ Rule-based (จะทำงานเสมอ)
    try {
      const result = await this.analyzeReceiptWithRules(testText);
      console.log('✅ Rule-based analysis is working:', result.source);
    } catch (error) {
      console.log('❌ Rule-based analysis failed:', error.message);
    }

    return true;
  }
}

module.exports = new AIService();