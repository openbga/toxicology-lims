//! The LIMSiq Patient Portal (#4672): a released report's HL7 result for the portal waits
//! while the patient has no email, which is their consent; once one is added it is made in
//! the portal profile, with the subject's identifier, the email, the accession, the
//! practitioner's phone, the laboratory's notes and the report's PDF, and posted. Here
//! nothing listens at the portal's address, so the attempt fails and is retried; the kept
//! message shows what the portal will receive. A test message is refused: the portal would
//! file it as a patient's results. Synthetic data only.

use lis_core::{ErrorCode, Phi};
use lis_engine::{GetPartnerMessage, GetSubjectInput, PartnerConnectionInput};
use lis_identity::SetSubjectEmail;
use lis_interfaces::partner::{
    PartnerConnectionSettings, PartnerMessageType, PartnerProtocol, PortalSettings, Schedule,
    TransportOutcome, WaitReason,
};

use super::partner_hl7::{approve, draft_held};
use super::partner_pdfs::Pdfs;
use crate::m2_lab::Role;
use crate::m3_fixture::Staff;

fn settings() -> PartnerConnectionSettings {
    PartnerConnectionSettings {
        name: "LIMSiq Patient Portal".to_owned(),
        partner: "LIMSiq".to_owned(),
        message_type: PartnerMessageType::Hl7Oru,
        protocol: PartnerProtocol::PortalHttps,
        rules: Vec::new(),
        schedule: Schedule::Immediately,
        file_name_pattern: String::new(),
        sftp: None,
        intake: None,
        mllp: None,
        mllp_listener: None,
        // Port 1 on this computer: nothing answers.
        portal: Some(PortalSettings {
            base_url: "https://127.0.0.1:1".to_owned(),
            lab_code: "demo-lab".to_owned(),
            api_user: "lab-7-abcd1234".to_owned(),
        }),
    }
}

/// Records the patient's email; returns the subject's new revision.
async fn add_email(hl7: &Pdfs) -> i64 {
    hl7.bench.sign_in(Staff::Desk(Role::Accessioner)).await;
    let engine = hl7.bench.lab().engine();
    let subject_id = hl7.bench.lab().parties.subject;
    let subject = engine
        .get_subject(GetSubjectInput { subject_id })
        .await
        .unwrap();
    engine
        .set_subject_email(SetSubjectEmail {
            subject_id,
            expected_revision: subject.revision,
            email: Some(Phi::new("test.patient@example.com".to_owned())),
        })
        .await
        .unwrap()
        .revision
}

#[tokio::test]
async fn a_portal_result_waits_for_the_email_then_is_made_in_the_portal_profile() {
    let hl7 = Pdfs::start_with(settings()).await;
    // A portal connection keeps no folder.
    assert_eq!(hl7.connection.connection.folder, "");
    let released = hl7.release(None).await;
    hl7.deliver().await;
    draft_held(&hl7).await;
    approve(&hl7).await;
    // No email, no consent: nothing goes to the portal.
    hl7.deliver().await;
    let row = hl7.rows().await.remove(0);
    assert_eq!(row.waiting, Some(WaitReason::NoPortalEmail));
    assert_eq!(row.transport, TransportOutcome::NotSent);

    // Like any change to a released patient, the email opens an impact review; it records
    // no impact.
    let subject_revision = add_email(&hl7).await;
    hl7.deliver().await;
    assert_eq!(hl7.rows().await[0].waiting, Some(WaitReason::ImpactReview));
    hl7.bench
        .assess_no_impact(
            released.revision_id,
            vec![format!("identity_changed:{subject_revision}")],
        )
        .await;
    hl7.deliver().await;
    let row = hl7.rows().await.remove(0);
    assert_eq!(row.error_code.as_deref(), Some("portal_unreachable"));
    assert_eq!(row.waiting, None);

    hl7.bench.sign_in(Staff::Desk(Role::Admin)).await;
    let detail = hl7
        .bench
        .lab()
        .engine()
        .get_partner_message(GetPartnerMessage {
            delivery_id: row.delivery_id.unwrap(),
        })
        .await
        .unwrap();
    let subject_id = hl7.bench.lab().parties.subject.to_string();
    let segment = |name: &str| {
        detail
            .segments
            .iter()
            .find(|segment| segment.starts_with(name))
            .cloned()
            .unwrap_or_default()
    };
    let pid = segment("PID|");
    assert!(pid.contains(&format!("|{subject_id}^^^")), "{pid}");
    assert!(pid.ends_with("|test.patient@example.com"), "{pid}");
    assert!(segment("OBR|").contains("|(555) 555-0100|"));
    assert!(segment("NTE|1||LAB NAME: ").len() > 16);
    assert!(segment("OBX|").starts_with("OBX|1|"));
    let pdf = detail
        .segments
        .iter()
        .find(|segment| segment.contains("|ED|"))
        .unwrap();
    // The report's PDF, Base64: it starts with %PDF.
    assert!(pdf.contains("^AP^PDF^Base64^JVBER"));
}

#[tokio::test]
async fn a_test_message_is_never_sent_to_the_portal() {
    let hl7 = Pdfs::start_with(settings()).await;
    hl7.bench.sign_in(Staff::Desk(Role::Admin)).await;
    let refused = hl7
        .bench
        .lab()
        .engine()
        .send_partner_test_message(PartnerConnectionInput {
            connection_id: hl7.connection.connection.id,
        })
        .await
        .unwrap_err();
    assert_eq!(refused.code(), ErrorCode::Conflict);
}
