-- The ordering practitioner's phone, which the LIMSiq Patient Portal shows with each result.
-- Required for every new or corrected practitioner; practitioners registered before have none
-- until corrected. The directory history keeps it with every revision.
ALTER TABLE idn_practitioners ADD COLUMN phone TEXT CHECK (phone IS NULL OR length(phone) BETWEEN 7 AND 40);
ALTER TABLE idn_directory_history ADD COLUMN phone TEXT;

DROP TRIGGER idn_practitioners_versioned;
CREATE TRIGGER idn_practitioners_versioned BEFORE UPDATE ON idn_practitioners
WHEN NEW.id IS NOT OLD.id OR NEW.created_at IS NOT OLD.created_at
 OR NEW.revision <> OLD.revision + 1 OR NOT EXISTS (
    SELECT 1 FROM idn_directory_history h WHERE h.record_kind='practitioner'
      AND h.record_id=NEW.id AND h.revision=NEW.revision AND h.code=NEW.npi
      AND h.name=NEW.family_name AND h.active=NEW.active
      AND h.given_names IS NEW.given_names AND h.phone IS NEW.phone
 )
BEGIN SELECT RAISE(ABORT, 'directory correction requires matching immutable history'); END;
