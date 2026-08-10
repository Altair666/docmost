import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Code,
  FileInput,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconCheck,
  IconDeviceFloppy,
  IconFileUpload,
} from "@tabler/icons-react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title";
import { getAppName } from "@/lib/config";
import api from "@/lib/api-client";
import useUserRole from "@/hooks/use-user-role";
import {
  applyUiTheme,
  storeUiFlags,
  UiTheme,
  UiThemeState,
} from "@/custom-sso/ui-theme";

function unwrap<T>(res: any): T {
  return (res?.data ?? res) as T;
}

export default function UiThemePage() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();

  const [theme, setTheme] = useState<UiTheme>("stock");
  const [css, setCss] = useState("");
  const [hideEe, setHideEe] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/ui-theme")
      .then((res) => {
        const state = unwrap<UiThemeState>(res);
        setTheme(state.theme);
        setCss(state.customCss ?? "");
        setHideEe(state.hideEeItems !== false);
      })
      .catch((e) => setError(e?.message ?? "request failed"))
      .finally(() => setLoading(false));
  }, []);

  if (!isAdmin) {
    return null;
  }

  const save = (patch: {
    theme?: UiTheme;
    customCss?: string;
    hideEeItems?: boolean;
  }) => {
    setSaving(true);
    setError(null);
    setSaved(false);

    // theme отправляем всегда: сервер ждёт его обязательным полем.
    // Остальное — только когда меняем, чтобы не затирать чужое.
    const payload: Record<string, unknown> = { theme: patch.theme ?? theme };
    if (patch.customCss !== undefined) payload.customCss = patch.customCss;
    if (patch.hideEeItems !== undefined) payload.hideEeItems = patch.hideEeItems;

    api
      .post("/ui-theme", payload)
      .then((res) => {
        const state = unwrap<UiThemeState>(res);
        setTheme(state.theme);
        setCss(state.customCss ?? "");
        setHideEe(state.hideEeItems !== false);
        storeUiFlags(state);
        applyUiTheme(state);
        setSaved(true);
      })
      .catch((e) =>
        setError(e?.response?.data?.message ?? e?.message ?? "save failed"),
      )
      .finally(() => setSaving(false));
  };

  const onFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCss(String(reader.result ?? ""));
    reader.onerror = () => setError(t("Could not read the file"));
    reader.readAsText(file);
  };

  const noCss = css.trim().length === 0;

  return (
    <>
      <Helmet>
        <title>
          {t("Appearance")} - {getAppName()}
        </title>
      </Helmet>

      <SettingsTitle title={t("Appearance")} />

      <Text size="sm" c="dimmed" mb="md">
        {t(
          "How the interface looks. The choice applies to everyone in the workspace, so only administrators can change it.",
        )}
      </Text>

      {error && (
        <Alert color="red" icon={<IconAlertTriangle size={18} />} mb="md">
          {error}
        </Alert>
      )}

      {saved && (
        <Alert color="green" icon={<IconCheck size={18} />} mb="md">
          {t("Saved. Everyone sees it after a page reload.")}
        </Alert>
      )}

      {loading ? (
        <Loader size="sm" />
      ) : (
        <Stack gap="md">
          <Paper withBorder p="md" radius="md">
            <Stack gap="lg">
              <Checkbox
                checked={theme === "custom"}
                disabled={saving || (noCss && theme !== "custom")}
                onChange={(e) =>
                  save({ theme: e.currentTarget.checked ? "custom" : "stock" })
                }
                label={t("Our interface")}
                description={
                  noCss && theme !== "custom"
                    ? t("Add a stylesheet below first.")
                    : t(
                        "The stylesheet below plus our own header, menu and collapsed rail. Unchecked: Docmost exactly as shipped.",
                      )
                }
              />

              <Checkbox
                checked={hideEe}
                disabled={saving}
                onChange={(e) => save({ hideEeItems: e.currentTarget.checked })}
                label={t("Hide paid-edition items")}
                description={t(
                  "Docmost greys out features that need a paid licence and leaves them in place. Checked: they are hidden entirely.",
                )}
              />
            </Stack>
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
              <Group justify="space-between" align="flex-end">
                <Text fw={600} size="sm">
                  {t("Stylesheet")}
                </Text>
                <Text size="xs" c="dimmed">
                  {css.length.toLocaleString()} {t("characters")}
                </Text>
              </Group>

              <Textarea
                autosize
                minRows={12}
                maxRows={26}
                placeholder={"html { /* ... */ }"}
                value={css}
                onChange={(e) => setCss(e.currentTarget.value)}
                styles={{
                  input: {
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                    fontSize: 12,
                  },
                }}
              />

              <Group>
                <FileInput
                  placeholder={t("Upload a .css file")}
                  accept=".css,text/css"
                  onChange={onFile}
                  leftSection={<IconFileUpload size={16} />}
                  clearable
                  style={{ flex: 1, minWidth: 240 }}
                />
                <Button
                  loading={saving}
                  disabled={noCss}
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={() => save({ theme: "custom", customCss: css })}
                >
                  {t("Save and apply")}
                </Button>
              </Group>
            </Stack>
          </Paper>

          <Alert color="orange" icon={<IconAlertTriangle size={18} />}>
            <Stack gap={4}>
              <Text size="sm">
                {t(
                  "A stylesheet can hide anything, including this page. If that happens, open any address with",
                )}{" "}
                <Code>?nocustomcss=1</Code>{" "}
                {t("— the stylesheet is skipped and you can fix it.")}
              </Text>
              <Text size="sm">
                {t(
                  "The login page always uses the shipped look: the setting is per workspace and is only known after signing in.",
                )}
              </Text>
            </Stack>
          </Alert>
        </Stack>
      )}
    </>
  );
}
