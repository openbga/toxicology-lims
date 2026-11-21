//! A person's follow-up of incoming orders (ticket #4555 step 5c; REQ-INT-002): a folder
//! that cannot be read puts its connection in error until a reading works again; a message
//! waiting for its patient or held for review can be rejected with a reason (#4886), and a
//! refused one resolved with a note, after which neither stays under Rejected. Synthetic
//! data only.

use std::fs;

use lis_core::{CommandError, ErrorCode};
use lis_engine::{Engine, PartnerConnectionInput, RejectReceivedMessage, ResolvePartnerRejection};
use lis_interfaces::partner::{
    ConnectionStatus, ListPartnerMessages, MessageView, PartnerMessageRow, ReceivedState,
};

use crate::m2_lab::Role;
use crate::m3_fixture::Staff;
use crate::partner_orders::{Orders, SENDER, oml, register_patient};

/// The authorization table's calls of this step's commands, on records that do not exist.
pub(super) async fn follow_up_call(
    engine: &Engine,
    name: &str,
) -> Option<Result<(), CommandError>> {
    Some(match name {
        "reject_received_message" => {
            engine
                .reject_received_message(RejectReceivedMessage {
                    received_id: lis_core::Id::generate(),
                    reason: "Synthetic authorization test".to_owned(),
                })
                .await
        }
        "resolve_partner_rejection" => {
            engine
                .resolve_partner_rejection(ResolvePartnerRejection {
                    received_id: Some(lis_core::Id::generate()),
                    delivery_id: None,
                    note: "Synthetic authorization test".to_owned(),
                })
                .await
        }
        _ => return None,
    })
}

#[tokio::test]
async fn a_folder_that_cannot_be_read_puts_its_connection_in_error_until_it_reads_again() {
    let orders = Orders::start().await;
    let id = orders.connection.connection.id;
    let engine = orders.bench.lab().engine();
    fs::remove_dir_all(orders.input.path()).unwrap();
    orders.read().await;
    orders.bench.sign_in(Staff::Desk(Role::Admin)).await;
    let connection = engine
        .get_partner_connection(PartnerConnectionInput { connection_id: id })
        .await
        .unwrap()
        .connection;
    assert_eq!(connection.status, ConnectionStatus::Error);
    let reading = connection.last_attempt.unwrap();
    assert_eq!(reading.error_code.as_deref(), Some("folder_missing"));
    assert_eq!(
        engine.list_partner_connections().await.unwrap()[0].status,
        ConnectionStatus::Error
    );

    fs::create_dir(orders.input.path()).unwrap();
    orders.read().await;
    let connection = engine
        .get_partner_connection(PartnerConnectionInput { connection_id: id })
        .await
        .unwrap()
        .connection;
    assert_eq!(connection.status, ConnectionStatus::Active);
    let reading = connection.last_attempt.unwrap();
    assert_eq!(reading.error_code, None);
    assert!(reading.at > connection.last_change.at);
}

#[tokio::test]
async fn a_person_rejects_a_waiting_order_and_resolves_a_refused_one() {
    let orders = Orders::start().await;
    let input = orders.input.path();
    fs::write(input.join("clinic_0001.hl7"), oml(SENDER, "MSG-1")).unwrap();
    fs::write(input.join("other.hl7"), oml("OTHER-FAC", "MSG-9")).unwrap();
    orders.read().await;
    // A refused message is the partner's content: the connection keeps working.
    let rows = log_rows(&orders).await;
    let (waiting, refused) = (
        row(&rows, ReceivedState::WaitingPatient),
        row(&rows, ReceivedState::Rejected),
    );
    assert_eq!(waiting.allowed_actions, ["reject_received_message"]);
    assert_eq!(refused.allowed_actions, ["resolve_partner_rejection"]);
    let engine = orders.bench.lab().engine();
    let connection = engine.list_partner_connections().await.unwrap().remove(0);
    assert_eq!(connection.status, ConnectionStatus::Active);

    let reject = |reason: &str| RejectReceivedMessage {
        received_id: waiting.message_id.cast(),
        reason: reason.to_owned(),
    };
    let refused_reason = engine
        .reject_received_message(reject(" "))
        .await
        .unwrap_err();
    assert_eq!(refused_reason.code(), ErrorCode::Validation);
    let reason = "Synthetic: the clinic cancelled it by phone";
    engine
        .reject_received_message(reject(reason))
        .await
        .unwrap();
    let again = engine
        .reject_received_message(reject(reason))
        .await
        .unwrap_err();
    assert_eq!(again.code(), ErrorCode::Conflict);

    let resolve = ResolvePartnerRejection {
        received_id: Some(refused.message_id.cast()),
        delivery_id: None,
        note: "Synthetic: the clinic fixed its sending facility and sent it again".to_owned(),
    };
    engine
        .resolve_partner_rejection(resolve.clone())
        .await
        .unwrap();
    let again = engine.resolve_partner_rejection(resolve).await.unwrap_err();
    assert_eq!(again.code(), ErrorCode::Conflict);

    let rows = log_rows(&orders).await;
    for row in &rows {
        let resolved = row.rejection_resolved.as_ref().unwrap();
        assert!(resolved.resolved.by_display.is_some());
        assert!(row.allowed_actions.is_empty());
    }
    let rejected = rows
        .iter()
        .find(|row| row.message_id == waiting.message_id)
        .unwrap();
    assert_eq!(rejected.received, Some(ReceivedState::Rejected));
    assert_eq!(rejected.error_code.as_deref(), Some("rejected_by_person"));
    assert_eq!(
        rejected
            .rejection_resolved
            .as_ref()
            .map(|done| done.note.as_str()),
        Some(reason)
    );

    // Its patient registered later, the rejected message makes no order.
    register_patient(&orders).await;
    orders.read().await;
    assert!(
        orders
            .states()
            .iter()
            .all(|(_, state, _)| state != "order_created")
    );
}

