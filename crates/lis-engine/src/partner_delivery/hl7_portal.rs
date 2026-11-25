//! The LIMSiq Patient Portal's fields of an HL7 Results message (#4672), read when the
//! message is made: the patient's current email, which is their consent, the ordering
//! practitioner's current phone and the laboratory's phone. A missing email or phone holds
//! the message until it is added; nothing is sent to the portal without them.

use lis_interfaces::partner::hl7::{Oru, PortalFields};
use lis_reporting::{ReportingError, RevisionOutbound};
use rusqlite::Connection;

use crate::commands::partner::ReportRoutingError;

/// `oru` in the portal profile. Its PDF is attached by the caller, which reads the store.
pub(crate) fn portal_oru(
    conn: &Connection,
    revision: &RevisionOutbound,
    oru: Oru,
) -> Result<Oru, ReportRoutingError> {
    let snapshot = &revision.snapshot;
    let subject_id = snapshot.subject.subject_id;
    let email = lis_identity::current_subject_email(conn, subject_id)
        .map_err(ReportingError::from)?
        .map(|email| email.expose().clone())
        .unwrap_or_default();
    let provider_phone = lis_identity::practitioner_phone(conn, &snapshot.order.practitioner_npi)
        .map_err(ReportingError::from)?
        .unwrap_or_default();
    let fields = PortalFields {
        email,
        provider_phone,
        laboratory_phone: snapshot.laboratory.phone.clone(),
        pdf: None,
    };
    Ok(oru.for_portal(&subject_id.to_string(), fields))
}

/// Why a portal message waits: no email, or no practitioner phone; `None` when it can go
/// or is not for the portal.
pub(crate) fn portal_gap(oru: &Oru) -> Option<PortalGap> {
    let fields = oru.portal.as_ref()?;
    if fields.email.is_empty() {
        Some(PortalGap::Email)
    } else if fields.provider_phone.is_empty() {
        Some(PortalGap::PractitionerPhone)
    } else {
        None
    }
}

/// What a portal message misses.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum PortalGap {
    Email,
    PractitionerPhone,
}
