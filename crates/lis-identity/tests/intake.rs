//! DM-06 uses synthetic source evidence; no inferred patient demographics.
#![cfg(test)]
use lis_core::{Capability, CorrelationId, ErrorCode, Phi};
use lis_identity::*;
use lis_store::testing::{TestDatabase, principal};

fn input(kind: BirthEvidenceKind, text: Option<&str>) -> RecordIntakeDeferralInput {
    RecordIntakeDeferralInput {
        supplied_name: Phi::new("Synthetic Intake".into()),
        birth_evidence_kind: kind,
        birth_evidence_text: text.map(|s| Phi::new(s.into())),
        source_reference: "synthetic-requisition-A".into(),
        reason: "Complete birth date not supplied".into(),
    }
}
fn record(t: &TestDatabase, value: RecordIntakeDeferralInput) -> IntakeDeferralView {
    t.db.write_blocking(
        principal(&[Capability::EnterOrders]),
        CorrelationId::generate(),
        move |ctx| record_intake_deferral(ctx, value),
    )
    .unwrap()
}
fn list(
    t: &TestDatabase,
    show: IntakeShow,
    search: Option<&str>,
    after_id: Option<IntakeDeferralId>,
) -> IntakeDeferralPage {
    let value = ListIntakeDeferralsInput {
        show,
        search: search.map(|text| Phi::new(text.into())),
        after_id,
    };
    t.db.read_blocking(move |conn| list_intake_deferrals(conn, value))
        .unwrap()
}
#[test]
fn intake_retains_unknown_partial_and_age_without_creating_subjects() {
    let t = TestDatabase::open(&[SCHEMA]).unwrap();
    for (kind, text) in [
        (BirthEvidenceKind::Unknown, None),
        (BirthEvidenceKind::PartialDate, Some("1980-??-??")),
        (
            BirthEvidenceKind::SuppliedAge,
            Some("approximately 45 years as supplied"),
        ),
    ] {
        let saved = record(&t, input(kind, text));
        assert_eq!(
            saved
                .birth_evidence_text
                .as_ref()
                .map(|v| v.expose().as_str()),
            text
        );
        assert_eq!(saved.revision, 1);
        assert!(saved.subject_id.is_none());
    }
    let n: i64 =
        t.db.read_blocking(|conn| -> Result<i64, IdentityError> {
            Ok(conn.query_row("SELECT count(*) FROM idn_subjects", [], |r| r.get(0))?)
        })
        .unwrap();
    assert_eq!(n, 0);
    let denied =
        t.db.write_blocking(principal(&[]), CorrelationId::generate(), |ctx| {
            record_intake_deferral(ctx, input(BirthEvidenceKind::Unknown, None))
        })
        .unwrap_err();
    assert_eq!(denied.code(), ErrorCode::Forbidden);
}
#[test]
fn intake_resolution_is_attributable_terminal_and_never_erases_original() {
    let t = TestDatabase::open(&[SCHEMA]).unwrap();
    let saved = record(&t, input(BirthEvidenceKind::SuppliedAge, Some("age 42")));
    let id = saved.intake_id;
    let resolution = ResolveIntakeDeferralInput {
        intake_id: id,
        expected_revision: 1,
        disposition: IntakeDisposition::Declined,
        subject_id: None,
        source_reference: "synthetic-contact-record".into(),
        reason: "Source could not establish complete identity; intake declined".into(),
    };
    let retry = resolution.clone();
    let done =
        t.db.write_blocking(
            principal(&[Capability::EnterOrders]),
            CorrelationId::generate(),
            move |ctx| resolve_intake_deferral(ctx, resolution),
        )
        .unwrap();
    assert_eq!(done.revision, 2);
    assert_eq!(done.birth_evidence_text.unwrap().expose(), "age 42");
    assert!(done.disposed_by.is_some());
    let stale =
        t.db.write_blocking(
            principal(&[Capability::EnterOrders]),
            CorrelationId::generate(),
            move |ctx| resolve_intake_deferral(ctx, retry),
        )
        .unwrap_err();
    assert_eq!(stale.code(), ErrorCode::Conflict);
    let open = list(&t, IntakeShow::Awaiting, None, None);
    assert!(open.rows.is_empty());
    t.db.read_blocking(move |conn| -> Result<(), IdentityError> {
        assert!(
            conn.execute(
                "UPDATE idn_intake_deferrals SET supplied_name='changed' WHERE id=?1",
                [id]
            )
            .is_err()
        );
        Ok(())
    })
    .unwrap();
}
#[test]
fn intake_pages_reach_all_records() {
    let t = TestDatabase::open(&[SCHEMA]).unwrap();
    for _ in 0..51 {
        record(&t, input(BirthEvidenceKind::Unknown, None));
    }
    let page = list(&t, IntakeShow::Awaiting, None, None);
    assert_eq!(page.rows.len(), 50);
    assert_eq!(page.counts.awaiting, 51);
    let after = page.rows.last().unwrap().intake_id;
    let rest = list(&t, IntakeShow::Awaiting, None, Some(after));
    assert_eq!(rest.rows.len(), 1);
    assert!(
        !page
            .rows
            .iter()
            .any(|row| row.intake_id == rest.rows[0].intake_id)
    );
}

