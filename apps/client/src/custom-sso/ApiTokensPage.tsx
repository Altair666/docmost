import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Code,
  CopyButton,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconKey,
  IconTrash,
} from "@tabler/icons-react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title";
import { getAppName } from "@/lib/config";
import api from "@/lib/api-client";

// Персональные API-токены: каждый пользователь заводит и отзывает свои.
// Под капотом токен — обычная долгоживущая сессия Docmost, поэтому он
// работает на всех эндпоинтах, а отзыв мгновенный.

type ApiToken = {
  id: string;
  name: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
};

function unwrap<T>(res: any): T {
  return (res?.data ?? res) as T;
}

const EXPIRY_OPTIONS = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
  { value: "3650", label: "No expiration (10 years)" },
];

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function TokenStatus({ token }: { token: ApiToken }) {
  const { t } = useTranslation();
  if (token.revokedAt) {
    return (
      <Badge color="gray" variant="light">
        {t("Revoked")}
      </Badge>
    );
  }
  if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
    return (
      <Badge color="red" variant="light">
        {t("Expired")}
      </Badge>
    );
  }
  return (
    <Badge color="green" variant="light">
      {t("Active")}
    </Badge>
  );
}

export default function ApiTokensPage() {
  const { t } = useTranslation();

  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<string | null>(null);

  const form = useForm({
    initialValues: { name: "", expiresInDays: "365" },
    validate: {
      name: (v) => (v.trim().length === 0 ? t("Required") : null),
    },
  });

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .post("/api-tokens/list", {})
      .then((res) => setTokens(unwrap<ApiToken[]>(res) ?? []))
      .catch((e) =>
        setError(e?.response?.data?.message ?? e?.message ?? "request failed"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onCreate = form.onSubmit((values) => {
    setCreating(true);
    setError(null);
    api
      .post("/api-tokens/create", {
        name: values.name,
        expiresInDays: Number(values.expiresInDays),
      })
      .then((res) => {
        const created = unwrap<ApiToken & { token: string }>(res);
        setIssued(created.token);
        form.reset();
        load();
      })
      .catch((e) =>
        setError(e?.response?.data?.message ?? e?.message ?? "create failed"),
      )
      .finally(() => setCreating(false));
  });

  const onRevoke = (tokenId: string) => {
    setError(null);
    api
      .post("/api-tokens/revoke", { tokenId })
      .then(load)
      .catch((e) =>
        setError(e?.response?.data?.message ?? e?.message ?? "revoke failed"),
      );
  };

  return (
    <>
      <Helmet>
        <title>
          {t("API tokens")} - {getAppName()}
        </title>
      </Helmet>

      <SettingsTitle title={t("API tokens")} />

      <Text size="sm" c="dimmed" mb="md">
        {t(
          "Personal tokens for calling the API without a browser. A token acts as you and carries exactly your permissions. Send it as an Authorization: Bearer header.",
        )}
      </Text>

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

      <Paper withBorder p="md" radius="md" mb="md">
        <form onSubmit={onCreate}>
          <Group align="flex-end" grow>
            <TextInput
              label={t("Name")}
              placeholder={t("What is this token for?")}
              {...form.getInputProps("name")}
            />
            <Select
              label={t("Expires")}
              data={EXPIRY_OPTIONS}
              allowDeselect={false}
              {...form.getInputProps("expiresInDays")}
            />
            <Button
              type="submit"
              loading={creating}
              leftSection={<IconKey size={18} />}
            >
              {t("Create token")}
            </Button>
          </Group>
        </form>
      </Paper>

      {loading ? (
        <Loader size="sm" />
      ) : tokens.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t("No tokens yet.")}
        </Text>
      ) : (
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("Name")}</Table.Th>
              <Table.Th>{t("Status")}</Table.Th>
              <Table.Th>{t("Last used")}</Table.Th>
              <Table.Th>{t("Expires")}</Table.Th>
              <Table.Th>{t("Created")}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {tokens.map((token) => (
              <Table.Tr key={token.id}>
                <Table.Td>{token.name}</Table.Td>
                <Table.Td>
                  <TokenStatus token={token} />
                </Table.Td>
                <Table.Td>{formatDate(token.lastUsedAt)}</Table.Td>
                <Table.Td>{formatDate(token.expiresAt)}</Table.Td>
                <Table.Td>{formatDate(token.createdAt)}</Table.Td>
                <Table.Td>
                  {!token.revokedAt && (
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      color="red"
                      leftSection={<IconTrash size={14} />}
                      onClick={() => onRevoke(token.id)}
                    >
                      {t("Revoke")}
                    </Button>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={!!issued}
        onClose={() => setIssued(null)}
        title={t("Token created")}
        size="lg"
      >
        <Stack gap="md">
          <Alert color="orange" icon={<IconAlertTriangle size={18} />}>
            {t(
              "Copy it now — it is shown once and cannot be retrieved afterwards.",
            )}
          </Alert>

          <Code block style={{ wordBreak: "break-all" }}>
            {issued}
          </Code>

          <Group justify="space-between">
            <CopyButton value={issued ?? ""}>
              {({ copied, copy }) => (
                <Button
                  variant="default"
                  onClick={copy}
                  leftSection={
                    copied ? <IconCheck size={16} /> : <IconCopy size={16} />
                  }
                >
                  {copied ? t("Copied") : t("Copy token")}
                </Button>
              )}
            </CopyButton>
            <Button onClick={() => setIssued(null)}>
              {t("I've saved it")}
            </Button>
          </Group>

          <Text size="xs" c="dimmed">
            {t("Example:")}{" "}
            <Code>
              curl -H &quot;Authorization: Bearer &lt;token&gt;&quot; -X POST{" "}
              {window.location.origin}/api/spaces -d &apos;&#123;&#125;&apos;
            </Code>
          </Text>
        </Stack>
      </Modal>
    </>
  );
}
