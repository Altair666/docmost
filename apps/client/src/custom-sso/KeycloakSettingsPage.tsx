import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Code,
  CopyButton,
  Group,
  Loader,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconDeviceFloppy,
  IconRefresh,
  IconMinus,
  IconShieldLock,
  IconX,
} from "@tabler/icons-react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title";
import { getAppName } from "@/lib/config";
import api from "@/lib/api-client";
import useUserRole from "@/hooks/use-user-role";

// Страница нашего самописного Keycloak SSO. Живёт вне /ee и не зависит от
// лицензии — в отличие от штатной "Security & SSO", которая платная.
//
// Значения сохраняются в workspaces.settings->'customSso' и перекрывают
// переменные окружения CUSTOM_OIDC_*.

type ConfigSource = "db" | "env" | null;

type CheckResult = { ok: boolean; error?: string; skipped?: boolean };

type OidcStatus = {
  configured: boolean;
  ready: boolean;
  issuer: string | null;
  clientId: string | null;
  redirectUri: string | null;
  clientSecretSet: boolean;
  sources: Record<string, ConfigSource>;
  checks: {
    discovery: CheckResult;
    client: CheckResult;
    redirectUri: CheckResult;
  };
};

function unwrap<T>(res: any): T {
  // глобальный transform-интерцептор заворачивает ответ в { data: ... }
  return (res?.data ?? res) as T;
}

async function fetchOidcStatus(): Promise<OidcStatus> {
  return unwrap<OidcStatus>(await api.get("/auth/oidc/status"));
}

