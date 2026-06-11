-- SQL Script for Supabase SQL Editor
-- This script sets up all tables, relations, indexes, and triggers for Tradyum.
-- Go to your Supabase Dashboard -> SQL Editor -> New Query, paste this script, and click "Run".

-- 1. DROP EXISTING TRIGGERS AND FUNCTIONS TO AVOID CONFLICTS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. CREATE PROFILES TABLE REQUIRED BY TRADYUM CLIENT
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    timezone TEXT DEFAULT 'UTC',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Simple RLS Policies for Profiles
DROP POLICY IF EXISTS "Allow individual read" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual insert" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual update" ON public.profiles;

CREATE POLICY "Allow individual read" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Allow individual insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Allow individual update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 3. CREATE AUTOMATIC TRIGGERS (Re-created cleanly to match expected profiles schema)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, timezone)
    VALUES (
        new.id, 
        new.email, 
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        'UTC'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. CREATE ACCOUNTS TABLE WITH RISK MITIGATION PARAMETERS
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    broker TEXT,
    account_number TEXT,
    currency TEXT DEFAULT 'USD',
    initial_balance NUMERIC DEFAULT 0,
    current_balance NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    color TEXT DEFAULT '#3b82f6',
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_at TIMESTAMP WITH TIME ZONE,
    block_reason TEXT,
    daily_loss_limit NUMERIC DEFAULT -200,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow owner read" ON public.accounts;
DROP POLICY IF EXISTS "Allow owner insert" ON public.accounts;
DROP POLICY IF EXISTS "Allow owner update" ON public.accounts;
DROP POLICY IF EXISTS "Allow owner delete" ON public.accounts;

CREATE POLICY "Allow owner read" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow owner insert" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow owner update" ON public.accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Allow owner delete" ON public.accounts FOR DELETE USING (auth.uid() = user_id);

-- 5. CREATE TRADES TABLE
CREATE TABLE IF NOT EXISTS public.trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES public.accounts ON DELETE CASCADE NOT NULL,
    broker_trade_id TEXT,
    symbol TEXT NOT NULL,
    asset_class TEXT,
    direction TEXT,
    entry_price NUMERIC,
    exit_price NUMERIC,
    stop_loss NUMERIC,
    take_profit NUMERIC,
    quantity NUMERIC,
    entry_time TIMESTAMP WITH TIME ZONE,
    exit_time TIMESTAMP WITH TIME ZONE,
    gross_pnl NUMERIC DEFAULT 0,
    commission NUMERIC DEFAULT 0,
    net_pnl NUMERIC DEFAULT 0,
    status TEXT,
    import_source TEXT,
    raw_data JSONB,
    notes TEXT,
    tags TEXT[],
    emotions TEXT[],
    rating INTEGER,
    screenshot_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow owner read" ON public.trades;
DROP POLICY IF EXISTS "Allow owner insert" ON public.trades;
DROP POLICY IF EXISTS "Allow owner update" ON public.trades;
DROP POLICY IF EXISTS "Allow owner delete" ON public.trades;

CREATE POLICY "Allow owner read" ON public.trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow owner insert" ON public.trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow owner update" ON public.trades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Allow owner delete" ON public.trades FOR DELETE USING (auth.uid() = user_id);

-- 6. CREATE DAILY_STATS TABLE
CREATE TABLE IF NOT EXISTS public.daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES public.accounts ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    win_rate NUMERIC DEFAULT 0,
    net_pnl NUMERIC DEFAULT 0,
    profit_factor NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_user_account_date UNIQUE (user_id, account_id, date)
);

ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow owner read" ON public.daily_stats;
DROP POLICY IF EXISTS "Allow owner insert" ON public.daily_stats;
DROP POLICY IF EXISTS "Allow owner update" ON public.daily_stats;
DROP POLICY IF EXISTS "Allow owner delete" ON public.daily_stats;

CREATE POLICY "Allow owner read" ON public.daily_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow owner insert" ON public.daily_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow owner update" ON public.daily_stats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Allow owner delete" ON public.daily_stats FOR DELETE USING (auth.uid() = user_id);
