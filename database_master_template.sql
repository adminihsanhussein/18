-- ==============================================================================
-- 🏛️ نموذج قاعدة البيانات الشامل لنظام محاسبة وتوزيع وصولات البنيان المرصوص
-- 📌 Al-Bunyan Al-Marsoos - Master Database Blueprint & Schema Template
-- ==============================================================================
-- الغرض من هذا الملف:
-- يمكنك استخدام هذا الكود لإنشاء قاعدة بيانات مطابقة بنسبة 100% لأي دائرة جديدة
-- بمجرد نسخه ولصقه في محرر SQL (SQL Editor) في مشروع Supabase الجديد والضغط على Run.
-- ==============================================================================

-- 1️⃣ تفعيل الإضافات الأساسية لتوليد المعرفات الفريدة (UUIDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2️⃣ تنظيف الكائنات السابقة بأمان (في حال إعادة التهيئة أو التحديث)
-- ملاحظة: إسقاط الجداول بـ CASCADE يحذف تلقائياً كافة المشغلات والسياسات التابعة لها
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.receipts CASCADE;
DROP TABLE IF EXISTS public.books CASCADE;
DROP TABLE IF EXISTS public.allies CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TYPE IF EXISTS public.user_role CASCADE;

-- تنظيف الدوال العامة
DROP FUNCTION IF EXISTS public.notify_admins_on_new_receipt() CASCADE;
DROP FUNCTION IF EXISTS public.update_book_totals() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- تنظيف مشغل المستخدمين القديم بأمان
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  END IF;
END $$;

-- 3️⃣ إنشاء نوع الصلاحيات (Admin = مدير الدائرة, Ally = حليف/مسؤول جمع)
CREATE TYPE public.user_role AS ENUM ('admin', 'ally');

-- 4️⃣ جدول الملفات الشخصية والحسابات (مرتبط بـ auth.users في Supabase)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    role public.user_role DEFAULT 'ally',
    raw_password TEXT, -- كلمة المرور المؤقتة لتسهيل توزيع الحسابات على الحلفاء
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5️⃣ جدول الحلفاء الميدانيين (سجل تفصيلي اختياري للحلفاء وبياناتهم)
CREATE TABLE public.allies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    organization_slug TEXT DEFAULT 'al-bunyan-al-marsoos',
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6️⃣ جدول دفاتر الوصولات الشهرية (Books)
CREATE TABLE public.books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number TEXT NOT NULL UNIQUE,       -- رقم أول وصل / بداية الترقيم (مثلاً: 1001)
    book_name TEXT NOT NULL,                  -- اسم الدفتر (مثلاً: دفتر 1001)
    ally_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- الحليف المستلم
    total_amount BIGINT DEFAULT 0,            -- إجمالي مبالغ الدفتر المحصلة تلقائياً
    receipt_count INTEGER DEFAULT 0,          -- عدد الوصولات المحررة في الدفتر (حتى 50)
    month_year TEXT,                          -- شهر الدفتر بصيغة YYYY-MM (مثلاً: 2026-10)
    start_date DATE DEFAULT CURRENT_DATE,     -- تاريخ توزيع الدفتر
    received_date DATE,                       -- تاريخ استلام الدفتر مغلقاً من الحليف
    status TEXT DEFAULT 'open',               -- حالة الدفتر: 'open', 'delivered', 'audited', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7️⃣ جدول الوصولات الفردية (Receipts)
CREATE TABLE public.receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    ally_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- الحليف مدخل الوصل
    subscriber_name TEXT NOT NULL,            -- اسم المساهم / المتبرع
    receipt_number INTEGER NOT NULL UNIQUE,   -- رقم تسلسل الوصل الفريد
    amount BIGINT NOT NULL DEFAULT 0,         -- مبلغ الوصل بالدينار العراقي
    month_year TEXT,                          -- الشهر المخصص (مثلاً: 2026-10)
    receipt_date DATE DEFAULT CURRENT_DATE,   -- تاريخ تحرير الوصل الورقي
    status TEXT DEFAULT 'pending',            -- حالة الوصل: 'pending', 'approved', 'declined'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8️⃣ جدول الإشعارات الداخلية للتطبيق (Notifications)
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT DEFAULT 'system',               -- 'receipt_added', 'book_assigned', 'status_update'
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- ⚡ الفهارس الذكية لتحقيق أعلى سرعة استجابة (Performance Indexes)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_books_ally ON public.books(ally_id);
CREATE INDEX IF NOT EXISTS idx_books_status ON public.books(status);
CREATE INDEX IF NOT EXISTS idx_books_serial ON public.books(serial_number);
CREATE INDEX IF NOT EXISTS idx_receipts_book ON public.receipts(book_id);
CREATE INDEX IF NOT EXISTS idx_receipts_ally ON public.receipts(ally_id);
CREATE INDEX IF NOT EXISTS idx_receipts_month ON public.receipts(month_year);
CREATE INDEX IF NOT EXISTS idx_receipts_number ON public.receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON public.receipts(receipt_date);
CREATE INDEX IF NOT EXISTS idx_receipts_subscriber ON public.receipts(subscriber_name);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);

