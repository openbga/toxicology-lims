-- The patient's email for the LIMSiq Patient Portal, as an append-only history. A filled
-- email is the patient's consent to portal delivery; a row with no email records that it
-- was removed, so nothing more is sent. The latest row is the current one.
CREATE TABLE idn_subject_emails (
    subject_id       TEXT    NOT NULL REFERENCES idn_subjects (id),
    sequence         INTEGER NOT NULL CHECK (sequence >= 1),
    email            TEXT    CHECK (email IS NULL OR length(email) BETWEEN 3 AND 254),
    recorded_at      TEXT    NOT NULL,
    recorded_by_kind TEXT    NOT NULL CHECK (recorded_by_kind IN ('user', 'instrument', 'system')),
    recorded_by_id   TEXT    NOT NULL,
    PRIMARY KEY (subject_id, sequence)
) STRICT;

CREATE TRIGGER idn_subject_emails_sequence BEFORE INSERT ON idn_subject_emails
WHEN NEW.sequence <> (SELECT coalesce(max(sequence), 0) + 1 FROM idn_subject_emails
                      WHERE subject_id = NEW.subject_id)
BEGIN SELECT RAISE(ABORT, 'email history sequence must be consecutive'); END;
CREATE TRIGGER idn_subject_emails_no_update BEFORE UPDATE ON idn_subject_emails
BEGIN SELECT RAISE(ABORT, 'email history is append-only'); END;
CREATE TRIGGER idn_subject_emails_no_delete BEFORE DELETE ON idn_subject_emails
BEGIN SELECT RAISE(ABORT, 'email history is retained'); END;
