ALTER TABLE quotations DROP CONSTRAINT quotations_status_check; ALTER TABLE quotations ADD CONSTRAINT quotations_status_check CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'accepted'));
