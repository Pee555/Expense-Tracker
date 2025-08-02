async function healthCheck() {
    console.log('🏥 Performing health check...');
    
    const results = {
        timestamp: new Date().toISOString(),
        services: {}
    };

    // ตรวจสอบ Database
    try {
        const DatabaseService = require('../services/database-service');
        const dbService = new DatabaseService();
        await dbService.healthCheck();
        results.services.database = { status: 'healthy', message: 'Connected successfully' };
        console.log('✅ Database: Healthy');
    } catch (error) {
        results.services.database = { status: 'unhealthy', message: error.message };
        console.log('❌ Database: Unhealthy -', error.message);
    }

    // ตรวจสอบ AWS S3
    try {
        const AWSService = require('../services/aws-service');
        const awsService = new AWSService();
        const s3Status = await awsService.checkS3Connection();
        const textractStatus = await awsService.checkTextractConnection();
        
        results.services.aws = { 
            status: s3Status && textractStatus ? 'healthy' : 'unhealthy',
            s3: s3Status,
            textract: textractStatus
        };
        console.log(`${s3Status && textractStatus ? '✅' : '❌'} AWS Services: ${s3Status && textractStatus ? 'Healthy' : 'Unhealthy'}`);
    } catch (error) {
        results.services.aws = { status: 'unhealthy', message: error.message };
        console.log('❌ AWS Services: Unhealthy -', error.message);
    }

    // ตรวจสอบ LINE API
    try {
        const LINEService = require('../services/line-service');
        const lineService = new LINEService();
        const lineStatus = await lineService.healthCheck();
        
        results.services.line = { 
            status: lineStatus ? 'healthy' : 'unhealthy',
            message: lineStatus ? 'API accessible' : 'API not accessible'
        };
        console.log(`${lineStatus ? '✅' : '❌'} LINE API: ${lineStatus ? 'Healthy' : 'Unhealthy'}`);
    } catch (error) {
        results.services.line = { status: 'unhealthy', message: error.message };
        console.log('❌ LINE API: Unhealthy -', error.message);
    }

    // ตรวจสอบ OpenAI API
    try {
        const AIService = require('../services/ai-service');
        const aiService = new AIService();
        const aiStatus = await aiService.healthCheck();
        
        results.services.openai = { 
            status: aiStatus ? 'healthy' : 'unhealthy',
            message: aiStatus ? 'API accessible' : 'API not accessible'
        };
        console.log(`${aiStatus ? '✅' : '❌'} OpenAI API: ${aiStatus ? 'Healthy' : 'Unhealthy'}`);
    } catch (error) {
        results.services.openai = { status: 'unhealthy', message: error.message };
        console.log('❌ OpenAI API: Unhealthy -', error.message);
    }

    // สรุปผลลัพธ์
    const healthyServices = Object.values(results.services).filter(s => s.status === 'healthy').length;
    const totalServices = Object.keys(results.services).length;
    
    console.log('\n📊 Health Check Summary:');
    console.log(`Healthy Services: ${healthyServices}/${totalServices}`);
    console.log('Results:', JSON.stringify(results, null, 2));
    
    return results;
}