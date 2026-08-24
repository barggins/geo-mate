-- 1. payment status enum extensions
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'proof_uploaded';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'disputed';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'expired';
