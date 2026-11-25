//! Posting HL7 results to the LIMSiq Patient Portal's ingest API over HTTPS (#4672). One
//! request per message, `POST {base}/api/labs/{lab code}/ingest` with the channel's API
//! user and token, the message in `{"payload": {"hl7": …}}`, and the delivery ID as the
//! `Idempotency-Key`, so a retry is never filed twice. The portal answers 202 when it takes
//! the message, 200 when it already has it and 422 when it refuses it; an acceptance is
//! not proof that the portal processed it. Only `https://` is ever used. Codes are PHI-free;
//! nothing here logs the address, token or content.

use std::time::Duration;

use lis_auth::DataKey;
use lis_interfaces::partner::{AckCode, PortalSettings, valid_portal_settings};
use serde_json::{Value, json};
use zeroize::Zeroizing;

// The token is sealed in the column of an SFTP password, with its context.
use super::sftp::PASSWORD_CONTEXT;

/// How long one request may take, connecting included.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(60);
/// The longest refusal text kept.
const TEXT_MAX: usize = 500;

/// The portal's answer to a message it read.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct PortalAnswer {
    /// `AA` taken (202) or already taken (200); `AR` refused (413, 422).
    pub(crate) code: AckCode,
    pub(crate) text: String,
}

/// Why a message got no answer; it is sent again later. The codes show in Logs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum PortalProblem {
    /// The saved address is not `https://`.
    NotHttps,
    /// The portal refused the API user or token (401, 403).
    Unauthorized,
    /// The portal asked to slow down (429).
    Busy,
    /// The portal failed (5xx) or answered something else.
    Unavailable,
    /// Nothing answered in time, or the connection or its TLS check failed.
    Unreachable,
}

impl PortalProblem {
    /// The stored and displayed code.
    pub(crate) const fn code(self) -> &'static str {
        match self {
            Self::NotHttps => "not_https",
            Self::Unauthorized => "portal_unauthorized",
            Self::Busy => "portal_busy",
            Self::Unavailable => "portal_unavailable",
            Self::Unreachable => "portal_unreachable",
        }
    }
}

/// Posts `message` with `idempotency_key` and returns the portal's answer.
pub(crate) async fn send(
    portal: &PortalSettings,
    token: &str,
    idempotency_key: &str,
    message: &[u8],
) -> Result<PortalAnswer, PortalProblem> {
    let portal = valid_portal_settings(portal.clone()).map_err(|_| PortalProblem::NotHttps)?;
    post(
        &portal.ingest_url(),
        &portal.api_user,
        token,
        idempotency_key,
        message,
    )
    .await
}

/// Whether the portal takes the API user and token, without filing anything: a request
/// without an `Idempotency-Key` signs in, then is refused for the missing key (422).
pub(crate) async fn probe(portal: &PortalSettings, token: &str) -> Result<(), PortalProblem> {
    let portal = valid_portal_settings(portal.clone()).map_err(|_| PortalProblem::NotHttps)?;
    let status = client()?
        .post(portal.ingest_url())
        .basic_auth(&portal.api_user, Some(token))
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .body("{}")
        .send()
        .await
        .map_err(|_| PortalProblem::Unreachable)?
        .status()
        .as_u16();
    match status {
        422 => Ok(()),
        401 | 403 => Err(PortalProblem::Unauthorized),
        429 => Err(PortalProblem::Busy),
        _ => Err(PortalProblem::Unavailable),
    }
}

/// Posts to `url` as is; [`send`] checks it is the portal's `https://` address first.
async fn post(
    url: &str,
    user: &str,
    token: &str,
    idempotency_key: &str,
    message: &[u8],
) -> Result<PortalAnswer, PortalProblem> {
    let body = json!({ "payload": { "hl7": String::from_utf8_lossy(message) } });
    let response = client()?
        .post(url)
        .basic_auth(user, Some(token))
        .header("Idempotency-Key", idempotency_key)
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .body(body.to_string())
        .send()
        .await
        .map_err(|_| PortalProblem::Unreachable)?;
    let status = response.status().as_u16();
    let text = response.text().await.unwrap_or_default();
    answer(status, &text)
}

/// The answer for `status` and the portal's JSON `body`.
fn answer(status: u16, body: &str) -> Result<PortalAnswer, PortalProblem> {
    match status {
        202 => Ok(accepted("Accepted by the portal.")),
        200 => Ok(accepted("Already received by the portal.")),
        413 => Ok(refused(
            "The portal refused the message as too large.".to_owned(),
        )),
        422 => Ok(refused(refusal(body))),
        401 | 403 => Err(PortalProblem::Unauthorized),
        429 => Err(PortalProblem::Busy),
        _ => Err(PortalProblem::Unavailable),
    }
}

fn accepted(text: &str) -> PortalAnswer {
    PortalAnswer {
        code: AckCode::Accepted,
        text: text.to_owned(),
    }
}

fn refused(text: String) -> PortalAnswer {
    PortalAnswer {
        code: AckCode::Rejected,
        text,
    }
}

/// The portal's code, message and the fields it found missing, such as
/// `HL7_REQUIRED_FIELDS_MISSING: HL7 message is missing required fields. (patient_email)`.
fn refusal(body: &str) -> String {
    let json: Value = serde_json::from_str(body).unwrap_or(Value::Null);
    let field = |key: &str| json.get(key).and_then(Value::as_str).unwrap_or_default();
    let fields: Vec<&str> = json
        .get("errors")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|error| error.get("field").and_then(Value::as_str))
        .collect();
    let mut text = match (field("code"), field("message")) {
        ("", "") => "The portal refused the message.".to_owned(),
        (code, "") => code.to_owned(),
        ("", message) => message.to_owned(),
        (code, message) => format!("{code}: {message}"),
    };
    if !fields.is_empty() {
        text = format!("{text} ({})", fields.join(", "));
    }
    text.chars().take(TEXT_MAX).collect()
}

/// The connection's API token, opened with the installation `key`; `None` without either.
pub(crate) fn token(key: Option<&DataKey>, sealed: Option<&[u8]>) -> Option<Zeroizing<String>> {
    let opened = lis_auth::open_secret(key?, PASSWORD_CONTEXT, sealed?).ok()?;
    String::from_utf8(opened.to_vec()).ok().map(Zeroizing::new)
}

/// A client with the ring TLS provider the updater also uses and a request timeout. It
/// follows no redirect, so the token never goes to another address.
fn client() -> Result<reqwest::Client, PortalProblem> {
    if rustls::crypto::CryptoProvider::get_default().is_none() {
        // Another thread may have installed it first; either way one is there.
        let _ = rustls::crypto::ring::default_provider().install_default();
    }
    reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| PortalProblem::Unreachable)
}

#[cfg(test)]
#[path = "portal_tests.rs"]
mod tests;
