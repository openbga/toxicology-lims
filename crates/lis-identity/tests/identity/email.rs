//! The portal email: a filled email is the patient's consent to portal delivery.

use lis_core::{Capability, ErrorCode, Phi};
use lis_identity::{
    RegisterSubject, SetSubjectEmail, SubjectEmailSet, SubjectId, get_subject, register_subject,
    set_subject_email,
};
use lis_store::testing::TestDatabase;

use crate::{assert_code, audit_actions, counts, demographics, open, read, register, run};

const EMAIL: &str = "test.patient@example.com";

fn email(value: &str) -> Option<Phi<String>> {
    Some(Phi::new(value.to_owned()))
}

fn set(
    t: &TestDatabase,
    subject_id: SubjectId,
    expected_revision: i64,
    email: Option<Phi<String>>,
) -> Result<SubjectEmailSet, lis_identity::IdentityError> {
    run(t, &[Capability::EnterOrders], move |ctx| {
        set_subject_email(
            ctx,
            SetSubjectEmail {
                subject_id,
                expected_revision,
                email,
            },
        )
    })
}

fn registered(t: &TestDatabase) -> SubjectId {
    register(
        t,
        demographics("Testperson", "Alpha", "1990-01-01"),
        vec![],
        vec![],
    )
    .unwrap()
    .subject_id
}

fn current_email(t: &TestDatabase, subject_id: SubjectId) -> Option<String> {
    read(t, move |conn| get_subject(conn, subject_id))
        .email
        .map(|email| email.address.expose().clone())
}

fn history_rows(t: &TestDatabase) -> i64 {
    read(t, |conn| {
        Ok(
            conn.query_row("SELECT count(*) FROM idn_subject_emails", [], |row| {
                row.get(0)
            })?,
        )
    })
}

#[test]
fn registration_records_the_email_in_the_same_transaction() {
    let t = open();
    let registered = run(&t, &[Capability::EnterOrders], |ctx| {
        register_subject(
            ctx,
            RegisterSubject {
                demographics: demographics("Testperson", "Alpha", "1990-01-01"),
                source: "requisition".to_owned(),
                identifiers: vec![],
                acknowledged_candidates: vec![],
                email: email(" test.patient@example.com "),
            },
        )
    })
    .unwrap();
    assert_eq!(
        current_email(&t, registered.subject_id).as_deref(),
        Some(EMAIL)
    );
    assert_eq!(history_rows(&t), 1);
    assert_eq!(audit_actions(&t), ["identity.register_subject"]);
}

#[test]
fn registration_without_an_email_records_none() {
    let t = open();
    let subject_id = registered(&t);
    assert_eq!(current_email(&t, subject_id), None);
    assert_eq!(history_rows(&t), 0);
}

#[test]
fn setting_the_email_appends_history_bumps_the_revision_and_audits() {
    let t = open();
    let subject_id = registered(&t);
    let result = set(&t, subject_id, 1, email(EMAIL)).unwrap();
    assert_eq!(
        result,
        SubjectEmailSet {
            revision: 2,
            has_email: true
        }
    );
    assert_eq!(current_email(&t, subject_id).as_deref(), Some(EMAIL));
    assert_eq!(
        audit_actions(&t),
        ["identity.register_subject", "identity.set_email"]
    );
}

#[test]
fn removing_the_email_keeps_the_history_and_leaves_no_current_email() {
    let t = open();
    let subject_id = registered(&t);
    set(&t, subject_id, 1, email(EMAIL)).unwrap();
    let removed = set(&t, subject_id, 2, email("  ")).unwrap();
    assert!(!removed.has_email);
    assert_eq!(current_email(&t, subject_id), None);
    assert_eq!(history_rows(&t), 2);
}

#[test]
fn repeating_the_current_email_or_removing_none_changes_nothing() {
    let t = open();
    let subject_id = registered(&t);
    assert_code(set(&t, subject_id, 1, None), ErrorCode::Validation);
    set(&t, subject_id, 1, email(EMAIL)).unwrap();
    let before = counts(&t);
    assert_code(set(&t, subject_id, 2, email(EMAIL)), ErrorCode::Validation);
    assert_eq!(counts(&t), before);
}

#[test]
fn a_stale_revision_or_malformed_email_writes_nothing() {
    let t = open();
    let subject_id = registered(&t);
    let before = counts(&t);
    assert_code(set(&t, subject_id, 7, email(EMAIL)), ErrorCode::Conflict);
    assert_code(
        set(&t, subject_id, 1, email("not-an-email")),
        ErrorCode::Validation,
    );
    assert_eq!(counts(&t), before);
}

#[test]
fn the_history_is_append_only() {
    let t = open();
    let subject_id = registered(&t);
    set(&t, subject_id, 1, email(EMAIL)).unwrap();
    let refused = run(&t, &[Capability::EnterOrders], |ctx| {
        let update = ctx.tx().execute(
            "UPDATE idn_subject_emails SET email = 'other@example.com'",
            [],
        );
        let delete = ctx.tx().execute("DELETE FROM idn_subject_emails", []);
        Ok(update.is_err() && delete.is_err())
    })
    .unwrap();
    assert!(refused);
}
