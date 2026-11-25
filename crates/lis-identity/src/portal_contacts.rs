//! What the LIMSiq Patient Portal message reads at sending time (#4672): the patient's
//! current email, which is their consent, and the ordering practitioner's current phone.
//! Read when the message is made, so an email or phone added after release counts.

use lis_core::Phi;
use rusqlite::{Connection, OptionalExtension};

use crate::error::IdentityError;
use crate::model::SubjectId;
use crate::repo::emails;

/// The patient's current portal email; `None` without one. PHI: the caller keeps it out
/// of logs and audit details.
pub fn current_subject_email(
    conn: &Connection,
    subject_id: SubjectId,
) -> Result<Option<Phi<String>>, IdentityError> {
    Ok(emails::current(conn, subject_id)?.map(Phi::new))
}

/// The current phone of the practitioner with `npi`; `None` without one.
pub fn practitioner_phone(conn: &Connection, npi: &str) -> Result<Option<String>, IdentityError> {
    Ok(conn
        .prepare_cached("SELECT phone FROM idn_practitioners WHERE npi = ?1")?
        .query_row([npi], |row| row.get::<_, Option<String>>(0))
        .optional()?
        .flatten())
}
