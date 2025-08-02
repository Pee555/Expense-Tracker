const { Client } = require('@line/bot-sdk');
const config = require('../config/config');
const ocrService = require('../services/ocr-service');
const aiService = require('../services/ai-service');
const databaseService = require('../services/database-service');
const lineService = require('../services/line-service');

const client = new Client(config.line);

// ✅ webhook handler
async function handleLineWebhook(req, res) {
  // ตรวจสอบว่า payload มาถูกต้อง
  if (!req.body || !req.body.events) {
    return res.status(200).json({ message: 'No events received' });
  }

  const events = req.body.events;

  if (events.length === 0) {
    return res.status(200).json({ message: 'No events to process' });
  }

  try {
    for (const event of events) {
      await handleEvent(event);
    }

    // ตอบกลับ LINE เพื่อยืนยันว่า webhook ทำงาน
    res.status(200).json({ message: 'OK' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ✅ ประมวลผล event ต่างๆ
async function handleEvent(event) {
  const { type, message, source } = event;
  const userId = source.userId;

  try {
    if (type === 'message') {
      if (message.type === 'image') {
        await handleImageMessage(event);
      } else if (message.type === 'text') {
        await handleTextMessage(event);
      }
    }
  } catch (error) {
    console.error('Event handling error:', error);
    await lineService.replyMessage(event.replyToken, 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
  }
}

// ✅ กรณีข้อความเป็นรูป
async function handleImageMessage(event) {
  const messageId = event.message.id;
  const userId = event.source.userId;

  try {
    await lineService.replyMessage(event.replyToken, 'กำลังประมวลผลใบเสร็จ กรุณารอสักครู่...');

    const imageBuffer = await lineService.downloadImage(messageId);
    const ocrResult = await ocrService.extractTextFromImage(imageBuffer);
    const analysisResult = await aiService.analyzeReceipt(ocrResult);

    await databaseService.saveExpenseRecord({
      userId,
      items: analysisResult.items,
      total: analysisResult.total,
      date: analysisResult.date,
      merchant: analysisResult.merchant,
      rawOcr: ocrResult
    });

    const summaryMessage = formatExpenseSummary(analysisResult);
    await lineService.pushMessage(userId, summaryMessage);

  } catch (error) {
    console.error('Image processing error:', error);
    await lineService.pushMessage(userId, 'ไม่สามารถประมวลผลใบเสร็จได้ กรุณาลองใหม่');
  }
}

// ✅ กรณีข้อความเป็นตัวอักษร
async function handleTextMessage(event) {
  const text = event.message.text.toLowerCase();
  const userId = event.source.userId;

  if (text.includes('สรุป') || text.includes('รายงาน')) {
    const summary = await databaseService.getDailySummary(userId);
    const message = formatDailySummary(summary);
    await lineService.replyMessage(event.replyToken, message);
  } else {
    await lineService.replyMessage(event.replyToken, 'ส่งรูปใบเสร็จมาเพื่อบันทึกค่าใช้จ่าย หรือพิมพ์ "สรุป" เพื่อดูรายงาน');
  }
}

// ✅ สรุปผลหลังบันทึกใบเสร็จ
function formatExpenseSummary(analysis) {
  let message = `📋 บันทึกค่าใช้จ่ายสำเร็จ\n\n`;
  message += `🏪 ร้าน: ${analysis.merchant || 'ไม่ระบุ'}\n`;
  message += `📅 วันที่: ${analysis.date}\n`;
  message += `💰 ยอดรวม: ${analysis.total} บาท\n\n`;
  message += `📝 รายการสินค้า:\n`;

  analysis.items.forEach((item, index) => {
    message += `${index + 1}. ${item.name} - ${item.price} บาท\n`;
  });

  return message;
}

// ✅ สรุปรายวัน
function formatDailySummary(summary) {
  if (!summary || summary.totalExpenses === 0) {
    return 'ยังไม่มีค่าใช้จ่ายในวันนี้';
  }

  let message = `📊 สรุปค่าใช้จ่ายวันนี้\n\n`;
  message += `💰 ยอดรวม: ${summary.totalExpenses} บาท\n`;
  message += `🧾 จำนวนใบเสร็จ: ${summary.receiptCount} ใบ\n\n`;

  if (summary.topCategories && summary.topCategories.length > 0) {
    message += `📈 หมวดหมู่ที่ใช้จ่ายมากที่สุด:\n`;
    summary.topCategories.forEach((cat, index) => {
      message += `${index + 1}. ${cat.category}: ${cat.amount} บาท\n`;
    });
  }

  return message;
}

module.exports = handleLineWebhook;