/// #4886: a message held for review, here one reusing an earlier MSH-10 with other content,
/// is rejected like one waiting for its patient: rejected by a person with the reason, and
/// neither makes an order once the patient is registered.
#[tokio::test]
async fn a_person_rejects_a_held_message_and_a_waiting_one() {
    let orders = Orders::start().await;
    let input = orders.input.path();
    fs::write(input.join("clinic_0001.hl7"), oml(SENDER, "MSG-1")).unwrap();
    orders.read().await;
    let changed = oml(SENDER, "MSG-1").replace("ORD-0001", "ORD-0002");
    fs::write(input.join("clinic_0002.hl7"), changed).unwrap();
    orders.read().await;
    let rows = log_rows(&orders).await;
    let held = row(&rows, ReceivedState::Held);
    let waiting = row(&rows, ReceivedState::WaitingPatient);
    assert_eq!(held.error_code.as_deref(), Some("changed_content"));
    assert_eq!(held.allowed_actions, ["reject_received_message"]);

    let engine = orders.bench.lab().engine();
    let reasons = [
        (
            &held,
            "Synthetic: the clinic sent a corrected copy under a new ID",
        ),
        (&waiting, "Synthetic: the clinic cancelled it by phone"),
    ];
    for (message, reason) in reasons {
        engine
            .reject_received_message(RejectReceivedMessage {
                received_id: message.message_id.cast(),
                reason: reason.to_owned(),
            })
            .await
            .unwrap();
    }

    let rows = log_rows(&orders).await;
    for (message, reason) in reasons {
        let rejected = rows
            .iter()
            .find(|row| row.message_id == message.message_id)
            .unwrap();
        assert_eq!(rejected.received, Some(ReceivedState::Rejected));
        assert_eq!(rejected.error_code.as_deref(), Some("rejected_by_person"));
        let resolved = rejected.rejection_resolved.as_ref().unwrap();
        assert_eq!(resolved.note, reason);
        assert!(resolved.resolved.by_display.is_some());
        assert!(rejected.allowed_actions.is_empty());
    }

    register_patient(&orders).await;
    orders.read().await;
    assert!(
        orders
            .states()
            .iter()
            .all(|(_, state, _)| state == "rejected")
    );
}

/// #4887: a duplicate names the placer order number of the message it repeats, and a refused
/// message counts under the connection's Errors only until a person resolves it.
#[tokio::test]
async fn a_duplicate_names_its_order_and_a_resolved_rejection_leaves_errors() {
    let orders = Orders::start().await;
    let input = orders.input.path();
    fs::write(input.join("clinic_0001.hl7"), oml(SENDER, "MSG-1")).unwrap();
    fs::write(input.join("other.hl7"), oml("OTHER-FAC", "MSG-9")).unwrap();
    orders.read().await;
    fs::write(input.join("clinic_0001_again.hl7"), oml(SENDER, "MSG-1")).unwrap();
    orders.read().await;
    let rows = log_rows(&orders).await;
    let duplicate = row(&rows, ReceivedState::Duplicate);
    assert_eq!(duplicate.source_label.as_deref(), Some("ORD-0001"));
    let refused = row(&rows, ReceivedState::Rejected);
    assert_eq!(refused.error_code.as_deref(), Some("not_accepted_sender"));

    let engine = orders.bench.lab().engine();
    assert_eq!(errors(&orders).await, 1);
    engine
        .resolve_partner_rejection(ResolvePartnerRejection {
            received_id: Some(refused.message_id.cast()),
            delivery_id: None,
            note: "Synthetic: the clinic sent it again from its registered facility".to_owned(),
        })
        .await
        .unwrap();
    assert_eq!(errors(&orders).await, 0);
}

/// The connection's Errors column.
async fn errors(orders: &Orders) -> u32 {
    let engine = orders.bench.lab().engine();
    engine.list_partner_connections().await.unwrap()[0].failing
}

async fn log_rows(orders: &Orders) -> Vec<PartnerMessageRow> {
    orders.bench.sign_in(Staff::Desk(Role::Admin)).await;
    let input = ListPartnerMessages {
        since: None,
        connection_id: Some(orders.connection.connection.id),
        view: MessageView::All,
        search: None,
        hide_tests: false,
        row_ids: Vec::new(),
        report_id: None,
    };
    let engine = orders.bench.lab().engine();
    engine.list_partner_messages(input).await.unwrap().rows
}

fn row(rows: &[PartnerMessageRow], state: ReceivedState) -> PartnerMessageRow {
    rows.iter()
        .find(|row| row.received == Some(state))
        .cloned()
        .unwrap()
}
