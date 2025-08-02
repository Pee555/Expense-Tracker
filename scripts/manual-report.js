async function manualReport() {
    const SchedulerService = require('../services/scheduler-service');
    const scheduler = new SchedulerService();
    
    const args = process.argv.slice(2);
    const reportType = args[0] || 'daily';
    const userLineId = args[1];
    
    console.log(`📊 Generating ${reportType} report...`);
    
    try {
        if (reportType === 'daily') {
            if (userLineId) {
                console.log(`Sending daily report to specific user: ${userLineId}`);
                // เฉพาะผู้ใช้คนนั้น
                const DatabaseService = require('../services/database-service');
                const dbService = new DatabaseService();
                const user = await dbService.getUserByLineId(userLineId);
                
                if (user) {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const dateStr = yesterday.toISOString().split('T')[0];
                    
                    await dbService.generateDailySummary(user.id, dateStr);
                    const summary = await dbService.getDailySummary(user.id, dateStr);
                    
                    if (summary) {
                        const LINEService = require('../services/line-service');
                        const lineService = new LINEService();
                        const reportMessage = scheduler.createDailyReportMessage(summary, dateStr);
                        
                        await lineService.sendMessage(userLineId, reportMessage);
                        console.log('✅ Daily report sent successfully');
                    } else {
                        console.log('❌ No data found for yesterday');
                    }
                } else {
                    console.log('❌ User not found');
                }
            } else {
                await scheduler.generateAndSendDailyReports();
                console.log('✅ Daily reports sent to all users');
            }
        } else if (reportType === 'monthly') {
            await scheduler.generateAndSendMonthlyReports();
            console.log('✅ Monthly reports sent to all users');
        } else {
            console.log('❌ Invalid report type. Use: daily or monthly');
            console.log('Usage: npm run manual-report [daily|monthly] [line_user_id]');
        }
    } catch (error) {
        console.error('❌ Error generating report:', error);
    }
}