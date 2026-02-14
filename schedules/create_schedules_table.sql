-- =====================================================
-- Polaris Schedules - Complete Database Setup
-- Run this entire script in the Supabase SQL Editor
--
-- NOTE: Scheduling is handled by the Node.js backend
-- engine (scheduleEngine.js). No pg_cron, pg_net, or
-- webhook configuration is needed.
-- =====================================================

-- =====================================================
-- Step 1: Create the schedules table
-- =====================================================
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Schedule details
  type TEXT NOT NULL CHECK (type IN ('reminder', 'action')),
  content TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  recurring BOOLEAN DEFAULT false,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed')),

  -- Execution tracking
  next_execution TIMESTAMPTZ NOT NULL,
  last_execution TIMESTAMPTZ,
  execution_count INTEGER DEFAULT 0,

  -- Metadata
  timezone TEXT DEFAULT 'UTC',
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Step 2: Create indexes for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_next_execution ON schedules(next_execution) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);
CREATE INDEX IF NOT EXISTS idx_schedules_user_status ON schedules(user_id, status);

-- =====================================================
-- Step 3: Enable Row Level Security
-- =====================================================
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can only access their own schedules
CREATE POLICY "Users can view own schedules"
  ON schedules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own schedules"
  ON schedules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedules"
  ON schedules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own schedules"
  ON schedules FOR DELETE
  USING (auth.uid() = user_id);

-- Service role bypass policy (for the Node.js scheduler engine)
CREATE POLICY "Service role can manage all schedules"
  ON schedules FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- Step 4: Create updated_at trigger
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists before creating
DROP TRIGGER IF EXISTS update_schedules_updated_at ON schedules;

CREATE TRIGGER update_schedules_updated_at
  BEFORE UPDATE ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Step 5: Create helper function to increment execution count
-- =====================================================
CREATE OR REPLACE FUNCTION increment_schedule_execution_count(schedule_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE schedules
  SET execution_count = execution_count + 1
  WHERE id = schedule_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Step 6: Verify setup
-- =====================================================
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'schedules';

-- =====================================================
-- CLEANUP: If you previously used pg_cron / pg_net,
-- run these commands to remove old objects:
-- =====================================================
-- SELECT cron.unschedule('execute-schedules');
-- DROP FUNCTION IF EXISTS execute_schedules();
-- DROP TABLE IF EXISTS schedule_config;
