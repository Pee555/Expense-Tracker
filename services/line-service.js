// services/line-service.js
const { Client } = require('@line/bot-sdk');
const axios = require('axios');
const config = require('../config/config');

const client = new Client(config.line);

class LineService {
  // ส่งข้อความตอบกลับ
  async replyMessage(replyToken, message) {
    try {
      let messageObject;
      
      if (typeof message === 'string') {
        messageObject = {
          type: 'text',
          text: message
        };
      } else {
        messageObject = message;
      }

      await client.replyMessage(replyToken, messageObject);
      return true;
    } catch (error) {
      console.error('Error replying message:', error);
      throw error;
    }
  }

  // ส่งข้อความแบบ Push
  async pushMessage(userId, message) {
    try {
      let messageObject;
      
      if (typeof message === 'string') {
        messageObject = {
          type: 'text',
          text: message
        };
      } else {
        messageObject = message;
      }

      await client.pushMessage(userId, messageObject);
      return true;
    } catch (error) {
      console.error('Error pushing message:', error);
      throw error;
    }
  }

  // ส่งข้อความแบบ Multicast (หลายคนพร้อมกัน)
  async multicastMessage(userIds, message) {
    try {
      let messageObject;
      
      if (typeof message === 'string') {
        messageObject = {
          type: 'text',
          text: message
        };
      } else {
        messageObject = message;
      }

      await client.multicast(userIds, messageObject);
      return true;
    } catch (error) {
      console.error('Error multicasting message:', error);
      throw error;
    }
  }

  // ดาวน์โหลดรูปภาพจาก LINE
  async downloadImage(messageId) {
    try {
      const stream = await client.getMessageContent(messageId);
      const chunks = [];
      
      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        stream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        });
        
