//! Identity history on the patient: the incomplete intake resolved with it (DM-06).
use super::{CANARY, assert_access, audit_text, intake, register_source_verified_subject};
use crate::fixture::TestEngine;
use lis_auth::RoleCode;
use lis_core::Phi;
use lis_engine::GetSubjectInput;
use lis_identity::{
    BirthEvidenceKind, IntakeDeferralId, IntakeDeferralView, IntakeDisposition,
    ResolveIntakeDeferralInput, SubjectId,
};

#[tokio::test]
async fn patient_detail_lists_the_intake_it_resolved_and_an_unrelated_patient_lists_none() {
    let t = TestEngine::start().await;
    t.admin_session().await;
    t.create_user("intake2", &[RoleCode::Accessioner]).await;
    let (session, _) = t.first_sign_in("intake2").await;
    let user = session.user_id.to_string();
    let resolved = t.engine.record_intake_deferral(intake()).await.unwrap();
    let declined = t.engine.record_intake_deferral(intake()).await.unwrap();
    // Still open: never on a patient.
    t.engine.record_intake_deferral(intake()).await.unwrap();
    let subject_id = register_source_verified_subject(&t).await;
    let unrelated = register_unrelated_subject(&t).await;
    let resolve = |intake_id, disposition, subject_id| ResolveIntakeDeferralInput {
        intake_id,
        expected_revision: 1,
        disposition,
        subject_id,
        source_reference: "Synthetic requisition R-2".into(),
        reason: "Verified complete demographics".into(),
    };
    let input = resolve(
        resolved.intake_id,
        IntakeDisposition::Resolved,
        Some(subject_id),
    );
    t.engine.resolve_intake_deferral(input).await.unwrap();
    let input = resolve(declined.intake_id, IntakeDisposition::Declined, None);
    t.engine.resolve_intake_deferral(input).await.unwrap();

    let detail = t
        .engine
        .get_subject(GetSubjectInput { subject_id })
        .await
        .unwrap();
    assert_eq!(
        detail.resolved_intakes.len(),
        1,
        "declined and open intake are not listed"
    );
    assert_resolved_intake(&detail.resolved_intakes[0], resolved.intake_id, &user);

    let other = t
        .engine
        .get_subject(GetSubjectInput {
            subject_id: unrelated,
        })
        .await
        .unwrap();
    assert!(other.resolved_intakes.is_empty());
    // The intake rides on the patient's own audited read, which names only the patient.
    let record = unrelated.to_string();
    assert_access(
        &t,
        "identity.get_subject",
        &user,
        "enter_orders",
        Some(&record),
    );
    assert!(!audit_text(&t).contains(CANARY));
    assert!(!audit_text(&t).contains("Age 42"));
}

/// The resolved intake as recorded and resolved by `user`, named, with its supplied evidence.
fn assert_resolved_intake(history: &IntakeDeferralView, intake_id: IntakeDeferralId, user: &str) {
    assert_eq!(history.intake_id, intake_id);
    assert_eq!(history.supplied_name.expose(), CANARY);
    assert_eq!(history.birth_evidence_kind, BirthEvidenceKind::SuppliedAge);
    let evidence = history
        .birth_evidence_text
        .as_ref()
        .map(|text| text.expose().as_str());
    assert_eq!(evidence, Some("Age 42 as supplied"));
    assert_eq!(history.source_reference, "Synthetic requisition R-1");
    assert_eq!(history.disposition, Some(IntakeDisposition::Resolved));
    assert_eq!(
        history.disposition_source.as_deref(),
        Some("Synthetic requisition R-2")
    );
    assert_eq!(history.disposed_by, Some(user.to_owned()));
    assert_eq!(history.disposed_by_display.as_deref(), Some("Test intake2"));
    assert!(history.disposed_at.is_some());
}

async fn register_unrelated_subject(t: &TestEngine) -> SubjectId {
    t.engine
        .register_subject(lis_identity::RegisterSubject {
            demographics: lis_identity::DemographicsInput {
                family_name: Phi::new("Synthetic Unrelated".into()),
                given_names: None,
                birth_date: Phi::new("1990-02-03".into()),
                administrative_sex: None,
            },
            source: "Synthetic requisition R-3".into(),
            identifiers: vec![],
            acknowledged_candidates: vec![],
            email: None,
        })
        .await
        .unwrap()
        .subject_id
}