-- ==============================================================================
-- ⚙️ الدوال التلقائية والمشغلات (Triggers & Automated Functions)
-- ==============================================================================

-- أ) مشغل ربط المستخدمين: إنشاء بروفايل فور تسجيل أي مستخدم جديد في Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, raw_password)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم جديد'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'ally'),
    NEW.raw_user_meta_data->>'raw_password'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    raw_password = COALESCE(EXCLUDED.raw_password, public.profiles.raw_password);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ب) مشغل إحصائيات الدفتر: حساب إجمالي المبالغ وعدد الوصولات تلقائياً عند أي عملية
CREATE OR REPLACE FUNCTION public.update_book_totals()
RETURNS TRIGGER AS $$
DECLARE
    target_book_id UUID;
BEGIN
    target_book_id := COALESCE(NEW.book_id, OLD.book_id);
    
    UPDATE public.books
    SET 
        total_amount = (SELECT COALESCE(SUM(amount), 0) FROM public.receipts WHERE book_id = target_book_id),
        receipt_count = (SELECT COUNT(*) FROM public.receipts WHERE book_id = target_book_id)
    WHERE id = target_book_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_book_totals ON public.receipts;
CREATE TRIGGER trg_update_book_totals
AFTER INSERT OR UPDATE OR DELETE ON public.receipts
FOR EACH ROW EXECUTE FUNCTION public.update_book_totals();

-- ج) مشغل إشعارات المدير: إرسال إشعار فوري لجميع المدراء عند تسجيل وصل جديد
CREATE OR REPLACE FUNCTION public.notify_admins_on_new_receipt()
RETURNS TRIGGER AS $$
DECLARE
    admin_record RECORD;
    ally_name TEXT;
BEGIN
    -- جلب اسم الحليف مدخل الوصل
    SELECT full_name INTO ally_name FROM public.profiles WHERE id = NEW.ally_id;
    
    -- إرسال الإشعار لكل مدير
    FOR admin_record IN (SELECT id FROM public.profiles WHERE role = 'admin') LOOP
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (
            admin_record.id, 
            'وصل جديد مضاف', 
            'قام ' || COALESCE(ally_name, 'حليف') || ' بإضافة وصل جديد بقيمة ' || TO_CHAR(NEW.amount, 'FM999,999,999') || ' د.ع للمساهم: ' || NEW.subscriber_name,
            'receipt_added'
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_admin_on_receipt ON public.receipts;
CREATE TRIGGER trg_notify_admin_on_receipt
AFTER INSERT ON public.receipts
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_new_receipt();

-- ==============================================================================
-- 🔒 سياسات الأمان وحماية البيانات (Row Level Security - RLS)
-- ==============================================================================

-- تفعيل RLS على كافة الجداول
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- دالة فحص ما إذا كان المستخدم الحالي مدير (لتسريع التحقق دون تكرار)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 🛡️ 1. سياسات جدول Profiles
CREATE POLICY "Profiles viewable by authenticated users" 
ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles" 
ON public.profiles FOR ALL TO authenticated USING (public.is_admin());

-- 🛡️ 2. سياسات جدول Allies
CREATE POLICY "Allies viewable by authenticated" 
ON public.allies FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage allies" 
ON public.allies FOR ALL TO authenticated USING (public.is_admin());

-- 🛡️ 3. سياسات جدول Books
CREATE POLICY "Admins can view all books" 
ON public.books FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Allies view own books" 
ON public.books FOR SELECT TO authenticated USING (ally_id = auth.uid());

CREATE POLICY "Admins can manage all books" 
ON public.books FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "Allies can create assigned books" 
ON public.books FOR INSERT TO authenticated WITH CHECK (ally_id = auth.uid());

CREATE POLICY "Allies can update assigned books" 
ON public.books FOR UPDATE TO authenticated USING (ally_id = auth.uid());

-- 🛡️ 4. سياسات جدول Receipts
CREATE POLICY "Admins can view all receipts" 
ON public.receipts FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Allies view own receipts" 
ON public.receipts FOR SELECT TO authenticated USING (ally_id = auth.uid());

CREATE POLICY "Allies insert own receipts" 
ON public.receipts FOR INSERT TO authenticated WITH CHECK (ally_id = auth.uid());

CREATE POLICY "Admins manage all receipts" 
ON public.receipts FOR ALL TO authenticated USING (public.is_admin());

-- 🛡️ 5. سياسات جدول Notifications
CREATE POLICY "Users view own notifications" 
ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications" 
ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins insert notifications" 
ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Users insert notifications for self" 
ON public.notifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ==============================================================================
-- 📡 تفعيل التحديثات المباشرة (Realtime Publication)
-- ==============================================================================
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.receipts;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.books;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 💡 خطوة أخيرة: كيفية تعيين حساب المدير الأول بعد إنشاء الحساب
-- ==============================================================================
-- بعد إنشاء حساب المدير لأول مرة من شاشة Authentication > Add User في Supabase،
-- قم بتشغيل السطر التالي فقط في الـ SQL Editor لترقيته إلى مدير (Admin):
--
-- UPDATE public.profiles 
-- SET role = 'admin' 
-- WHERE email = 'اسم_بريدك_هنا@gmail.com';
-- ==============================================================================
