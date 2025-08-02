async function testServices() {
    console.log('🧪 Testing all services...\n');
    
    // ทดสอบ OCR Service
    console.log('1. Testing OCR Service...');
    try {
        const OCRService = require('../services/ocr-service');
        const ocrService = new OCRService();
        
        // สร้างรูปทดสอบ (base64 ของรูป 1x1 pixel)
        const testImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGA60e6kgAAAABJRU5ErkJggg==', 'base64');
        
        const result = await ocrService.processImage(testImageBuffer, 'test.png');
        console.log('✅ OCR Service: Working');
        console.log('📄 OCR Result:', result.text.substring(0, 100));
    } catch (error) {
        console.log('❌ OCR Service: Failed -', error.message);
    }
    
    // ทดสอบ AI Service
    console.log('\n2. Testing AI Service...');
    try {
        const AIService = require('../services/ai-service');
        const aiService = new AIService();
        
        const testText = "ร้าน 7-Eleven\nน้ำดื่ม 15 บาท\nขนม 25 บาท\nรวม 40 บาท";
        const result = await aiService.analyzeReceipt(testText);
        console.log('✅ AI Service: Working');
        console.log('🤖 AI Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.log('❌ AI Service: Failed -', error.message);
    }
    
    // ทดสอบ Database Service
    console.log('\n3. Testing Database Service...');
    try {
        const DatabaseService = require('../services/database-service');
        const dbService = new DatabaseService();
        
        const categories = await dbService.getCategories();
        console.log('✅ Database Service: Working');
        console.log('📂 Categories found:', categories.length);
    } catch (error) {
        console.log('❌ Database Service: Failed -', error.message);
    }
    
    // ทดสอบ LINE Service
    console.log('\n4. Testing LINE Service...');
    try {
        const LINEService = require('../services/line-service');
        const lineService = new LINEService();
        
        const isHealthy = await lineService.healthCheck();
        console.log(`${isHealthy ? '✅' : '❌'} LINE Service: ${isHealthy ? 'Working' : 'Failed'}`);
    } catch (error) {
        console.log('❌ LINE Service: Failed -', error.message);
    }
    
    console.log('\n🏁 Service testing completed!');
}

// Main execution
if (require.main === module) {
    const command = process.argv[2];
    
    switch (command) {
        case 'setup-db':
            setupDatabase();
            break;
        case 'health-check':
            healthCheck();
            break;
        case 'manual-report':
            manualReport();
            break;
        case 'test-services':
            testServices();
            break;
        default:
            console.log('Available commands:');
            console.log('  setup-db      - Setup database schema and initial data');
            console.log('  health-check  - Check all services health');
            console.log('  manual-report - Send reports manually');
            console.log('  test-services - Test all services functionality');
    }
}

module.exports = {
    setupDatabase,
    healthCheck,
    manualReport,
    testServices
};