const cron = require('node-cron');
const databaseService = require('../services/database-service');
const lineService = require('../services/line-service');

class HelperService {
  // Schedule daily reports (runs at 8 PM every day)
  static scheduleDailyReports() {
    console.log('📅 Setting up daily report cron job...');
    
    cron.schedule('0 20 * * *', async () => {
      console.log('🔔 Running daily report cron job...');
      await this.sendDailyReports();
    }, {
      timezone: "Asia/Bangkok"
    });
    
    console.log('✅ Daily report cron job scheduled for 8:00 PM Bangkok time');
  }

  // Send daily reports to all active users
  static async sendDailyReports() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      
      console.log(`📊 Generating daily reports for ${dateStr}`);
      
      // Get all users who had expenses yesterday
      const usersWithExpenses = await databaseService.getUsersWithExpensesOnDate(dateStr);
      
      if (usersWithExpenses.length === 0) {
        console.log('ℹ️ No users with expenses found for yesterday');
        return;
      }

      let sentCount = 0;
      
      for (const user of usersWithExpenses) {
        try {
          const summary = await databaseService.getDailySummary(user.id, dateStr);
          
          if (summary && summary.length > 0) {
            await lineService.sendDailySummary(user.line_user_id, summary, dateStr);
            sentCount++;
            
            // Small delay to avoid rate limiting
            await this.delay(100);
          }
          
        } catch (userError) {
          console.error(`Error sending report to user ${user.line_user_id}:`, userError);
        }
      }
      
      console.log(`✅ Daily reports sent to ${sentCount} users`);
      
    } catch (error) {
      console.error('❌ Error in daily report cron job:', error);
    }
  }

  // Utility functions
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static formatCurrency(amount) {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB'
    }).format(amount);
  }

  static formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  }

  static calculateCategoryPercentages(categories, totalAmount) {
    const percentages = {};
    Object.entries(categories).forEach(([category, amount]) => {
      percentages[category] = {
        amount,
        percentage: ((amount / totalAmount) * 100).toFixed(1)
      };
    });
    return percentages;
  }

  // Test functions
  static async testDatabaseConnection() {
    try {
      await databaseService.testConnection();
      console.log('✅ Database connection test passed');
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      return false;
    }
  }

  static async testAWSServices() {
    try {
      const ocrService = require('../services/ocr-service');
      await ocrService.testConnection();
      console.log('✅ AWS services test passed');
      return true;
    } catch (error) {
      console.error('❌ AWS services test failed:', error);
      return false;
    }
  }

  static async testOpenAIService() {
    try {
      const aiService = require('../services/ai-service');
      await aiService.testConnection();
      console.log('✅ OpenAI service test passed');
      return true;
    } catch (error) {
      console.error('❌ OpenAI service test failed:', error);
      return false;
    }
  }
}

module.exports = HelperService;