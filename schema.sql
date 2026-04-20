-- Clean up existing objects for a fresh start
DROP TRIGGER IF EXISTS trg_update_book_totals ON receipts;
DROP FUNCTION IF EXISTS update_book_totals();
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TABLE IF EXISTS receipts;
DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS allies;
DROP TABLE IF EXISTS profiles;
DROP TYPE IF EXISTS user_role;

-- Create Role Type
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'ally');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create Profiles Table (Linked to Auth)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    role user_role DEFAULT 'ally',
    raw_password TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Allies/Supporters Table (Optional - for managing people who don't have logins yet or just as profiles)
CREATE TABLE IF NOT EXISTS allies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    organization_slug TEXT DEFAULT 'al-bunyan-al-marsoos',
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Books Table
CREATE TABLE IF NOT EXISTS books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number TEXT NOT NULL UNIQUE,
    book_name TEXT, -- The name given when the first receipt is registered
    ally_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    total_amount BIGINT DEFAULT 0,
    receipt_count INTEGER DEFAULT 0,
    start_date DATE DEFAULT CURRENT_DATE,
    received_date DATE,
    status TEXT DEFAULT 'open', -- 'open', 'delivered', 'audited', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Receipts Table
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    ally_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Track who entered it
    subscriber_name TEXT NOT NULL,
    receipt_number INTEGER NOT NULL UNIQUE,
    amount BIGINT NOT NULL DEFAULT 0,
    month_year TEXT, -- Format: '2026-04'
    receipt_date DATE,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'declined'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE allies ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Books Policies
CREATE POLICY "Admins can view all books" ON books FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Allies can view their own books" ON books FOR SELECT USING (
    ally_id = auth.uid()
);
CREATE POLICY "Admins can manage books" ON books FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
-- Allies can insert a book if they are creating it for themselves
CREATE POLICY "Allies can create their own books" ON books FOR INSERT WITH CHECK (
    ally_id = auth.uid()
);

-- Receipts Policies
CREATE POLICY "Admins can view all receipts" ON receipts FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Allies can view their own receipts" ON receipts FOR SELECT USING (
    ally_id = auth.uid()
);
CREATE POLICY "Allies can insert their own receipts" ON receipts FOR INSERT WITH CHECK (
    ally_id = auth.uid()
);
CREATE POLICY "Admins can manage all receipts" ON receipts FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Trigger to automatically create a profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, raw_password)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email, 'ally', new.raw_user_meta_data->>'raw_password');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for book totals
CREATE OR REPLACE FUNCTION update_book_totals()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE books
    SET 
        total_amount = (SELECT COALESCE(SUM(amount), 0) FROM receipts WHERE book_id = COALESCE(NEW.book_id, OLD.book_id)),
        receipt_count = (SELECT COUNT(*) FROM receipts WHERE book_id = COALESCE(NEW.book_id, OLD.book_id))
    WHERE id = COALESCE(NEW.book_id, OLD.book_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_book_totals
AFTER INSERT OR UPDATE OR DELETE ON receipts
FOR EACH ROW EXECUTE FUNCTION update_book_totals();

-- Create Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT, -- 'receipt_added', 'book_assigned', 'status_update'
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Notifications Policies
CREATE POLICY "Users can view their own notifications" ON notifications FOR SELECT USING (
    user_id = auth.uid()
);
CREATE POLICY "Users can update their own notifications (mark as read)" ON notifications FOR UPDATE USING (
    user_id = auth.uid()
);
-- Admins can create notifications for any user
CREATE POLICY "Admins can insert notifications" ON notifications FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
-- Allow users to insert notifications for themselves (e.g. on personal actions)
CREATE POLICY "Users can insert notifications for themselves" ON notifications FOR INSERT WITH CHECK (
    user_id = auth.uid()
);

-- Enable Realtime for notifications
-- Note: This requires running as a superuser/on the dashboard, but adding here for completeness.
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Function to notify Admins when a new receipt is inserted
CREATE OR REPLACE FUNCTION public.notify_admins_on_new_receipt()
RETURNS TRIGGER AS $$
DECLARE
    admin_id UUID;
    ally_name TEXT;
BEGIN
    -- Get the name of the ally who added the receipt
    SELECT full_name INTO ally_name FROM public.profiles WHERE id = NEW.ally_id;
    
    -- Loop through all admins and insert a notification for each
    FOR admin_id IN (SELECT id FROM public.profiles WHERE role = 'admin') LOOP
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (
            admin_id, 
            'وصل جديد مضاف', 
            'قام ' || COALESCE(ally_name, 'حليف') || ' بإضافة وصل جديد بقيمة ' || NEW.amount || ' د.ع لمساهم: ' || NEW.subscriber_name,
            'receipt_added'
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for receipts table
DROP TRIGGER IF EXISTS trg_notify_admin_on_receipt ON receipts;
CREATE TRIGGER trg_notify_admin_on_receipt
AFTER INSERT ON receipts
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_new_receipt();