async function saveOidcConfig(values: {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<OidcStatus> {
  return unwrap<OidcStatus>(await api.post("/auth/oidc/config", values));
}

function SourceBadge({ source }: { source: ConfigSource }) {
  if (source === "db") {
    return (
      <Badge size="xs" variant="light" color="blue">
        saved here
      </Badge>
    );
  }
  if (source === "env") {
    return (
      <Badge size="xs" variant="light" color="gray">
        from env
      </Badge>
    );
  }
  return null;
}

function CheckRow({
  label,
  result,
}: {
  label: string;
  result?: CheckResult;
}) {
  const ok = result?.ok === true;
  // Пропущенную проверку красим нейтрально: красный крест без объяснения
  // читается как отдельная поломка, хотя она просто не выполнялась.
  const skipped = !ok && result?.skipped === true;
  const color = ok ? "green" : skipped ? "gray" : "red";
  return (
    <Stack gap={2}>
      <Group gap="xs" wrap="nowrap" align="center">
        <ThemeIcon size="sm" radius="xl" color={color} variant="light">
          {ok ? (
            <IconCheck size={14} />
          ) : skipped ? (
            <IconMinus size={14} />
          ) : (
            <IconX size={14} />
          )}
        </ThemeIcon>
        <Text size="sm" c={skipped ? "dimmed" : undefined}>
          {label}
        </Text>
      </Group>
      {skipped && (
        <Text size="xs" c="dimmed" ml={30}>
          not checked yet — fix the item above first
        </Text>
      )}
      {!ok && !skipped && result?.error && (
        <Text size="xs" c="red" ml={30}>
          {result.error}
        </Text>
      )}
    </Stack>
  );
}

export default function KeycloakSettingsPage() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();

  const [status, setStatus] = useState<OidcStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useForm({
    initialValues: {
      issuer: "",
      clientId: "docmost",
      clientSecret: "",
      redirectUri: "",
    },
    validate: {
      issuer: (v) => (v.trim().length === 0 ? t("Required") : null),
      clientId: (v) => (v.trim().length === 0 ? t("Required") : null),
      redirectUri: (v) => (v.trim().length === 0 ? t("Required") : null),
    },
  });

  const applyStatus = (s: OidcStatus) => {
    setStatus(s);
    form.setValues({
      issuer: s.issuer ?? "",
      clientId: s.clientId ?? "docmost",
      clientSecret: "",
      redirectUri:
        s.redirectUri ?? `${window.location.origin}/api/auth/oidc/callback`,
    });
    form.resetDirty();
  };

  const load = () => {
    setLoading(true);
    setError(null);
    fetchOidcStatus()
      .then(applyStatus)
      .catch((e) =>
        setError(e?.response?.data?.message ?? e?.message ?? "request failed"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onSubmit = form.onSubmit((values) => {
    setSaving(true);
    setError(null);
    setSaved(false);
    saveOidcConfig(values)
      .then((s) => {
        applyStatus(s);
        setSaved(true);
      })
      .catch((e) =>
        setError(e?.response?.data?.message ?? e?.message ?? "save failed"),
      )
      .finally(() => setSaving(false));
  });

  if (!isAdmin) {
    return null;
  }

  const redirectUri = status?.redirectUri ?? form.values.redirectUri;

  return (
    <>
      <Helmet>
        <title>
          {t("Keycloak SSO")} - {getAppName()}
        </title>
      </Helmet>

      <SettingsTitle title={t("Keycloak SSO")} />

      <Text size="sm" c="dimmed" mb="md">
        {t(
          "Self-hosted OIDC login through your own Keycloak. Values saved here are stored in the workspace settings and take precedence over the CUSTOM_OIDC_* environment variables.",
        )}
      </Text>

      {loading && <Loader size="sm" />}

      {error && (
        <Alert
          color="red"
          icon={<IconAlertTriangle size={18} />}
          title={t("Something went wrong")}
          mb="md"
        >
          {error}
        </Alert>
      )}

      {status && !loading && (
        <Stack gap="md">
          <Group>
            {status.ready ? (
              <Badge color="green" leftSection={<IconShieldLock size={14} />}>
                {t("Ready to use")}
              </Badge>
            ) : status.configured ? (
              <Badge
                color="orange"
                leftSection={<IconAlertTriangle size={14} />}
              >
                {t("Filled in, but not working yet")}
              </Badge>
            ) : (
              <Badge color="gray" leftSection={<IconAlertTriangle size={14} />}>
                {t("Not configured")}
              </Badge>
            )}

            <Button
              size="compact-sm"
              variant="default"
              leftSection={<IconRefresh size={14} />}
              onClick={load}
            >
              {t("Re-check")}
            </Button>
          </Group>

          {saved && (
            <Alert color="green" icon={<IconCheck size={18} />}>
              {t("Saved")}
            </Alert>
          )}

          {status.configured && (
            <Paper withBorder p="md" radius="md">
              <Stack gap="sm">
                <CheckRow
                  label={t("Issuer responds and returns its discovery document")}
                  result={status.checks?.discovery}
                />
                <CheckRow
                  label={t("Keycloak accepts this Client ID and secret")}
                  result={status.checks?.client}
                />
                <CheckRow
                  label={t("Redirect URI is registered on the client")}
                  result={status.checks?.redirectUri}
                />
              </Stack>
            </Paper>
          )}

          <Paper withBorder p="md" radius="md">
            <form onSubmit={onSubmit}>
              <Stack gap="md">
                <TextInput
                  label={
                    <Group gap="xs">
                      <span>Issuer</span>
                      <SourceBadge source={status.sources?.issuer ?? null} />
                    </Group>
                  }
                  description={t(
                    "Realm URL — ends with /realms/<realm>, not with /.well-known/...",
                  )}
                  placeholder="https://keycloak.example.com/realms/master"
                  {...form.getInputProps("issuer")}
                />

                <TextInput
                  label={
                    <Group gap="xs">
                      <span>Client ID</span>
                      <SourceBadge source={status.sources?.clientId ?? null} />
                    </Group>
                  }
                  description={t(
                    "Must match the Client ID of an existing client in that realm.",
                  )}
                  placeholder="docmost"
                  {...form.getInputProps("clientId")}
                />

                <PasswordInput
                  label={
                    <Group gap="xs">
                      <span>Client secret</span>
                      <SourceBadge
                        source={status.sources?.clientSecret ?? null}
                      />
                    </Group>
                  }
                  description={
                    status.clientSecretSet
                      ? t("A secret is already stored. Leave empty to keep it.")
                      : t(
                          "Copy it from the Credentials tab of that same client.",
                        )
                  }
                  placeholder={
                    status.clientSecretSet ? "••••••••••••" : "client secret"
                  }
                  {...form.getInputProps("clientSecret")}
                />

                <TextInput
                  label={
                    <Group gap="xs">
                      <span>Redirect URI</span>
                      <SourceBadge
                        source={status.sources?.redirectUri ?? null}
                      />
                    </Group>
                  }
                  description={t(
                    "Must appear in Valid redirect URIs in Keycloak, exactly — including the /api/ prefix.",
                  )}
                  {...form.getInputProps("redirectUri")}
                />

                <Group justify="space-between">
                  <CopyButton value={redirectUri || ""}>
                    {({ copied, copy }) => (
                      <Button
                        variant="subtle"
                        size="compact-sm"
                        onClick={copy}
                        leftSection={
                          copied ? (
                            <IconCheck size={14} />
                          ) : (
                            <IconCopy size={14} />
                          )
                        }
                      >
                        {copied
                          ? t("Redirect URI copied")
                          : t("Copy redirect URI")}
                      </Button>
                    )}
                  </CopyButton>

                  <Button
                    type="submit"
                    loading={saving}
                    leftSection={<IconDeviceFloppy size={18} />}
                  >
                    {t("Save")}
                  </Button>
                </Group>
              </Stack>
            </form>
          </Paper>

          <Alert color="blue" title={t("Keycloak client checklist")}>
            <Stack gap={4}>
              <Text size="sm">
                {t("Client authentication: On (confidential client).")}
              </Text>
              <Text size="sm">
                {t("Valid redirect URIs:")} <Code>{redirectUri}</Code>
              </Text>
              <Text size="sm">
                {t(
                  "A missing /api/ prefix is the most common mistake — Keycloak then answers 'Invalid parameter: redirect_uri'.",
                )}
              </Text>
            </Stack>
          </Alert>

          <Group>
            <Button
              component="a"
              href="/api/auth/oidc/login"
              leftSection={<IconShieldLock size={18} />}
              disabled={!status.ready}
            >
              {t("Test login")}
            </Button>
          </Group>
        </Stack>
      )}
    </>
  );
}
