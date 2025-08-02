// services/database-service.js
const { createClient } = require('@supabase/supabase-js');
const config = require('../config/config');

const supabase = createClient(config.supabase.url, config.supabase.anonKey);

class DatabaseService {
  // สร้าง tables (รันครั้งแรกเพื่อสร้างโครงสร้างฐานข้อมูล)
  async initializeTables() {
    try {
      // สร้างตาราง users
      const { error: userError } = await supabase.rpc('create_users_table', {});
      
      // สร้างตาราง expenses
      const { error: expenseError } = await supabase.rpc('create_expenses_table', {});
      
      // สร้างตาราง expense_items
      const { error: itemError } = await supabase.rpc('create_expense_items_table', {});
      
      console.log('Tables initialized successfully');
    } catch (error) {
      console.error('Error initializing tables:', error);
    }
  }

  // บันทึกผู้ใช้ใหม่
  async createUser(userId, profileData = {}) {
    try {
      const { data, error } = await supabase
        .from('users')
        .upsert({
          line_user_id: userId,
          display_name: profileData.displayName || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  // บันทึกข้อมูลค่าใช้จ่าย
  async saveExpenseRecord(expenseData) {
    try {
      const { userId, items, total, date, merchant, rawOcr } = expenseData;

      // บันทึกข้อมูลหลักใน expenses table
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          line_user_id: userId,
          merchant_name: merchant || 'ไม่ระบุ',
          total_amount: parseFloat(total) || 0,
          expense_date: date || new Date().toISOString().split('T')[0],
          raw_ocr_text: rawOcr,
          created_at: new Date().toISOString()
        })
        .select();

      if (expenseError) throw expenseError;

      const expenseId = expense[0].id;

      // บันทึกรายการสินค้าแต่ละชิ้น
      if (items && items.length > 0) {
        const itemsToInsert = items.map(item => ({
          expense_id: expenseId,
          item_name: item.name || 'ไม่ระบุ',
          item_price: parseFloat(item.price) || 0,
          item_quantity: parseInt(item.quantity) || 1,
          item_category: item.category || 'อื่นๆ'
        }));

        const { error: itemsError } = await supabase
          .from('expense_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      return expense[0];
    } catch (error) {
      console.error('Error saving expense record:', error);
      throw error;
    }
  }

  // ดึงสรุปรายวัน
  async getDailySummary(userId, date = null) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];

      // ดึงข้อมูลค่าใช้จ่ายวันนี้
      const { data: expenses, error } = await supabase
        .from('expenses')
        .select(`
          *,
          expense_items (*)
        `)
        .eq('line_user_id', userId)
        .eq('expense_date', targetDate);

      if (error) throw error;

      if (!expenses || expenses.length === 0) {
        return {
          totalExpenses: 0,
          receiptCount: 0,
          topCategories: []
        };
      }

      // คำนวณยอดรวม
      const totalExpenses = expenses.reduce((sum, expense) => sum + expense.total_amount, 0);

      // จัดกลุ่มตามหมวดหมู่
      const categoryTotals = {};
      expenses.forEach(expense => {
        if (expense.expense_items) {
          expense.expense_items.forEach(item => {
            const category = item.item_category || 'อื่นๆ';
            categoryTotals[category] = (categoryTotals[category] || 0) + item.item_price;
          });
        }
      });

      // จัดเรียงหมวดหมู่ตามยอดเงิน
      const topCategories = Object.entries(categoryTotals)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      return {
        totalExpenses,
        receiptCount: expenses.length,
        topCategories,
        expenses
      };
    } catch (error) {
      console.error('Error getting daily summary:', error);
      throw error;
    }
  }

  // ดึงสรุปรายเดือน
  async getMonthlySummary(userId, year = null, month = null) {
    try {
      const currentDate = new Date();
      const targetYear = year || currentDate.getFullYear();
      const targetMonth = month || (currentDate.getMonth() + 1);

      const startDate = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-01`;
      const endDate = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];

      const { data: expenses, error } = await supabase
        .from('expenses')
        .select(`
          *,
          expense_items (*)
        `)
        .eq('line_user_id', userId)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

      if (error) throw error;

      if (!expenses || expenses.length === 0) {
        return {
          totalExpenses: 0,
          receiptCount: 0,
          averagePerDay: 0,
          topCategories: [],
          dailyBreakdown: []
        };
      }

      const totalExpenses = expenses.reduce((sum, expense) => sum + expense.total_amount, 0);

      // จัดกลุ่มตามวัน
      const dailyTotals = {};
      expenses.forEach(expense => {
        const date = expense.expense_date;
        dailyTotals[date] = (dailyTotals[date] || 0) + expense.total_amount;
      });

      // จัดกลุ่มตามหมวดหมู่
      const categoryTotals = {};
      expenses.forEach(expense => {
        if (expense.expense_items) {
          expense.expense_items.forEach(item => {
            const category = item.item_category || 'อื่นๆ';
            categoryTotals[category] = (categoryTotals[category] || 0) + item.item_price;
          });
        }
      });

      const topCategories = Object.entries(categoryTotals)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);

      const dailyBreakdown = Object.entries(dailyTotals)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
      const averagePerDay = totalExpenses / daysInMonth;

      return {
        totalExpenses,
        receiptCount: expenses.length,
        averagePerDay,
        topCategories,
        dailyBreakdown
      };
    } catch (error) {
      console.error('Error getting monthly summary:', error);
      throw error;
    }
  }

  // ดึงรายการค่าใช้จ่ายล่าสุด
  async getRecentExpenses(userId, limit = 10) {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          expense_items (*)
        `)
        .eq('line_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting recent expenses:', error);
      throw error;
    }
  }

  // ลบข้อมูลค่าใช้จ่าย
  async deleteExpense(expenseId, userId) {
    try {
      // ตรวจสอบว่าเป็นเจ้าของข้อมูล
      const { data: expense, error: checkError } = await supabase
        .from('expenses')
        .select('id')
        .eq('id', expenseId)
        .eq('line_user_id', userId)
        .single();

      if (checkError || !expense) {
        throw new Error('ไม่พบข้อมูลหรือไม่มีสิทธิ์ลบ');
      }

      // ลบรายการสินค้าก่อน
      await supabase
        .from('expense_items')
        .delete()
        .eq('expense_id', expenseId);

      // ลบข้อมูลหลัก
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  }
}

module.exports = new DatabaseService();