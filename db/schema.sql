CREATE TABLE IF NOT EXISTS stm (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  status TEXT NOT NULL,
  channel TEXT NOT NULL,
  author_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  last_signal_at TIMESTAMPTZ NOT NULL,
  context JSONB NOT NULL DEFAULT '[]'::jsonb,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS signal_log (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  channel TEXT NOT NULL,
  author_id TEXT NOT NULL,
  session_id TEXT,
  topic TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS execution_run (
  id TEXT PRIMARY KEY,
  signal_id TEXT NOT NULL,
  recipe_id TEXT NOT NULL,
  execution_pattern TEXT NOT NULL,
  status TEXT NOT NULL,
  gate TEXT NOT NULL,
  assigned_agent TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS agent_invocation (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  recipe_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  phase TEXT NOT NULL,
  status TEXT NOT NULL,
  model_mode TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS tool_call (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  agent_invocation_id TEXT,
  tool_name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  input_summary TEXT,
  output_summary TEXT,
  blocked_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS artifact_log (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  artifact_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  path TEXT NOT NULL,
  access_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  session_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS capture_log (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  session_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  quick_classification JSONB,
  deep_classification JSONB,
  clarification JSONB,
  content_quality JSONB,
  library_id TEXT,
  rejected_reason TEXT,
  review_notes JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS decision_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  input TEXT,
  capture_id TEXT,
  session_id TEXT,
  confidence DOUBLE PRECISION,
  threshold_used TEXT,
  auto_approved BOOLEAN NOT NULL DEFAULT FALSE,
  user_response TEXT,
  eval_agent_model TEXT,
  decision JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_queue (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  content TEXT NOT NULL,
  deliver_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