#[test]
fn intake_resolves_only_to_an_existing_patient() {
    let t = TestDatabase::open(&[SCHEMA]).unwrap();
    let id = record(&t, input(BirthEvidenceKind::Unknown, None)).intake_id;
    let invalid = ResolveIntakeDeferralInput {
        intake_id: id,
        expected_revision: 1,
        disposition: IntakeDisposition::Resolved,
        subject_id: Some(SubjectId::generate()),
        source_reference: "new supplied evidence".into(),
        reason: "verified identity".into(),
    };
    assert_eq!(
        t.db.write_blocking(
            principal(&[Capability::EnterOrders]),
            CorrelationId::generate(),
            move |ctx| resolve_intake_deferral(ctx, invalid)
        )
        .unwrap_err()
        .code(),
        ErrorCode::NotFound
    );
    let subject =
        t.db.write_blocking(
            principal(&[Capability::EnterOrders]),
            CorrelationId::generate(),
            |ctx| {
                register_subject(
                    ctx,
                    RegisterSubject {
                        demographics: DemographicsInput {
                            family_name: Phi::new("Synthetic Intake".into()),
                            given_names: None,
                            birth_date: Phi::new("1984-02-03".into()),
                            administrative_sex: None,
                        },
                        source: "new source-backed full date".into(),
                        identifiers: vec![],
                        acknowledged_candidates: vec![],
                        email: None,
                    },
                )
            },
        )
        .unwrap();
    let resolved =
        t.db.write_blocking(
            principal(&[Capability::EnterOrders]),
            CorrelationId::generate(),
            move |ctx| {
                resolve_intake_deferral(
                    ctx,
                    ResolveIntakeDeferralInput {
                        intake_id: id,
                        expected_revision: 1,
                        disposition: IntakeDisposition::Resolved,
                        subject_id: Some(subject.subject_id),
                        source_reference: "synthetic-verified-identity".into(),
                        reason: "Verified source confirms this registered patient".into(),
                    },
                )
            },
        )
        .unwrap();
    assert!(resolved.subject_id.is_some());
    assert_eq!(resolved.birth_evidence_kind, BirthEvidenceKind::Unknown);
}

