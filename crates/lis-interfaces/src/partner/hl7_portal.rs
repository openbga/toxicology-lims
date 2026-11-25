//! The LIMSiq Patient Portal profile of the ORU^R01 (#4672): what the portal's ingest
//! API reads beyond the standard message. PID-3 is the subject's identifier with the
//! laboratory's CLIA number as its authority, so the portal keeps one patient for good;
//! PID-14 the patient's email, which is their consent to the portal; every ORC and OBR
//! carries the accession, so the portal makes one order; OBR-17 the ordering
//! practitioner's phone; NTE the laboratory's name, CLIA number and phone; and a last
//! OBX of type ED the revision's PDF. ORC-21 stays empty: the portal reads it as the
//! laboratory's name, and it names the ordering client.

use super::{Oru, esc, segment};

/// What the portal needs that the standard message does not carry.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PortalFields {
    /// PID-14: the patient's email.
    pub email: String,
    /// OBR-17: the ordering practitioner's phone.
    pub provider_phone: String,
    /// NTE: the laboratory's phone; its name and CLIA number come from MSH-4.
    pub laboratory_phone: String,
    /// OBX ED: the revision's PDF. None for a withdrawal, whose content was wrong.
    pub pdf: Option<Vec<u8>>,
}

impl Oru {
    /// This message in the portal profile, for the subject `subject_id`.
    #[must_use]
    pub fn for_portal(mut self, subject_id: &str, fields: PortalFields) -> Self {
        self.patient.identifiers = vec![(
            subject_id.to_owned(),
            self.laboratory.id.clone(),
            "PI".to_owned(),
        )];
        for group in &mut self.groups {
            group.filler_order.clone_from(&self.specimen.id);
        }
        self.portal = Some(fields);
        self
    }

    pub(super) fn portal_email(&self) -> Option<&str> {
        self.portal.as_ref().map(|fields| fields.email.as_str())
    }

    pub(super) fn portal_provider_phone(&self) -> String {
        self.portal
            .as_ref()
            .map_or_else(String::new, |fields| esc(&fields.provider_phone))
    }

    /// The laboratory's name, CLIA number and phone, after the first OBR.
    pub(super) fn portal_notes(&self) -> Vec<String> {
        let Some(fields) = &self.portal else {
            return Vec::new();
        };
        let notes = [
            format!("LAB NAME: {}", self.laboratory.name),
            format!("CLIA: {}", self.laboratory.id),
            format!("LAB PHONE: {}", fields.laboratory_phone),
        ];
        notes
            .iter()
            .enumerate()
            .map(|(index, note)| {
                segment("NTE", &[(index + 1).to_string(), String::new(), esc(note)])
            })
            .collect()
    }

    /// The PDF as the last OBX of the last OBR, numbered `set_id`.
    pub(super) fn portal_document(&self, set_id: usize) -> Option<String> {
        let pdf = self.portal.as_ref()?.pdf.as_ref()?;
        let value = format!("^AP^PDF^Base64^{}", base64(pdf));
        Some(segment(
            "OBX",
            &[
                set_id.to_string(),
                "ED".to_owned(),
                "PDF^Laboratory report^L".to_owned(),
                String::new(),
                value,
            ],
        ))
    }
}

/// Standard Base64 with padding (RFC 4648 section 4). Its alphabet holds no HL7 delimiter.
fn base64(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut text = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let triple = chunk.iter().enumerate().fold(0_u32, |acc, (index, byte)| {
            acc | u32::from(*byte) << (16 - 8 * index)
        });
        for position in 0..4 {
            if position <= chunk.len() {
                let sextet = (triple >> (18 - 6 * position)) & 0x3F;
                text.push(char::from(ALPHABET[sextet as usize]));
            } else {
                text.push('=');
            }
        }
    }
    text
}

#[cfg(test)]
#[path = "hl7_portal_tests.rs"]
mod tests;
