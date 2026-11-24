//! The patient's email for the LIMSiq Patient Portal (AGENTS.md, LIMSiq Patient Portal
//! integration). A filled email is the patient's consent to portal delivery; without one
//! nothing is sent. Every change appends to the history, so who recorded or removed it,
//! and when, is kept.

use lis_audit::{AuditDetail, AuditEvent, Outcome, Stream};
use lis_core::{Capability, Phi, UtcTimestamp};
use lis_store::CommandContext;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::error::{IdentityError, ensure_revision, invalid};
use crate::model::{ActorRef, SubjectId};
use crate::repo::emails;
use crate::repo::subjects as subject_repo;

/// The longest email address accepted (RFC 5321 path limit).
const EMAIL_MAX: usize = 254;

/// The subject's current portal email.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SubjectEmailView {
    /// The email as entered.
    pub address: Phi<String>,
    /// When it was recorded.
    pub recorded_at: UtcTimestamp,
}

/// Input of [`set_subject_email`].
#[derive(Debug, Clone, Deserialize, TS)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
#[ts(export)]
pub struct SetSubjectEmail {
    /// The subject.
    pub subject_id: SubjectId,
    /// The subject revision the user saw.
    #[ts(type = "number")]
    pub expected_revision: i64,
    /// The new email; absent or blank removes it, so nothing more goes to the portal.
    #[serde(default)]
    #[ts(optional = nullable)]
    pub email: Option<Phi<String>>,
}

/// Result of [`set_subject_email`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SubjectEmailSet {
    /// The subject's new revision.
    #[ts(type = "number")]
    pub revision: i64,
    /// Whether the subject now has an email.
    pub has_email: bool,
}

/// Sets or removes the subject's portal email. Repeating the current value is refused.
pub fn set_subject_email(
    ctx: &mut CommandContext<'_>,
    input: SetSubjectEmail,
) -> Result<SubjectEmailSet, IdentityError> {
    ctx.require(Capability::EnterOrders)?;
    let email = parse_email(input.email.as_ref())?;
    let revision = subject_repo::subject_revision(ctx.tx(), input.subject_id)?
        .ok_or(IdentityError::NotFound("subject"))?;
    ensure_revision(revision, input.expected_revision)?;
    if emails::current(ctx.tx(), input.subject_id)? == email {
        return Err(IdentityError::NothingChanged);
    }
    let actor = ActorRef::of(ctx.principal());
    emails::append(
        ctx.tx(),
        input.subject_id,
        email.as_deref(),
        ctx.now(),
        &actor,
    )?;
    subject_repo::set_subject_revision(ctx.tx(), input.subject_id, revision + 1)?;
    ctx.audit(
        AuditEvent::new(Stream::Clinical, "identity.set_email", Outcome::Succeeded)
            .record("subject", input.subject_id)
            .old_revision(revision)
            .new_revision(revision + 1)
            .detail("has_email", AuditDetail::boolean(email.is_some())),
    )?;
    Ok(SubjectEmailSet {
        revision: revision + 1,
        has_email: email.is_some(),
    })
}

/// Records the email given at registration, if any; the caller audits the registration.
pub(crate) fn record_at_registration(
    ctx: &CommandContext<'_>,
    subject_id: SubjectId,
    email: Option<&Phi<String>>,
    actor: &ActorRef,
) -> Result<bool, IdentityError> {
    let Some(email) = parse_email(email)? else {
        return Ok(false);
    };
    emails::append(ctx.tx(), subject_id, Some(&email), ctx.now(), actor)?;
    Ok(true)
}

/// A trimmed email in the plain `local@domain.tld` shape, or `None` when absent or blank.
/// Only the shape is checked: whether the mailbox exists is for the portal to find out.
pub(crate) fn parse_email(email: Option<&Phi<String>>) -> Result<Option<String>, IdentityError> {
    let Some(email) = email
        .map(|value| value.expose().trim())
        .filter(|value| !value.is_empty())
    else {
        return Ok(None);
    };
    if email.chars().count() > EMAIL_MAX {
        return Err(invalid("email", "too_long", "Use at most 254 characters."));
    }
    let well_formed = email.split_once('@').is_some_and(|(local, domain)| {
        !local.is_empty()
            && domain.contains('.')
            && !domain.starts_with('.')
            && !domain.ends_with('.')
            && !domain.contains('@')
    }) && !email.chars().any(char::is_whitespace);
    if !well_formed {
        return Err(invalid(
            "email",
            "invalid_format",
            "Enter an email such as name@example.com.",
        ));
    }
    Ok(Some(email.to_owned()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(value: &str) -> Result<Option<String>, IdentityError> {
        parse_email(Some(&Phi::new(value.to_owned())))
    }

    #[test]
    fn blank_or_absent_means_no_email() {
        assert_eq!(parse_email(None).ok(), Some(None));
        assert_eq!(parse("   ").ok(), Some(None));
    }

    #[test]
    fn a_plain_address_is_trimmed_and_kept_as_entered() {
        assert_eq!(
            parse("  Test.Patient@Example.com ").ok(),
            Some(Some("Test.Patient@Example.com".to_owned()))
        );
    }

    #[test]
    fn malformed_addresses_are_refused() {
        for value in [
            "no-at-sign",
            "@example.com",
            "name@localhost",
            "name@.com",
            "name@example.",
            "a@b@example.com",
            "first last@example.com",
        ] {
            assert!(
                matches!(parse(value), Err(IdentityError::Invalid(_))),
                "{value} should be refused"
            );
        }
    }

    #[test]
    fn an_over_long_address_is_refused() {
        let value = format!("{}@example.com", "a".repeat(250));
        assert!(matches!(parse(&value), Err(IdentityError::Invalid(_))));
    }
}