        stream.on('error', (error) => {
          reject(error);
        });
      });
    } catch (error) {
      console.error('Error downloading image:', error);
      throw error;
    }
  }

  // ดึงข้อมูล Profile ของผู้ใช้
  async getUserProfile(userId) {
    try {
      const profile = await client.getProfile(userId);
      return profile;
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  }

  // สร้างข้อความแบบ Flex Message สำหรับแสดงสรุปรายวัน
  createDailySummaryFlexMessage(summaryData) {
    return {
      type: 'flex',
      altText: 'สรุปค่าใช้จ่ายรายวัน',
      contents: {
        type: 'bubble',
        hero: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '📊 สรุปค่าใช้จ่ายวันนี้',
              weight: 'bold',
              size: 'xl',
              color: '#ffffff'
            }
          ],
          backgroundColor: '#42A5F5',
          paddingAll: 'md'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: 'ยอดรวม',
                  flex: 1,
                  size: 'md'
                },
                {
                  type: 'text',
                  text: `${summaryData.totalExpenses?.toLocaleString() || 0} บาท`,
                  flex: 1,
                  size: 'md',
                  weight: 'bold',
                  color: '#E53E3E',
                  align: 'end'
                }
              ],
              margin: 'md'
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: 'จำนวนใบเสร็จ',
                  flex: 1,
                  size: 'md'
                },
                {
                  type: 'text',
                  text: `${summaryData.receiptCount || 0} ใบ`,
                  flex: 1,
                  size: 'md',
                  align: 'end'
                }
              ],
              margin: 'md'
            }
          ]
        }
      }
    };
  }

  // สร้างข้อความแบบ Flex Message สำหรับแสดงสรุปรายเดือน
  createMonthlySummaryFlexMessage(summaryData) {
    const topCategories = summaryData.topCategories?.slice(0, 3) || [];
    
    const categoryContents = topCategories.map(category => ({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: category.category,
          flex: 2,
          size: 'sm'
        },
        {
          type: 'text',
          text: `${category.amount?.toLocaleString() || 0} บาท`,
          flex: 1,
          size: 'sm',
          align: 'end',
          color: '#666666'
        }
      ],
      margin: 'sm'
    }));

    return {
      type: 'flex',
      altText: 'สรุปค่าใช้จ่ายรายเดือน',
      contents: {
        type: 'bubble',
        hero: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '📈 สรุปค่าใช้จ่ายรายเดือน',
              weight: 'bold',
              size: 'xl',
              color: '#ffffff'
            }
          ],
          backgroundColor: '#66BB6A',
          paddingAll: 'md'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: 'ยอดรวมทั้งเดือน',
                  flex: 1,
                  size: 'md'
                },
                {
                  type: 'text',
                  text: `${summaryData.totalExpenses?.toLocaleString() || 0} บาท`,
                  flex: 1,
                  size: 'md',
                  weight: 'bold',
                  color: '#E53E3E',
                  align: 'end'
                }
              ],
              margin: 'md'
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: 'เฉลี่ยต่อวัน',
                  flex: 1,
                  size: 'md'
                },
                {
                  type: 'text',
                  text: `${summaryData.averagePerDay?.toFixed(0) || 0} บาท`,
                  flex: 1,
                  size: 'md',
                  align: 'end'
                }
              ],
              margin: 'md'
            },
            {
              type: 'separator',
              margin: 'lg'
            },
            {
              type: 'text',
              text: 'หมวดหมู่ที่ใช้จ่ายมากสุด',
              weight: 'bold',
              size: 'md',
              margin: 'lg'
            },
            ...categoryContents
          ]
        }
      }
    };
  }

  // สร้างข้อความแบบ Quick Reply สำหรับเมนูหลัก
  createMainMenuMessage() {
    return {
      type: 'text',
      text: 'เลือกเมนูที่ต้องการ',
      quickReply: {
        items: [
          {
            type: 'action',
            action: {
              type: 'message',
              label: 'สรุปวันนี้',
              text: 'สรุปวันนี้'
            }
          },
          {
            type: 'action',
            action: {
              type: 'message',
              label: 'สรุปเดือนนี้',
              text: 'สรุปเดือนนี้'
            }
          },
          {
            type: 'action',
            action: {
              type: 'message',
              label: 'รายการล่าสุด',
              text: 'รายการล่าสุด'
            }
          },
          {
            type: 'action',
            action: {
              type: 'message',
              label: 'วิธีใช้งาน',
              text: 'วิธีใช้งาน'
            }
          }
        ]
      }
    };
  }

  // สร้างข้อความวิธีใช้งาน
  createHelpMessage() {
    return {
      type: 'text',
      text: `🤖 วิธีใช้งาน Bot บันทึกค่าใช้จ่าย

📷 ส่งรูปใบเสร็จ
- ถ่ายรูปใบเสร็จส่งมาให้ Bot
- Bot จะอ่านและบันทึกข้อมูลอัตโนมัติ

📊 ดูสรุปค่าใช้จ่าย
- พิมพ์ "สรุปวันนี้" - ดูสรุปรายวัน
- พิมพ์ "สรุปเดือนนี้" - ดูสรุปรายเดือน
- พิมพ์ "รายการล่าสุด" - ดูรายการที่ผ่านมา

💡 เคล็ดลับ
- ถ่ายรูปให้ชัดเจน
- ใบเสร็จไม่พับหรือยับ
- แสงเพียงพอในการถ่ายรูป`
    };
  }

  // ตรวจสอบการเชื่อมต่อ LINE API
  async checkConnection() {
    try {
      // ทดสอบโดยการเรียก API endpoint
      const response = await axios.get('https://api.line.me/v2/bot/info', {
        headers: {
          'Authorization': `Bearer ${config.line.channelAccessToken}`
        }
      });
      
      console.log('LINE Bot connection successful:', response.data);
      return true;
    } catch (error) {
      console.error('LINE Bot connection failed:', error.response?.data || error);
      throw error;
    }
  }
}

module.exports = new LineService();