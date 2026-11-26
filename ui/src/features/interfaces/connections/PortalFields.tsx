import { Controller, useFormContext } from "react-hook-form";
import { Alert } from "@/components/Alert";
import { TextInput } from "@/components/FormFields";
import { TextField } from "@/components/TextField";
import { textFieldProps } from "@/lib/form";
import styles from "./ConnectionDialog.module.css";
import type { ConnectionValues } from "./connectionForm";

/** https://, or http:// to a test portal on this computer; the engine checks the rest. */
const httpsOnly = (value: string) =>
  /^https:\/\//i.test(value) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(value)
    ? true
    : "Enter an https:// address, such as https://ingest.example.com. http:// is accepted only for localhost or 127.0.0.1.";

/** The API token, masked; a saved one is kept while the field is empty. */
function TokenInput({ hasToken }: { hasToken: boolean }) {
  const { control } = useFormContext<ConnectionValues>();
  return (
    <Controller
      control={control}
      name="portal.token"
      rules={{
        validate: (value: string) =>
          hasToken || value !== "" ? true : "Enter the API token LIMSiq gave you.",
      }}
      render={(controller) => (
        <TextField
          {...textFieldProps(controller)}
          label="API token"
          type="password"
          autoComplete="new-password"
          description={
            hasToken
              ? "Leave empty to keep the saved token while the address, laboratory code and API user stay the same."
              : "Kept sealed on this computer and never shown again."
          }
          isRequired={!hasToken}
        />
      )}
    />
  );
}

/**
 * Section 3 for the LIMSiq Patient Portal (#4672): the ingest address, the laboratory's code
 * and the channel's API user and token, all as LIMSiq gave them. There is no test here: the
 * token is usable only once saved, so Test connection is on the connection's page.
 */
export function PortalFields({ hasToken }: { hasToken: boolean }) {
  return (
    <>
      <div className={styles.row}>
        <TextInput
          name="portal.baseUrl"
          label="Ingest address"
          description="https:// and the host, with no path, such as https://ingest.example.com; http:// only for a test portal on this computer (localhost)."
          isRequired
          validate={httpsOnly}
        />
        <TextInput
          name="portal.labCode"
          label="Laboratory code"
          info="The laboratory's code in the portal: letters, digits, - and _, up to 64."
          isRequired
        />
        <TextInput
          name="portal.apiUser"
          label="API user"
          info="The channel's API user from LIMSiq, without a colon, up to 100 characters."
          isRequired
        />
      </div>
      <div className={styles.half}>
        <TokenInput hasToken={hasToken} />
      </div>
      <Alert tone="info" compact>
        Results go to the portal only for patients with an email, which is their consent. After
        saving, use Test connection on the connection's page: it signs in and files nothing.
      </Alert>
    </>
  );
}
