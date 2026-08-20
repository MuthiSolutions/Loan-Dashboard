CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('active', 'pipeline_term', 'pipeline_pending')),
  borrower TEXT NOT NULL,
  purpose TEXT,
  contact TEXT,
  principal BIGINT NOT NULL,
  fees JSONB NOT NULL DEFAULT '[]',
  total_due BIGINT,
  disbursed_on DATE,
  due_on DATE,
  late_penalty_rate_per_week NUMERIC NOT NULL DEFAULT 0.01,
  contract_ref TEXT,
  related_party BOOLEAN NOT NULL DEFAULT FALSE,
  manual_amount_override BIGINT,
  requested_amount BIGINT,
  term_months INT,
  deferral_months INT,
  status TEXT,
  documents JSONB NOT NULL DEFAULT '[]',
  notes JSONB NOT NULL DEFAULT '[]',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cash_position (
  id INT PRIMARY KEY DEFAULT 1,
  in_bank BIGINT NOT NULL,
  held_by_founder BIGINT NOT NULL,
  held_by_founder_note TEXT NOT NULL,
  notes JSONB NOT NULL DEFAULT '[]',
  CONSTRAINT single_row CHECK (id = 1)
);
