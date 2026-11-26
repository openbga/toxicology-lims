//! The portal profile against the hand-written synthetic message of the encoder's tests.

use super::super::tests::message;
use super::*;

const SUBJECT: &str = "0193a1b2-0000-7000-8000-000000000001";

fn fields(pdf: Option<Vec<u8>>) -> PortalFields {
    PortalFields {
        email: "jane.doe@example.com".to_owned(),
        provider_phone: "(555) 555-0100".to_owned(),
        laboratory_phone: "(555) 555-0199".to_owned(),
        pdf,
    }
}

fn segments(oru: &Oru) -> Vec<String> {
    String::from_utf8(oru.encode())
        .unwrap()
        .split('\r')
        .map(str::to_owned)
        .collect()
}

#[test]
fn the_portal_profile_has_every_field_the_portal_reads() {
    let oru = message().for_portal(SUBJECT, fields(Some(b"%PDF-1.7".to_vec())));
    assert_eq!(
        segments(&oru),
        [
            "MSH|^~\\&|VIBETOX LIS|Synthetic Tox Lab^00D0000000^CLIA||CLINIC-A|20261104102000-0600||ORU^R01^ORU_R01|01a1a000-0000-7000-8000-000000000011|P|2.5.1|||NE|NE||UNICODE UTF-8",
            "PID|1||0193a1b2-0000-7000-8000-000000000001^^^00D0000000^PI||Doe^Jane||19800101|F||||||jane.doe@example.com",
            "PV1|1|U|LOC-1^^^^^^^^Main office",
            "ORC|RE|ORD-000124|A26000005^VIBETOX LIS|||||||||1234567893^Test^Doctor^^^^^^^^^^NPI",
            "OBR|1|ORD-000124|A26000005^VIBETOX LIS|CA-AMPH-CONF^Amphetamines Panel^L|||20261103083000-0500|||||||20261103120000-0600||1234567893^Test^Doctor^^^^^^^^^^NPI|(555) 555-0100|||||20261104101500-0600|||C",
            "NTE|1||LAB NAME: Synthetic Tox Lab",
            "NTE|2||CLIA: 00D0000000",
            "NTE|3||LAB PHONE: (555) 555-0199",
            "OBX|1|NM|CA-AMP^Amphetamine^L^12345-6^^LN|1|152.40|ng/mL^^UCUM|||||C||||||||||||Synthetic Tox Lab^^^^^^^^^00D0000000",
            "OBX|2|SN|CA-MAMP^Methamphetamine^L|1|<^0.50|ng/mL^^UCUM|||||C||||||||||||Synthetic Tox Lab^^^^^^^^^00D0000000",
            "OBX|3|ED|PDF^Laboratory report^L||^AP^PDF^Base64^JVBERi0xLjc=",
            "SPM|1|^A26000005||UR^Urine^L|||||||||||||20261103083000-0500|20261103120000-0600",
            "",
        ]
    );
}

#[test]
fn every_test_carries_the_accession_and_only_the_last_one_the_pdf() {
    let mut oru = message();
    let mut second = oru.groups[0].clone();
    second.filler_order = "A26000005-UR-2".to_owned();
    oru.groups.push(second);
    let text = segments(&oru.for_portal(SUBJECT, fields(Some(b"pdf".to_vec())))).join("\r");
    assert_eq!(text.matches("|A26000005^VIBETOX LIS|").count(), 4);
    assert_eq!(text.matches("NTE|").count(), 3);
    assert_eq!(text.matches("|ED|").count(), 1);
    let ed = text.find("|ED|").unwrap();
    assert!(text.rfind("OBR|2|").unwrap() < ed);
}

#[test]
fn a_withdrawal_carries_no_pdf() {
    let text = segments(&message().for_portal(SUBJECT, fields(None))).join("\r");
    assert!(!text.contains("|ED|"));
    assert_eq!(text.matches("NTE|").count(), 3);
}

#[test]
fn portal_values_are_escaped() {
    let mut values = fields(None);
    values.email = "a|b@example.com".to_owned();
    values.laboratory_phone = "555^0199".to_owned();
    let text = segments(&message().for_portal(SUBJECT, values)).join("\r");
    assert!(text.contains("|a\\F\\b@example.com"));
    assert!(text.contains("LAB PHONE: 555\\S\\0199"));
}

#[test]
fn other_partners_get_the_standard_message() {
    let text = segments(&message()).join("\r");
    assert!(text.contains("Clinic A^^^^^^^^^CLINIC-A"));
    assert!(!text.contains("NTE|"));
}

#[test]
fn base64_matches_rfc_4648() {
    for (bytes, text) in [
        (&b""[..], ""),
        (b"f", "Zg=="),
        (b"fo", "Zm8="),
        (b"foo", "Zm9v"),
        (b"foob", "Zm9vYg=="),
        (b"fooba", "Zm9vYmE="),
        (b"foobar", "Zm9vYmFy"),
        (&[0xFF, 0xFE, 0x00], "//4A"),
    ] {
        assert_eq!(base64(bytes), text);
    }
}
