//! The ordering practitioner's phone: required for new and corrected practitioners, kept in
//! the directory history; practitioners registered before it was required have none.

use lis_core::{Capability, ErrorCode};
use lis_identity::{
    DirectoryHistoryInput, DirectoryRecord, DirectorySnapshot, IdentityError, PractitionerId,
    PractitionerView, RegisterPractitioner, UpdatePractitioner, directory_history,
    get_practitioner, register_practitioner, update_practitioner,
};
use lis_store::testing::TestDatabase;

use crate::{assert_code, counts, open, read, run};

const CONFIGURE: &[Capability] = &[Capability::ManageConfiguration];
const NPI: &str = "1234567893";
const PHONE: &str = "(555) 555-0100";

fn register(t: &TestDatabase, phone: &str) -> Result<PractitionerId, IdentityError> {
    let phone = phone.to_owned();
    run(t, CONFIGURE, move |ctx| {
        register_practitioner(
            ctx,
            RegisterPractitioner {
                npi: NPI.to_owned(),
                family_name: "Doctorperson".to_owned(),
                given_names: Some("Delta".to_owned()),
                phone,
            },
        )
    })
}

fn correct(
    t: &TestDatabase,
    practitioner_id: PractitionerId,
    expected_revision: i64,
    phone: &str,
) -> Result<PractitionerView, IdentityError> {
    let phone = phone.to_owned();
    run(t, CONFIGURE, move |ctx| {
        update_practitioner(
            ctx,
            UpdatePractitioner {
                practitioner_id,
                expected_revision,
                npi: NPI.to_owned(),
                family_name: "Doctorperson".to_owned(),
                given_names: Some("Delta".to_owned()),
                active: true,
                phone,
                reason: "Phone from the clinic's letterhead".to_owned(),
            },
        )
    })
}

fn phones_in_history(t: &TestDatabase, id: PractitionerId) -> Vec<Option<String>> {
    read(t, move |conn| {
        directory_history(
            conn,
            DirectoryHistoryInput {
                record: DirectoryRecord::Practitioner(id),
            },
        )
    })
    .into_iter()
    .map(|entry| match entry.snapshot {
        DirectorySnapshot::Practitioner { phone, .. } => phone,
        DirectorySnapshot::Client { .. } | DirectorySnapshot::Location { .. } => None,
    })
    .collect()
}

#[test]
fn registration_stores_the_phone_as_entered_and_in_the_history() {
    let t = open();
    let id = register(&t, " (555) 555-0100 ").unwrap();
    let view = read(&t, move |conn| get_practitioner(conn, id));
    assert_eq!(view.phone.as_deref(), Some(PHONE));
    assert_eq!(phones_in_history(&t, id), [Some(PHONE.to_owned())]);
}

#[test]
fn a_missing_or_malformed_phone_is_refused_and_nothing_written() {
    let t = open();
    let before = counts(&t);
    for phone in [
        "",
        "   ",
        "555-01",
        "call the clinic",
        "+1 (555) 555-0100 x12",
        "1234567890123456",
    ] {
        assert_code(register(&t, phone), ErrorCode::Validation);
    }
    assert_eq!(counts(&t), before);
}

#[test]
fn ordinary_phone_numbers_are_accepted() {
    for phone in [
        "(555) 555-0100",
        "+1 555 555 0100",
        "555.555.0100",
        "5555550100",
    ] {
        let t = open();
        assert!(register(&t, phone).is_ok(), "{phone}");
    }
}

#[test]
fn a_practitioner_without_a_phone_gets_one_at_the_next_correction() {
    let t = open();
    // A practitioner registered before the phone was required has none.
    let id = run(&t, CONFIGURE, |ctx| {
        let id = PractitionerId::generate();
        ctx.tx().execute(
            "INSERT INTO idn_practitioners (id, npi, family_name, given_names, created_at) \
             VALUES (?1, ?2, 'Doctorperson', 'Delta', '2026-01-01T00:00:00.000000000Z')",
            rusqlite::params![id, NPI],
        )?;
        ctx.tx().execute(
            "INSERT INTO idn_directory_history (record_kind, record_id, revision, code, name, \
             given_names, active, recorded_at, origin) VALUES ('practitioner', ?1, 1, ?2, \
             'Doctorperson', 'Delta', 1, '2026-01-01T00:00:00.000000000Z', 'legacy_baseline')",
            rusqlite::params![id, NPI],
        )?;
        Ok(id)
    })
    .unwrap();
    assert_eq!(read(&t, move |conn| get_practitioner(conn, id)).phone, None);
    assert_code(correct(&t, id, 1, ""), ErrorCode::Validation);
    let corrected = correct(&t, id, 1, PHONE).unwrap();
    assert_eq!(corrected.phone.as_deref(), Some(PHONE));
    assert_eq!(corrected.revision, 2);
    assert_eq!(phones_in_history(&t, id), [None, Some(PHONE.to_owned())]);
}

#[test]
fn a_phone_change_alone_is_a_correction_and_repeating_it_changes_nothing() {
    let t = open();
    let id = register(&t, PHONE).unwrap();
    let corrected = correct(&t, id, 1, "(555) 555-0199").unwrap();
    assert_eq!(corrected.phone.as_deref(), Some("(555) 555-0199"));
    assert_code(correct(&t, id, 2, "(555) 555-0199"), ErrorCode::Validation);
}
