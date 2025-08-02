// services/scheduler-service.js
const cron = require('node-cron');
const DatabaseService = require('./database-service');
const LINEService = require('./line-service');

class SchedulerService {
    constructor() {
        this.dbService = new DatabaseService();
        this.lineService = new LINEService();
        this.jobs = new Map();
        this.isRunning = false;
    }

    /**
     * เริ่มต้น Scheduler
     */
    start() {
        if (this.isRunning) {
            console.log('Scheduler is already running');
            return;
        }

        console.log('Starting Scheduler Service...');
        
        // รายงานประจำวัน - ส่งทุกวันเวลา 20:00 น.
        this.scheduleDailyReport();
        
        // รายงานประจำเดือน - ส่งวันที่ 1 ของทุกเดือนเวลา 09:00 น.
        this.scheduleMonthlyReport();
        
        // ทำความสะอาดข้อมูลเก่า - ทุกวันอาทิตย์เวลา 02:00 น.
        this.scheduleCleanup();
        
        // ประมวลผลคิว - ทุก 5 นาที
        this.scheduleQueueProcessing();
        
        // สุขภาพระบบ - ทุกชั่วโมง
        this.scheduleHealthCheck();

        this.isRunning = true;
        console.log('All scheduled jobs started successfully');
    }

    /**
     * หยุด Scheduler
     */
    stop() {
        console.log('Stopping Scheduler Service...');
        
        this.jobs.forEach((job, name) => {
            job.stop();
            console.log(`Stopped job: ${name}`);
        });
        
        this.jobs.clear();
        this.isRunning = false;
        console.log('Scheduler stopped');
    }

    /**
     * ตั้งเวลาสำหรับรายงานประจำวัน
     */
    scheduleDailyReport() {
        // ทุกวันเวลา 20:00 น. (8:00 PM)
        const job = cron.schedule('0 20 * * *', async () => {
            console.log('Starting daily report generation...');
            try {
                await this.generateAndSendDailyReports();
                console.log('Daily reports sent successfully');
            } catch (error) {
                console.error('Error in daily report job:', error);
            }
        }, {
            scheduled: false,
            timezone: "Asia/Bangkok"
        });

        job.start();
        this.jobs.set('dailyReport', job);
        console.log('Daily report job scheduled for 20:00 (8:00 PM) Thailand time');
    }

    /**
     * ตั้งเวลาสำหรับรายงานประจำเดือน
     */
    scheduleMonthlyReport() {
        // วันที่ 1 ของทุกเดือนเวลา 09:00 น.
        const job = cron.schedule('0 9 1 * *', async () => {
            console.log('Starting monthly report generation...');
            try {
                await this.generateAndSendMonthlyReports();
                console.log('Monthly reports sent successfully');
            } catch (error) {
                console.error('Error in monthly report job:', error);
            }
        }, {
            scheduled: false,
            timezone: "Asia/Bangkok"
        });

        job.start();
    this.jobs.set('monthlyReport', job);
    console.log('Monthly report job scheduled for 1st of every month at 09:00 AM');
}

/**
 * ตั้งเวลาสำหรับการทำความสะอาดข้อมูล
 */
scheduleCleanup() {
    // ทุกวันอาทิตย์เวลา 02:00 น.
    // TODO: Implement cleanup logic here
    // Example:
    // const job = cron.schedule('0 2 * * 0', async () => {
    //     console.log('Starting weekly cleanup...');
    //     try {
    //         await this.dbService.cleanupOldData();
    //         console.log('Cleanup completed successfully');
    //     } catch (error) {
    //         console.error('Error in cleanup job:', error);
    //     }
    // }, {
    //     scheduled: false,
    //     timezone: "Asia/Bangkok"
    // });
    // job.start();
    // this.jobs.set('cleanup', job);
    // console.log('Cleanup job scheduled for every Sunday at 02:00 AM');
    // For now, just log
    console.log('Cleanup job scheduled (not yet implemented)');
}
}
module.exports = SchedulerService;