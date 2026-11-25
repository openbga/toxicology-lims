//! A connection to the LIMSiq Patient Portal (#4672): HL7 results posted over HTTPS to the
//! portal's ingest API, `POST {base URL}/api/labs/{lab code}/ingest`, signed in with the
//! channel's API user and token. The token is kept sealed with the installation key, like
//! an SFTP password. Only `https://` is accepted, so patient data never travels in clear.
//! Pure.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::error::{PartnerError, invalid};
use super::model::{PartnerMessageType, PartnerProtocol};

const HOST_MAX: usize = 253;
const CODE_MAX: usize = 64;
const USER_MAX: usize = 100;

/// Where a portal connection posts, and as whom. LIMSiq gives the laboratory all three
/// with the token.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[ts(export)]
pub struct PortalSettings {
    /// The ingest API's address, such as `https://ingest.example.com`.
    pub base_url: String,
    /// The laboratory's code in the portal, such as `demo-lab`.
    pub lab_code: String,
    /// The channel's API user, such as `lab-7-abcd1234`.
    pub api_user: String,
}

impl PortalSettings {
    /// The ingest address messages are posted to.
    #[must_use]
    pub fn ingest_url(&self) -> String {
        format!("{}/api/labs/{}/ingest", self.base_url, self.lab_code)
    }
}

/// The portal settings, checked: present for the portal protocol, absent otherwise. The
/// portal receives HL7 results only.
pub(crate) fn valid_portal(
    message_type: PartnerMessageType,
    protocol: PartnerProtocol,
    portal: Option<PortalSettings>,
) -> Result<Option<PortalSettings>, PartnerError> {
    match (protocol, portal) {
        (PartnerProtocol::PortalHttps, _) if message_type != PartnerMessageType::Hl7Oru => {
            Err(invalid(
                "settings.protocol",
                "not_for_type",
                "The LIMSiq Patient Portal receives HL7 Results only.",
            ))
        }
        (PartnerProtocol::PortalHttps, Some(portal)) => valid_portal_settings(portal).map(Some),
        (PartnerProtocol::PortalHttps, None) => Err(invalid(
            "settings.portal.baseUrl",
            "required",
            "Enter the portal's ingest address.",
        )),
        (_, None) => Ok(None),
        (_, Some(_)) => Err(invalid(
            "settings.portal",
            "not_for_protocol",
            "Only a LIMSiq Patient Portal connection has portal settings.",
        )),
    }
}

/// The settings trimmed, the address without a trailing slash, or the first wrong field.
pub fn valid_portal_settings(portal: PortalSettings) -> Result<PortalSettings, PartnerError> {
    let base_url = portal.base_url.trim().trim_end_matches('/').to_owned();
    if !valid_base_url(&base_url) {
        return Err(invalid(
            "settings.portal.baseUrl",
            "invalid_address",
            "Enter an https:// address with no path, such as https://ingest.example.com.",
        ));
    }
    let lab_code = portal.lab_code.trim().to_owned();
    let code_ok = (1..=CODE_MAX).contains(&lab_code.len())
        && lab_code
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_');
    if !code_ok {
        return Err(invalid(
            "settings.portal.labCode",
            "invalid",
            "Enter the laboratory code LIMSiq gave you: letters, digits, - and _, such as demo-lab.",
        ));
    }
    let api_user = portal.api_user.trim().to_owned();
    let user_ok = (1..=USER_MAX).contains(&api_user.len())
        && api_user
            .bytes()
            .all(|byte| byte.is_ascii_graphic() && byte != b':');
    if !user_ok {
        return Err(invalid(
            "settings.portal.apiUser",
            "invalid",
            "Enter the API user LIMSiq gave you, such as lab-7-abcd1234.",
        ));
    }
    Ok(PortalSettings {
        base_url,
        lab_code,
        api_user,
    })
}

/// `https://` and a host name, with an optional port; no user, path, query or fragment.
fn valid_base_url(url: &str) -> bool {
    let Some(authority) = url.strip_prefix("https://") else {
        return false;
    };
    let (host, port) = match authority.rsplit_once(':') {
        Some((host, port)) => (host, Some(port)),
        None => (authority, None),
    };
    let port_ok = port.is_none_or(|port| port.parse::<u16>().is_ok_and(|port| port > 0));
    let host_ok = (1..=HOST_MAX).contains(&host.len())
        && host.split('.').all(|label| {
            !label.is_empty()
                && !label.starts_with('-')
                && !label.ends_with('-')
                && label
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        });
    port_ok && host_ok
}

/// What a destination check covers: the address, the laboratory code and the API user.
pub(crate) fn portal_destination(portal: &PortalSettings) -> String {
    format!("{} as {}", portal.ingest_url(), portal.api_user)
}

#[cfg(test)]
#[path = "portal_settings_tests.rs"]
mod tests;
