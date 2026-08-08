import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Code,
  FileInput,
  Group,
  Loader,
  Paper,
  Radio,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconCheck,
  IconDeviceFloppy,
  IconFileUpload,
  IconWand,
} from "@tabler/icons-react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title";
import { getAppName } from "@/lib/config";
import api from "@/lib/api-client";
import useUserRole from "@/hooks/use-user-role";
import { applyUiTheme, UiTheme, UiThemeState } from "@/custom-sso/ui-theme";
// исходник встроенной темы — чтобы её можно было загрузить в поле
// и править дальше, а не считать чёрным ящиком
import gristPreset from "@/custom-sso/grist-theme.css?raw";

function unwrap<T>(res: any): T {
  return (res?.data ?? res) as T;
}

export default function UiThemePage() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();

  const [theme, setTheme] = useState<UiTheme>("stock");
  const [css, setCss] = useState("");
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
      })
      .catch((e) => setError(e?.message ?? "request failed"))
      .finally(() => setLoading(false));
  }, []);

  if (!isAdmin) {
    return null;
  }

  const save = (nextTheme: UiTheme, nextCss?: string) => {
    setSaving(true);
    setError(null);
    setSaved(false);

    const payload: Record<string, unknown> = { theme: nextTheme };
    if (nextCss !== undefined) payload.customCss = nextCss;

    api
      .post("/ui-theme", payload)
      .then((res) => {
        const state = unwrap<UiThemeState>(res);
        setTheme(state.theme);
        setCss(state.customCss ?? "");
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
          <Radio.Group
            value={theme}
            onChange={(value) => save(value as UiTheme)}
            name="ui-theme"
          >
            <Stack gap="sm">
              <Paper withBorder p="md" radius="md">
                <Radio
                  value="stock"
                  disabled={saving}
                  label={
                    <Group gap="xs">
                      <Text fw={600} size="sm">{t("Docmost, as shipped")}</Text>
                      {theme === "stock" && (
                        <Badge size="xs" variant="light" color="gray">{t("current")}</Badge>
                      )}
                    </Group>
                  }
                  description={t("The original look, nothing overridden.")}
                />
              </Paper>

              <Paper withBorder p="md" radius="md">
                <Radio
                  value="grist"
                  disabled={saving}
                  label={
                    <Group gap="xs">
                      <Text fw={600} size="sm">{t("Grist style")}</Text>
                      {theme === "grist" && (
                        <Badge size="xs" variant="light" color="green">{t("current")}</Badge>
                      )}
                    </Group>
                  }
                  description={t(
                    "Built in. Colours and sizes taken from the Grist sources.",
                  )}
                />
              </Paper>

              <Paper withBorder p="md" radius="md">
                <Radio
                  value="custom"
                  disabled={saving}
                  label={
                    <Group gap="xs">
                      <Text fw={600} size="sm">{t("Your own CSS")}</Text>
                      {theme === "custom" && (
                        <Badge size="xs" variant="light" color="green">{t("current")}</Badge>
                      )}
                    </Group>
                  }
                  description={t(
                    "Paste or upload a stylesheet. Stored in the database, so a new look needs no rebuild.",
                  )}
                />
              </Paper>
            </Stack>
          </Radio.Group>

          <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
              <Group justify="space-between" align="flex-end">
                <Text fw={600} size="sm">{t("Stylesheet")}</Text>
                <Text size="xs" c="dimmed">
                  {css.length.toLocaleString()} {t("characters")}
                </Text>
              </Group>

              <Textarea
                autosize
                minRows={10}
                maxRows={24}
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
                  style={{ flex: 1, minWidth: 220 }}
                />
                <Button
                  variant="default"
                  leftSection={<IconWand size={16} />}
                  onClick={() => setCss(gristPreset)}
                >
                  {t("Load the Grist theme as a starting point")}
                </Button>
                <Button
                  loading={saving}
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={() => save("custom", css)}
                >
                  {t("Save and switch to it")}
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
