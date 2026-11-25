//! The patient's portal email: a filled email is the patient's consent to delivery to the
//! LIMSiq Patient Portal; removing it stops further delivery.

use lis_core::CommandError;
use lis_identity::{SetSubjectEmail, SubjectEmailSet};

use super::ENTER_ORDERS;
use crate::Engine;
use crate::registry::{CommandSpec, spec};

pub(crate) const SET_SUBJECT_EMAIL: CommandSpec =
    spec("set_subject_email", "identity.set_email", ENTER_ORDERS);

impl Engine {
    /// `set_subject_email`.
    pub async fn set_subject_email(
        &self,
        input: SetSubjectEmail,
    ) -> Result<SubjectEmailSet, CommandError> {
        self.run(&SET_SUBJECT_EMAIL, |call| async move {
            self.write(&call, move |ctx| {
                lis_identity::set_subject_email(ctx, input)
            })
            .await
        })
        .await
    }
}
