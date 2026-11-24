//! SQL for the subject's portal email history.

use lis_core::{Phi, UtcTimestamp};
use rusqlite::{Connection, OptionalExtension, params};

use crate::email::SubjectEmailView;
use crate::model::{ActorRef, SubjectId};

/// The latest row's email; `None` when there is no row or the email was removed.
pub(crate) fn current(
    conn: &Connection,
    subject_id: SubjectId,
) -> rusqlite::Result<Option<String>> {
    Ok(conn
        .prepare_cached(
            "SELECT email FROM idn_subject_emails WHERE subject_id = ?1 \
             ORDER BY sequence DESC LIMIT 1",
        )?
        .query_row([subject_id], |row| row.get::<_, Option<String>>(0))
        .optional()?
        .flatten())
}

/// The current email with when it was recorded; `None` without a current email.
pub(crate) fn current_view(
    conn: &Connection,
    subject_id: SubjectId,
) -> rusqlite::Result<Option<SubjectEmailView>> {
    conn.prepare_cached(
        "SELECT email, recorded_at FROM idn_subject_emails WHERE subject_id = ?1 \
         ORDER BY sequence DESC LIMIT 1",
    )?
    .query_row([subject_id], |row| {
        Ok((
            row.get::<_, Option<String>>(0)?,
            row.get::<_, UtcTimestamp>(1)?,
        ))
    })
    .optional()
    .map(|latest| match latest {
        Some((Some(email), recorded_at)) => Some(SubjectEmailView {
            address: Phi::new(email),
            recorded_at,
        }),
        _ => None,
    })
}

/// Appends the next row; `email` `None` records a removal.
pub(crate) fn append(
    conn: &Connection,
    subject_id: SubjectId,
    email: Option<&str>,
    recorded_at: UtcTimestamp,
    recorded_by: &ActorRef,
) -> rusqlite::Result<()> {
    conn.prepare_cached(
        "INSERT INTO idn_subject_emails (subject_id, sequence, email, recorded_at, \
         recorded_by_kind, recorded_by_id) \
         SELECT ?1, COALESCE(MAX(sequence), 0) + 1, ?2, ?3, ?4, ?5 \
         FROM idn_subject_emails WHERE subject_id = ?1",
    )?
    .execute(params![
        subject_id,
        email,
        recorded_at,
        recorded_by.kind,
        recorded_by.id
    ])?;
    Ok(())
}
