import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Code,
  CopyButton,
  Divider,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconRefresh,
  IconShieldLock,
} from "@tabler/icons-react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title";
import { getAppName } from "@/lib/config";
import api from "@/lib/api-client";
import useUserRole from "@/hooks/use-user-role";

// Страница нашего самописного Keycloak SSO. Намеренно живёт вне /ee и не
// зависит от лицензии — в отличие от штатной "Security & SSO", которая
// платная и потому недоступна.
//
// Настройка модуля целиком через переменные окружения контейнера
// (CUSTOM_OIDC_*), поэтому страница read-only: она показывает, что сервер
// реально видит, и проверяет, отвечает ли Keycloak.

type OidcStatus = {
  configured: boolean;
  issuer: string | null;
  clientId: string | null;
  redirectUri: string | null;
  clientSecretSet: boolean;
  discovery: { ok: boolean; error?: string };
};

async function fetchOidcStatus(): Promise<OidcStatus> {
  const res: any = await api.get("/auth/oidc/status");
  // глобальный transform-интерцептор заворачивает ответ в { data: ... },
  // но подстрахуемся на случай, если для этого роута он отключён
  return (res?.data ?? res) as OidcStatus;
}

function ConfigRow({ label, value }: { label: string; value: string | null }) {
  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <Text size="sm" c="dimmed" style={{ whiteSpace: "nowrap" }}>
        {label}
      </Text>
      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
        {value ? (
          <>
            <Code style={{ wordBreak: "break-all" }}>{value}</Code>
            <CopyButton value={value}>
              {({ copied, copy }) => (
                <Button
                  size="compact-xs"
                  variant="subtle"
                  onClick={copy}
                  leftSection={
                    copied ? <IconCheck size={14} /> : <IconCopy size={14} />
                  }
                >
                  {copied ? "copied" : "copy"}
                </Button>
              )}
            </CopyButton>
          </>
        ) : (
          <Badge color="gray" variant="light">
            not set
          </Badge>
        )}
      </Group>
    </Group>
  );
}

export default function KeycloakSettingsPage() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const [status, setStatus] = useState<OidcStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchOidcStatus()
      .then(setStatus)
      .catch((e) =>
        setError(e?.response?.data?.message ?? e?.message ?? "request failed"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (!isAdmin) {
    return null;
  }

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
          "Self-hosted OIDC login through your own Keycloak. Configured with CUSTOM_OIDC_* environment variables on the server, so this page is read-only.",
        )}
      </Text>

      {loading && <Loader size="sm" />}

      {error && (
        <Alert
          color="red"
          icon={<IconAlertTriangle size={18} />}
          title={t("Could not read status")}
        >
          {error}
        </Alert>
      )}

      {status && !loading && (
        <Stack gap="md">
          <Group>
            {status.configured ? (
              <Badge color="green" leftSection={<IconShieldLock size={14} />}>
                {t("Configured")}
              </Badge>
            ) : (
              <Badge color="orange" leftSection={<IconAlertTriangle size={14} />}>
                {t("Not configured")}
              </Badge>
            )}

            {status.configured &&
              (status.discovery.ok ? (
                <Badge color="green" variant="light">
                  {t("Keycloak reachable")}
                </Badge>
              ) : (
                <Badge color="red" variant="light">
                  {t("Keycloak unreachable")}
                </Badge>
              ))}

            <Button
              size="compact-sm"
              variant="default"
              leftSection={<IconRefresh size={14} />}
              onClick={load}
            >
              {t("Re-check")}
            </Button>
          </Group>

          {status.configured && !status.discovery.ok && (
            <Alert
              color="red"
              icon={<IconAlertTriangle size={18} />}
              title={t("Discovery failed")}
            >
              {status.discovery.error}
            </Alert>
          )}

          <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
              <ConfigRow label="Issuer" value={status.issuer} />
              <Divider />
              <ConfigRow label="Client ID" value={status.clientId} />
              <Divider />
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Client secret
                </Text>
                <Badge
                  color={status.clientSecretSet ? "green" : "gray"}
                  variant="light"
                >
                  {status.clientSecretSet ? t("set") : t("not set")}
                </Badge>
              </Group>
              <Divider />
              <ConfigRow label="Redirect URI" value={status.redirectUri} />
            </Stack>
          </Paper>

          <Alert color="blue" title={t("Keycloak client checklist")}>
            <Text size="sm">
              {t(
                "Client authentication: On. Valid redirect URIs must match the Redirect URI above exactly, including the /api/ prefix — a missing /api/ is the most common mistake and Keycloak answers with 'Invalid parameter: redirect_uri'.",
              )}
            </Text>
          </Alert>

          <Group>
            <Button
              component="a"
              href="/api/auth/oidc/login"
              leftSection={<IconShieldLock size={18} />}
              disabled={!status.configured}
            >
              {t("Test login")}
            </Button>
          </Group>
        </Stack>
      )}
    </>
  );
}
