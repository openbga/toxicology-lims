//! The synthetic message of Send test message and the acceptance tests.

use super::{ObservationGroup, Order, Organization, Oru, Patient, Specimen};

impl Oru {
    /// A synthetic message with no patient data, processing ID `T`: the synthetic patient
    /// TEST^SYNTHETIC with sex recorded as Unknown, a test provider, a synthetic specimen and `groups`, all at `at`. For the
    /// test message and the acceptance tests.
    #[must_use]
    pub fn synthetic(
        control_id: String,
        at: &str,
        laboratory: Organization,
        partner: &str,
        groups: Vec<ObservationGroup>,
    ) -> Self {
        Self {
            control_id,
            created_at: at.to_owned(),
            processing_id: "T",
            laboratory,
            receiving_facility: partner.to_owned(),
            acknowledged: false,
            patient: Patient {
                identifiers: vec![(
                    "TEST-00000".to_owned(),
                    "VIBETOX".to_owned(),
                    "MR".to_owned(),
                )],
                family_name: "TEST".to_owned(),
                given_names: Some("SYNTHETIC".to_owned()),
                birth_date: "19000101".to_owned(),
                sex: Some("Unknown".to_owned()),
            },
            location: None,
            order: Order {
                placer_order: None,
                provider: ("0000000000".to_owned(), "TEST".to_owned(), None),
                facility: Organization {
                    name: partner.to_owned(),
                    id: String::new(),
                },
                collected_at: at.to_owned(),
                released_at: at.to_owned(),
            },
            groups,
            specimen: Specimen {
                id: "TEST-1".to_owned(),
                kind: ("TEST".to_owned(), "Synthetic".to_owned()),
                collected_at: at.to_owned(),
                received_at: at.to_owned(),
            },
            portal: None,
        }
    }
}
