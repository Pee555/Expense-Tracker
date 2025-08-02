// services/aws-service.js
const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs').promises;

class AWSService {
    constructor() {
        // ตั้งค่า AWS Configuration
        AWS.config.update({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION || 'ap-southeast-1'
        });

        this.s3 = new AWS.S3();
        this.textract = new AWS.Textract();
        
        this.bucketName = process.env.AWS_S3_BUCKET_NAME;
        this.bucketRegion = process.env.AWS_REGION || 'ap-southeast-1';
    }

    /**
     * อัปโหลดรูปภาพไปยัง S3
     * @param {Buffer} imageBuffer - รูปภาพในรูปแบบ Buffer
     * @param {string} fileName - ชื่อไฟล์
     * @param {string} contentType - ประเภทไฟล์
     * @returns {Promise<Object>} ข้อมูลการอัปโหลด
     */
    async uploadImageToS3(imageBuffer, fileName, contentType = 'image/jpeg') {
        try {
            const key = `receipts/${Date.now()}-${fileName}`;
            
            const params = {
                Bucket: this.bucketName,
                Key: key,
                Body: imageBuffer,
                ContentType: contentType,
                ServerSideEncryption: 'AES256',
                Metadata: {
                    'upload-time': new Date().toISOString(),
                    'original-name': fileName
                }
            };

            const result = await this.s3.upload(params).promise();
            
            return {
                success: true,
                key: key,
                url: result.Location,
                bucket: this.bucketName,
                etag: result.ETag
            };
        } catch (error) {
            console.error('Error uploading to S3:', error);
            throw new Error(`S3 Upload failed: ${error.message}`);
        }
    }

    /**
     * ดาวน์โหลดรูปภาพจาก S3
     * @param {string} key - S3 Key
     * @returns {Promise<Buffer>} รูปภาพในรูปแบบ Buffer
     */
    async downloadImageFromS3(key) {
        try {
            const params = {
                Bucket: this.bucketName,
                Key: key
            };

            const result = await this.s3.getObject(params).promise();
            return result.Body;
        } catch (error) {
            console.error('Error downloading from S3:', error);
            throw new Error(`S3 Download failed: ${error.message}`);
        }
    }

    /**
     * ลบรูปภาพจาก S3
     * @param {string} key - S3 Key
     * @returns {Promise<boolean>} ผลลัพธ์การลบ
     */
    async deleteImageFromS3(key) {
        try {
            const params = {
                Bucket: this.bucketName,
                Key: key
            };

            await this.s3.deleteObject(params).promise();
            return true;
        } catch (error) {
            console.error('Error deleting from S3:', error);
            return false;
        }
    }

    /**
     * ใช้ AWS Textract ในการอ่าน OCR จากรูปภาพ
     * @param {string} s3Key - S3 Key ของรูปภาพ
     * @returns {Promise<Object>} ผลลัพธ์ OCR
     */
    async extractTextFromImage(s3Key) {
        try {
            const params = {
                Document: {
                    S3Object: {
                        Bucket: this.bucketName,
                        Name: s3Key
                    }
                },
                FeatureTypes: ['TABLES', 'FORMS']
            };

            // ใช้ analyzeDocument สำหรับการวิเคราะห์ที่ละเอียดกว่า
            const result = await this.textract.analyzeDocument(params).promise();
            
            return this.processTextractResult(result);
        } catch (error) {
            console.error('Error in Textract OCR:', error);
            
            // ถ้า analyzeDocument ล้มเหลว ลองใช้ detectDocumentText แทน
            try {
                const simpleParams = {
                    Document: {
                        S3Object: {
                            Bucket: this.bucketName,
                            Name: s3Key
                        }
                    }
                };
                
                const simpleResult = await this.textract.detectDocumentText(simpleParams).promise();
                return this.processSimpleTextractResult(simpleResult);
            } catch (simpleError) {
                console.error('Error in simple Textract OCR:', simpleError);
                throw new Error(`Textract OCR failed: ${simpleError.message}`);
            }
        }
    }

    /**
     * ประมวลผลลัพธ์จาก Textract (แบบละเอียด)
     * @param {Object} textractResult - ผลลัพธ์จาก Textract
     * @returns {Object} ข้อมูลที่ประมวลผลแล้ว
     */
    processTextractResult(textractResult) {
        const blocks = textractResult.Blocks || [];
        let fullText = '';
        const lines = [];
        const tables = [];
        const keyValuePairs = [];

        // แยกประเภท Block
        const lineBlocks = blocks.filter(block => block.BlockType === 'LINE');
        const tableBlocks = blocks.filter(block => block.BlockType === 'TABLE');
        const keyValueBlocks = blocks.filter(block => block.BlockType === 'KEY_VALUE_SET');

        // ประมวลผล LINE blocks
        lineBlocks.forEach(block => {
            if (block.Text) {
                fullText += block.Text + '\n';
                lines.push({
                    text: block.Text,
                    confidence: block.Confidence,
                    bbox: block.Geometry?.BoundingBox
                });
            }
        });

        // ประมวลผล TABLE blocks (ถ้ามี)
        tableBlocks.forEach(table => {
            const tableData = this.extractTableData(table, blocks);
            if (tableData) {
                tables.push(tableData);
            }
        });

        return {
            fullText: fullText.trim(),
            lines: lines,
            tables: tables,
            keyValuePairs: keyValuePairs,
            confidence: this.calculateAverageConfidence(lineBlocks),
            blockCount: blocks.length
        };
    }

