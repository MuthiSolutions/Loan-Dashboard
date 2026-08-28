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
  final_deadline DATE,
  amount_paid BIGINT,
  last_payment_on DATE,
  repaid_on DATE,
  requested_amount BIGINT,
  term_months INT,
  deferral_months INT,
  status TEXT,
  documents JSONB NOT NULL DEFAULT '[]',
  notes JSONB NOT NULL DEFAULT '[]',
  repayment_history JSONB NOT NULL DEFAULT '[]',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Superseded by cash_movements below — balances are now a computed sum, not a
-- hand-maintained number. Left in place (unused) rather than dropped.
CREATE TABLE IF NOT EXISTS cash_position (
  id INT PRIMARY KEY DEFAULT 1,
  in_bank BIGINT NOT NULL,
  held_by_founder BIGINT NOT NULL,
  held_by_founder_note TEXT NOT NULL,
  notes JSONB NOT NULL DEFAULT '[]',
  CONSTRAINT single_row CHECK (id = 1)
);

-- Every cash inflow/outflow, per account. "In bank" and "held by founder" are
-- SUM(amount) over this table, filtered by account — never edited directly.
CREATE TABLE IF NOT EXISTS cash_movements (
  id SERIAL PRIMARY KEY,
  account TEXT NOT NULL CHECK (account IN ('bank', 'founder')),
  amount BIGINT NOT NULL, -- signed: positive = inflow, negative = outflow
  description TEXT NOT NULL,
  loan_id TEXT REFERENCES loans(id) ON DELETE SET NULL,
  -- Shared by both legs of an internal transfer between our own accounts (e.g. founder
  -- handing cash to the bank). Lets the UI show one "A -> B" line instead of a debit and
  -- a credit that net to zero and read as two unrelated, contradictory entries.
  transfer_id TEXT,
  occurred_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
