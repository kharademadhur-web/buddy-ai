-- Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    personality_traits JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    goals TEXT[] DEFAULT ARRAY[]::TEXT[],
    challenges TEXT[] DEFAULT ARRAY[]::TEXT[],
    communication_style TEXT DEFAULT 'balanced' CHECK (communication_style IN ('casual', 'professional', 'empathetic', 'balanced')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    emotion_detected TEXT DEFAULT 'neutral' CHECK (emotion_detected IN ('joy', 'sadness', 'anger', 'fear', 'surprise', 'neutral')),
    emotion_confidence DECIMAL(3,2) DEFAULT 0.0,
    context_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create emotion_history table
CREATE TABLE IF NOT EXISTS public.emotion_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    emotion TEXT NOT NULL CHECK (emotion IN ('joy', 'sadness', 'anger', 'fear', 'surprise', 'neutral')),
    intensity DECIMAL(3,2) NOT NULL,
    trigger_context TEXT,
    response_given TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_memory table
CREATE TABLE IF NOT EXISTS public.user_memory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN ('fact', 'preference', 'event', 'relationship')),
    content TEXT NOT NULL,
    importance INTEGER DEFAULT 1 CHECK (importance BETWEEN 1 AND 10),
    last_accessed TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_emotion_history_user_id ON public.emotion_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_user_id ON public.user_memory(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emotion_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allowing all operations for now - you may want to restrict this later)
CREATE POLICY "Allow all operations on user_profiles" ON public.user_profiles FOR ALL USING (true);
CREATE POLICY "Allow all operations on conversations" ON public.conversations FOR ALL USING (true);
CREATE POLICY "Allow all operations on emotion_history" ON public.emotion_history FOR ALL USING (true);
CREATE POLICY "Allow all operations on user_memory" ON public.user_memory FOR ALL USING (true);