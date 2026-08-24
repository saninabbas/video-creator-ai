-- ============================================================================
-- Migration 002: Scalability, Worker Leases, Retries & Hybrid Visuals
-- Compatible with both PostgreSQL and SQLite
-- ============================================================================

-- 1. Add Worker Leasing & Retry Tracking to video_jobs
ALTER TABLE video_jobs ADD COLUMN worker_id TEXT;
ALTER TABLE video_jobs ADD COLUMN lease_expires_at TIMESTAMP;
ALTER TABLE video_jobs ADD COLUMN attempt_count INTEGER DEFAULT 0;
ALTER TABLE video_jobs ADD COLUMN max_attempts INTEGER DEFAULT 3;
ALTER TABLE video_jobs ADD COLUMN next_retry_at TIMESTAMP;

-- 2. Add Visual Classification to video_scenes
ALTER TABLE video_scenes ADD COLUMN visual_type TEXT DEFAULT 'premium_veo';

-- 3. Composite Performance Indices for Queue Scalability
CREATE INDEX IF NOT EXISTS idx_video_jobs_queue_poll ON video_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_video_jobs_worker_lease ON video_jobs(worker_id, lease_expires_at);