#[test]
fn intake_disposition_denial_is_atomic_and_audit_records_actual_authority() {
    let t = TestDatabase::open(&[SCHEMA]).unwrap();
    let saved = record(&t, input(BirthEvidenceKind::Unknown, None));
    let id = saved.intake_id;
    let value = ResolveIntakeDeferralInput {
        intake_id: id,
        expected_revision: 1,
        disposition: IntakeDisposition::Declined,
        subject_id: None,
        source_reference: "synthetic-refusal".into(),
        reason: "Source declined identity clarification".into(),
    };
    let retry = value.clone();
    assert_eq!(
        t.db.write_blocking(principal(&[]), CorrelationId::generate(), move |ctx| {
            resolve_intake_deferral(ctx, value)
        })
        .unwrap_err()
        .code(),
        ErrorCode::Forbidden
    );
    let open = list(&t, IntakeShow::Awaiting, None, None);
    assert_eq!(open.rows.len(), 1);
    let actor = principal(&[Capability::EnterOrders]);
    let who = actor.actor().id_text();
    let correlation = CorrelationId::generate();
    t.db.write_blocking(actor, correlation, move |ctx| {
        resolve_intake_deferral(ctx, retry)
    })
    .unwrap();
    t.db.read_blocking(move |conn| -> Result<(), IdentityError> {
        let (authority, record, corr): (String, String, String) = conn.query_row(
            "SELECT authority, record_id, correlation_id FROM audit_events \
             WHERE action='identity.resolve_intake_deferral'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )?;
        assert_eq!(authority, "enter_orders");
        assert_eq!(record, id.to_string());
        assert_eq!(corr, correlation.to_string());
        let author: String = conn.query_row(
            "SELECT recorded_by FROM idn_intake_dispositions WHERE id=?1",
            [id],
            |row| row.get(0),
        )?;
        assert_eq!(author, who);
        Ok(())
    })
    .unwrap();
}

/// Three intake records for the list test: TEST, Unknown and TEST, Partial awaiting verified
/// identity (source REQ-TEST-001) and TEST, Age declined (source TEST-REQ-001).
fn three_intakes_one_declined(t: &TestDatabase) {
    let named = |name: &str, source: &str, kind: BirthEvidenceKind, text: Option<&str>| {
        RecordIntakeDeferralInput {
            supplied_name: Phi::new(name.into()),
            source_reference: source.into(),
            ..input(kind, text)
        }
    };
    record(
        t,
        named(
            "TEST, Unknown",
            "REQ-TEST-001",
            BirthEvidenceKind::Unknown,
            None,
        ),
    );
    let partial = BirthEvidenceKind::PartialDate;
    record(
        t,
        named("TEST, Partial", "REQ-TEST-001", partial, Some("1985")),
    );
    let age = BirthEvidenceKind::SuppliedAge;
    let id = record(t, named("TEST, Age", "TEST-REQ-001", age, Some("About 40"))).intake_id;
    let decline = ResolveIntakeDeferralInput {
        intake_id: id,
        expected_revision: 1,
        disposition: IntakeDisposition::Declined,
        subject_id: None,
        source_reference: "synthetic-decline".into(),
        reason: "Source withdrew intake".into(),
    };
    t.db.write_blocking(
        principal(&[Capability::EnterOrders]),
        CorrelationId::generate(),
        move |ctx| resolve_intake_deferral(ctx, decline),
    )
    .unwrap();
}

/// The supplied names a page lists, in order.
fn names(page: &IntakeDeferralPage) -> Vec<String> {
    page.rows
        .iter()
        .map(|row| row.supplied_name.expose().clone())
        .collect()
}

#[test]
fn intake_list_finds_filters_and_counts_before_paging() {
    let t = TestDatabase::open(&[SCHEMA]).unwrap();
    three_intakes_one_declined(&t);
    let every = IntakeDeferralCounts {
        awaiting: 2,
        resolved: 0,
        declined: 1,
    };
    let open = list(&t, IntakeShow::Awaiting, None, None);
    assert_eq!(names(&open), ["TEST, Unknown", "TEST, Partial"]);
    assert_eq!(open.counts, every);
    let declined = list(&t, IntakeShow::Declined, Some("  "), None);
    assert_eq!(names(&declined), ["TEST, Age"]);
    assert_eq!(declined.counts, every);
    // Nothing resolved: no rows, and the counts still offer the other states.
    let resolved = list(&t, IntakeShow::Resolved, None, None);
    assert!(resolved.rows.is_empty());
    assert_eq!(resolved.counts, every);
    // Find matches part of the source reference or of the name, ignoring case, and the
    // counts follow it.
    let by_source = list(&t, IntakeShow::All, Some("req-test"), None);
    assert_eq!(names(&by_source), ["TEST, Unknown", "TEST, Partial"]);
    assert_eq!(by_source.counts.declined, 0);
    let by_name = list(&t, IntakeShow::All, Some("age"), None);
    assert_eq!(names(&by_name), ["TEST, Age"]);
    assert_eq!(by_name.counts.awaiting, 0);
    assert!(list(&t, IntakeShow::All, Some("%"), None).rows.is_empty());
    let long = "x".repeat(201);
    let refused =
        t.db.read_blocking(move |conn| {
            list_intake_deferrals(
                conn,
                ListIntakeDeferralsInput {
                    show: IntakeShow::All,
                    search: Some(Phi::new(long)),
                    after_id: None,
                },
            )
        })
        .unwrap_err();
    assert_eq!(refused.code(), ErrorCode::Validation);
}

// #4773: the work queue counts intake still awaiting verified identity, oldest first.
#[test]
fn intake_queue_lists_only_intake_awaiting_identity() {
    let t = TestDatabase::open(&[SCHEMA]).unwrap();
    let declined = record(&t, input(BirthEvidenceKind::Unknown, None)).intake_id;
    let first = record(&t, input(BirthEvidenceKind::PartialDate, Some("1985"))).intake_id;
    let second = record(&t, input(BirthEvidenceKind::Unknown, None)).intake_id;
    t.db.write_blocking(
        principal(&[Capability::EnterOrders]),
        CorrelationId::generate(),
        move |ctx| {
            resolve_intake_deferral(
                ctx,
                ResolveIntakeDeferralInput {
                    intake_id: declined,
                    expected_revision: 1,
                    disposition: IntakeDisposition::Declined,
                    subject_id: None,
                    source_reference: "synthetic-contact-record".into(),
                    reason: "Source could not establish complete identity".into(),
                },
            )
        },
    )
    .unwrap();
    let open =
        t.db.read_blocking(|conn| intake_awaiting_identity(conn, 500))
            .unwrap();
    let mut expected = vec![first, second];
    expected.sort();
    let mut ids: Vec<_> = open.iter().map(|row| row.intake_id).collect();
    ids.sort();
    assert_eq!(ids, expected);
    assert!(open.windows(2).all(|pair| pair[0].since <= pair[1].since));
    let limited =
        t.db.read_blocking(|conn| intake_awaiting_identity(conn, 1))
            .unwrap();
    assert_eq!(limited.len(), 1);
}
