//! The LIMSiq Patient Portal's fields of an HL7 Results message (#4672), read when the
//! message is made: the patient's current email, which is their consent, the ordering
//! practitioner's current phone and the laboratory's phone. A missing email, given name or
//! phone holds the message until it is added; nothing is sent to the portal without them.

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

/// Why a portal message waits: no email, no given name, which the portal requires to match
/// the patient (PID-5.2), or no practitioner phone; `None` when it can go or is not for the
/// portal. The portal would refuse a message without a given name for good.
pub(crate) fn portal_gap(oru: &Oru) -> Option<PortalGap> {
    let fields = oru.portal.as_ref()?;
    let given = oru.patient.given_names.as_deref().unwrap_or_default();
    if fields.email.is_empty() {
        Some(PortalGap::Email)
    } else if given.trim().is_empty() {
        Some(PortalGap::GivenName)
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
    GivenName,
    PractitionerPhone,
}

#[cfg(test)]
mod tests {
    use lis_interfaces::partner::hl7::Organization;

    use super::*;

    fn portal(email: &str, given: Option<&str>, phone: &str) -> Oru {
        let laboratory = Organization {
            name: "Synthetic Tox Lab".to_owned(),
            id: "00D0000000".to_owned(),
        };
        let mut oru = Oru::synthetic("1".to_owned(), "20261126", laboratory, "LIMSIQ", Vec::new());
        oru.patient.given_names = given.map(str::to_owned);
        oru.for_portal(
            "subject",
            PortalFields {
                email: email.to_owned(),
                provider_phone: phone.to_owned(),
                laboratory_phone: String::new(),
                pdf: None,
            },
        )
    }

    #[test]
    fn a_portal_message_waits_for_the_email_the_given_name_and_the_phone() {
        let ready = (
            "test.patient@example.com",
            Some("Patient"),
            "(555) 555-0100",
        );
        assert_eq!(portal_gap(&portal(ready.0, ready.1, ready.2)), None);
        assert_eq!(
            portal_gap(&portal("", ready.1, ready.2)),
            Some(PortalGap::Email)
        );
        for given in [None, Some(" ")] {
            assert_eq!(
                portal_gap(&portal(ready.0, given, ready.2)),
                Some(PortalGap::GivenName)
            );
        }
        assert_eq!(
            portal_gap(&portal(ready.0, ready.1, "")),
            Some(PortalGap::PractitionerPhone)
        );
    }
}
