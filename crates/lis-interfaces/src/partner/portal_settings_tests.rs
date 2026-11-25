use super::*;

fn settings(base_url: &str) -> PortalSettings {
    PortalSettings {
        base_url: base_url.to_owned(),
        lab_code: " demo-lab ".to_owned(),
        api_user: "lab-7-abcd1234".to_owned(),
    }
}

fn field_of(error: PartnerError) -> String {
    let fields = error.field_errors();
    assert_eq!(fields.len(), 1, "not a field error: {error}");
    fields[0].field.clone()
}

#[test]
fn valid_settings_are_trimmed_and_name_the_ingest_address() {
    let portal = valid_portal_settings(settings(" https://ingest.example.com/ ")).unwrap();
    assert_eq!(portal.base_url, "https://ingest.example.com");
    assert_eq!(portal.lab_code, "demo-lab");
    assert_eq!(
        portal.ingest_url(),
        "https://ingest.example.com/api/labs/demo-lab/ingest"
    );
    assert_eq!(
        portal_destination(&portal),
        "https://ingest.example.com/api/labs/demo-lab/ingest as lab-7-abcd1234"
    );
    assert!(valid_portal_settings(settings("https://localhost:8443")).is_ok());
}

#[test]
fn only_an_https_address_without_a_path_is_accepted() {
    for url in [
        "http://ingest.example.com",
        "ingest.example.com",
        "https://",
        "https://ingest.example.com/api",
        "https://ingest.example.com?x=1",
        "https://user@ingest.example.com",
        "https://ingest.example.com:0",
        "https://ingest.example.com:99999",
        "https://-bad.example.com",
        "https://ingest..example.com",
    ] {
        let error = valid_portal_settings(settings(url)).unwrap_err();
        assert_eq!(field_of(error), "settings.portal.baseUrl", "{url}");
    }
}

#[test]
fn the_lab_code_and_api_user_are_checked() {
    let mut portal = settings("https://ingest.example.com");
    portal.lab_code = "demo lab".to_owned();
    assert_eq!(
        field_of(valid_portal_settings(portal).unwrap_err()),
        "settings.portal.labCode"
    );
    let mut portal = settings("https://ingest.example.com");
    portal.api_user = "user:secret".to_owned();
    assert_eq!(
        field_of(valid_portal_settings(portal).unwrap_err()),
        "settings.portal.apiUser"
    );
}

#[test]
fn the_portal_receives_hl7_results_only_and_needs_its_settings() {
    let portal = || Some(settings("https://ingest.example.com"));
    let refused = valid_portal(
        PartnerMessageType::ReportPdf,
        PartnerProtocol::PortalHttps,
        portal(),
    )
    .unwrap_err();
    assert_eq!(field_of(refused), "settings.protocol");
    let missing = valid_portal(
        PartnerMessageType::Hl7Oru,
        PartnerProtocol::PortalHttps,
        None,
    )
    .unwrap_err();
    assert_eq!(field_of(missing), "settings.portal.baseUrl");
    let stray = valid_portal(
        PartnerMessageType::Hl7Oru,
        PartnerProtocol::Folder,
        portal(),
    )
    .unwrap_err();
    assert_eq!(field_of(stray), "settings.portal");
    assert!(
        valid_portal(
            PartnerMessageType::Hl7Oru,
            PartnerProtocol::PortalHttps,
            portal()
        )
        .unwrap()
        .is_some()
    );
}