    /**
     * ประมวลผลลัพธ์จาก Textract (แบบง่าย)
     * @param {Object} textractResult - ผลลัพธ์จาก Textract
     * @returns {Object} ข้อมูลที่ประมวลผลแล้ว
     */
    processSimpleTextractResult(textractResult) {
        const blocks = textractResult.Blocks || [];
        let fullText = '';
        const lines = [];

        blocks.forEach(block => {
            if (block.BlockType === 'LINE' && block.Text) {
                fullText += block.Text + '\n';
                lines.push({
                    text: block.Text,
                    confidence: block.Confidence,
                    bbox: block.Geometry?.BoundingBox
                });
            }
        });

        return {
            fullText: fullText.trim(),
            lines: lines,
            tables: [],
            keyValuePairs: [],
            confidence: this.calculateAverageConfidence(blocks.filter(b => b.BlockType === 'LINE')),
            blockCount: blocks.length
        };
    }

    /**
     * คำนวณค่าเฉลี่ยความมั่นใจ
     * @param {Array} blocks - Array ของ blocks
     * @returns {number} ค่าเฉลี่ยความมั่นใจ
     */
    calculateAverageConfidence(blocks) {
        if (!blocks || blocks.length === 0) return 0;
        
        const totalConfidence = blocks.reduce((sum, block) => sum + (block.Confidence || 0), 0);
        return Math.round((totalConfidence / blocks.length) * 100) / 100;
    }

    /**
     * สร้าง Presigned URL สำหรับดูรูปภาพ
     * @param {string} key - S3 Key
     * @param {number} expiresIn - เวลาหมดอายุในวินาที (default: 1 ชั่วโมง)
     * @returns {string} Presigned URL
     */
    getPresignedUrl(key, expiresIn = 3600) {
        try {
            const params = {
                Bucket: this.bucketName,
                Key: key,
                Expires: expiresIn
            };

            return this.s3.getSignedUrl('getObject', params);
        } catch (error) {
            console.error('Error generating presigned URL:', error);
            return null;
        }
    }

    /**
     * ตรวจสอบว่า S3 Bucket พร้อมใช้งานหรือไม่
     * @returns {Promise<boolean>} สถานะการเชื่อมต่อ
     */
    async checkS3Connection() {
        try {
            await this.s3.headBucket({ Bucket: this.bucketName }).promise();
            return true;
        } catch (error) {
            console.error('S3 connection check failed:', error);
            return false;
        }
    }

    /**
     * ตรวจสอบว่า Textract พร้อมใช้งานหรือไม่
     * @returns {Promise<boolean>} สถานะการเชื่อมต่อ
     */
    async checkTextractConnection() {
        try {
            // สร้างรูปภาพทดสอบขนาดเล็ก (1x1 pixel PNG)
            const testImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA60e6kgAAAABJRU5ErkJggg==', 'base64');
            
            const params = {
                Document: {
                    Bytes: testImage
                }
            };

            await this.textract.detectDocumentText(params).promise();
            return true;
        } catch (error) {
            console.error('Textract connection check failed:', error);
            return false;
        }
    }

    /**
     * รับข้อมูลสถิติการใช้งาน S3
     * @returns {Promise<Object>} ข้อมูลสถิติ
     */
    async getS3Stats() {
        try {
            const params = {
                Bucket: this.bucketName,
                Prefix: 'receipts/'
            };

            const result = await this.s3.listObjectsV2(params).promise();
            
            let totalSize = 0;
            let totalFiles = result.KeyCount || 0;
            
            if (result.Contents) {
                totalSize = result.Contents.reduce((sum, obj) => sum + obj.Size, 0);
            }

            return {
                totalFiles: totalFiles,
                totalSize: totalSize,
                totalSizeMB: Math.round((totalSize / 1024 / 1024) * 100) / 100,
                lastModified: result.Contents && result.Contents.length > 0 
                    ? result.Contents[0].LastModified 
                    : null
            };
        } catch (error) {
            console.error('Error getting S3 stats:', error);
            return {
                totalFiles: 0,
                totalSize: 0,
                totalSizeMB: 0,
                lastModified: null,
                error: error.message
            };
        }
    }
}

module.exports = AWSService;

// เพิ่มใน .env ไฟล์:
/*
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET_NAME=your-expense-tracker-bucket
*/