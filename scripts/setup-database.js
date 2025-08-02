const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
    console.log('🚀 Setting up database...');
    
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    try {
        // อ่านไฟล์ SQL Schema
        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
        
        try {
            const schema = await fs.readFile(schemaPath, 'utf8');
            console.log('📄 Schema file loaded successfully');
            
            // รัน SQL Schema (สำหรับ Supabase จะต้องรันผ่าน SQL Editor)
            console.log('⚠️  Please run the schema manually in Supabase SQL Editor');
            console.log('📁 Schema file location:', schemaPath);
            
        } catch (fileError) {
            console.log('📄 Schema file not found, using inline schema...');
            
            // ตรวจสอบว่าตารางมีอยู่แล้วหรือไม่
            const { data: tables, error: tablesError } = await supabase
                .from('information_schema.tables')
                .select('table_name')
                .eq('table_schema', 'public');

            if (tablesError) {
                console.error('❌ Error checking existing tables:', tablesError);
                return;
            }

            const existingTables = tables.map(t => t.table_name);
            console.log('📋 Existing tables:', existingTables);
        }

        // ตรวจสอบการเชื่อมต่อ
        const { data: connectionTest, error: connectionError } = await supabase
            .from('users')
            .select('count')
            .limit(1);

        if (connectionError) {
            console.log('⚠️  Users table not found, please create the schema first');
        } else {
            console.log('✅ Database connection successful');
        }

        // สร้างข้อมูลหมวดหมู่เริ่มต้นถ้ายังไม่มี
        const { data: categories, error: categoriesError } = await supabase
            .from('categories')
            .select('*')
            .limit(1);

        if (categoriesError || !categories || categories.length === 0) {
            console.log('📂 Creating default categories...');
            
            const defaultCategories = [
                { name: 'Food & Dining', name_th: 'อาหารและเครื่องดื่ม', icon: '🍽️', color: '#FF6B6B' },
                { name: 'Groceries', name_th: 'ของใช้ในบ้าน', icon: '🛒', color: '#4ECDC4' },
                { name: 'Transportation', name_th: 'การเดินทาง', icon: '🚗', color: '#45B7D1' },
                { name: 'Shopping', name_th: 'ช้อปปิ้ง', icon: '🛍️', color: '#96CEB4' },
                { name: 'Healthcare', name_th: 'สุขภาพ', icon: '⚕️', color: '#FFEAA7' },
                { name: 'Entertainment', name_th: 'บันเทิง', icon: '🎬', color: '#DDA0DD' },
                { name: 'Utilities', name_th: 'ค่าสาธารณูปโภค', icon: '💡', color: '#98D8C8' },
                { name: 'Education', name_th: 'การศึกษา', icon: '📚', color: '#F7DC6F' },
                { name: 'Personal Care', name_th: 'ดูแลตัวเอง', icon: '💄', color: '#BB8FCE' },
                { name: 'Others', name_th: 'อื่นๆ', icon: '📦', color: '#AED6F1' }
            ];

            const { error: insertError } = await supabase
                .from('categories')
                .insert(defaultCategories);

            if (insertError) {
                console.error('❌ Error creating categories:', insertError);
            } else {
                console.log('✅ Default categories created successfully');
            }
        } else {
            console.log('✅ Categories already exist');
        }

        console.log('🎉 Database setup completed!');
        
    } catch (error) {
        console.error('❌ Database setup failed:', error);
        process.exit(1);
    }
}