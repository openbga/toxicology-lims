-- A person may reject a received message held for review, not only one waiting for its
-- patient (ticket #4886; REQ-INT-002). The trigger of 0011 let only a waiting message's
-- state change, so rejecting a held message aborted. What was read stays as read; only a
-- waiting or held message's outcome and the file's new place are recorded later.
DROP TRIGGER ifc_partner_received_kept;

CREATE TRIGGER ifc_partner_received_kept
BEFORE UPDATE ON ifc_partner_received
WHEN NEW.id IS NOT OLD.id OR NEW.connection_id IS NOT OLD.connection_id
    OR NEW.file_name IS NOT OLD.file_name OR NEW.artifact_sha256 IS NOT OLD.artifact_sha256
    OR NEW.received_at IS NOT OLD.received_at OR NEW.control_id IS NOT OLD.control_id
    OR NEW.placer_order IS NOT OLD.placer_order OR NEW.duplicate_of IS NOT OLD.duplicate_of
    OR (OLD.moved_to IS NOT NULL AND NEW.moved_to IS NOT OLD.moved_to)
    OR (OLD.state NOT IN ('waiting_patient', 'held') AND NEW.state IS NOT OLD.state)
BEGIN
    SELECT RAISE(ABORT, 'a received message is kept as read');
END;
