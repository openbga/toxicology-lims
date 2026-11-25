//! Posting to an in-process portal on localhost, over plain HTTP, that answers as told.
//! `send` itself refuses anything but `https://`; these tests call `post`. Synthetic
//! messages only.

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::oneshot;

use super::*;

const ORU: &[u8] =
    b"MSH|^~\\&|VIBETOX LIS|LAB|LIMSIQ|PORTAL|20261125101500||ORU^R01|MSG-0001|T|2.5.1\r";

/// A portal on a free localhost port that answers one request with `status` and `body`,
/// and hands back the request it read.
async fn portal(status: u16, body: &'static str) -> (String, oneshot::Receiver<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!(
        "http://{}/api/labs/demo-lab/ingest",
        listener.local_addr().unwrap()
    );
    let (sender, receiver) = oneshot::channel();
    tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.unwrap();
        let mut request = Vec::new();
        let mut chunk = [0_u8; 4096];
        while !complete(&request) {
            let read = stream.read(&mut chunk).await.unwrap();
            if read == 0 {
                break;
            }
            request.extend_from_slice(&chunk[..read]);
        }
        let answer = format!(
            "HTTP/1.1 {status} X\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\
             Connection: close\r\n\r\n{body}",
            body.len()
        );
        stream.write_all(answer.as_bytes()).await.unwrap();
        let _ = sender.send(String::from_utf8_lossy(&request).into_owned());
    });
    (url, receiver)
}

/// Whether `request` holds its headers and the whole body their Content-Length announces.
fn complete(request: &[u8]) -> bool {
    let text = String::from_utf8_lossy(request);
    let Some((head, body)) = text.split_once("\r\n\r\n") else {
        return false;
    };
    let length = head
        .lines()
        .find_map(|line| {
            let (name, value) = line.split_once(':')?;
            name.eq_ignore_ascii_case("content-length")
                .then(|| value.trim().parse::<usize>().ok())?
        })
        .unwrap_or(0);
    body.len() >= length
}

async fn posted(status: u16, body: &'static str) -> (Result<PortalAnswer, PortalProblem>, String) {
    let (url, request) = portal(status, body).await;
    let result = post(&url, "lab-7-abcd1234", "synthetic-token", "delivery-1", ORU).await;
    (result, request.await.unwrap_or_default())
}

#[tokio::test]
async fn a_message_is_posted_with_the_channel_and_its_idempotency_key() {
    let (result, request) = posted(202, r#"{"status":"accepted"}"#).await;
    assert_eq!(result, Ok(accepted("Accepted by the portal.")));
    let lower = request.to_ascii_lowercase();
    assert!(request.starts_with("POST /api/labs/demo-lab/ingest HTTP/1.1"));
    // Basic base64("lab-7-abcd1234:synthetic-token").
    assert!(lower.contains("authorization: basic bgfiltctywjjzdeymzq6c3ludghldgljlxrva2vu"));
    assert!(lower.contains("idempotency-key: delivery-1"));
    assert!(lower.contains("content-type: application/json"));
    assert!(request.contains(r#"{"payload":{"hl7":"MSH|^~\\&|VIBETOX LIS"#));
}

#[tokio::test]
async fn a_message_the_portal_already_has_counts_as_taken() {
    let (result, _) = posted(200, r#"{"status":"duplicate"}"#).await;
    assert_eq!(result, Ok(accepted("Already received by the portal.")));
}

#[tokio::test]
async fn a_refusal_keeps_the_portals_reason_and_missing_fields() {
    let body = r#"{"code":"HL7_REQUIRED_FIELDS_MISSING","message":"HL7 message is missing required fields.","errors":[{"field":"patient_email","segment":"PID-14"}]}"#;
    let (result, _) = posted(422, body).await;
    assert_eq!(
        result,
        Ok(refused(
            "HL7_REQUIRED_FIELDS_MISSING: HL7 message is missing required fields. \
             (patient_email)"
                .to_owned()
        ))
    );
}

#[tokio::test]
async fn sign_in_load_and_server_problems_are_retried() {
    for (status, problem) in [
        (401, PortalProblem::Unauthorized),
        (403, PortalProblem::Unauthorized),
        (429, PortalProblem::Busy),
        (500, PortalProblem::Unavailable),
        (302, PortalProblem::Unavailable),
    ] {
        let (result, _) = posted(status, "{}").await;
        assert_eq!(result, Err(problem), "{status}");
    }
}

#[tokio::test]
async fn nothing_listening_is_unreachable() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}/ingest", listener.local_addr().unwrap());
    drop(listener);
    let result = post(&url, "user", "token", "delivery-1", ORU).await;
    assert_eq!(result, Err(PortalProblem::Unreachable));
}

#[tokio::test]
async fn only_an_https_address_is_ever_used() {
    let portal = PortalSettings {
        base_url: "http://127.0.0.1:9".to_owned(),
        lab_code: "demo-lab".to_owned(),
        api_user: "user".to_owned(),
    };
    let result = send(&portal, "token", "delivery-1", ORU).await;
    assert_eq!(result, Err(PortalProblem::NotHttps));
}

#[test]
fn refusal_text_without_json_is_generic_and_bounded() {
    assert_eq!(refusal("not json"), "The portal refused the message.");
    let long = format!(r#"{{"message":"{}"}}"#, "x".repeat(900));
    assert_eq!(refusal(&long).chars().count(), TEXT_MAX);
}
