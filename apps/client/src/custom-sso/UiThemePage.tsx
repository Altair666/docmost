import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  Radio,
  Stack,
  Text,
} from "@mantine/core";
import { IconAlertTriangle, IconCheck } from "@tabler/icons-react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import SettingsTitle from "@/components/settings/settings-title";
import { getAppName } from "@/lib/config";
import api from "@/lib/api-client";
import useUserRole from "@/hooks/use-user-role";
import { applyUiTheme, UiTheme } from "@/custom-sso/ui-theme";

function unwrap<T>(res: any): T {
  return (res?.data ?? res) as T;
}

export default function UiThemePage() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();

  const [theme, setTheme] = useState<UiTheme>("stock");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/ui-theme")
      .then((res) => setTheme(unwrap<{ theme: UiTheme }>(res).theme))
      .catch((e) => setError(e?.message ?? "request failed"))
      .finally(() => setLoading(false));
  }, []);

  if (!isAdmin) {
    return null;
  }

  const save = (next: UiTheme) => {
    setSaving(true);
    setError(null);
    setSaved(false);
    api
      .post("/ui-theme", { theme: next })
      .then((res) => {
        const value = unwrap<{ theme: UiTheme }>(res).theme;
        setTheme(value);
        // применяем сразу, не дожидаясь перезагрузки
        applyUiTheme(value);
        setSaved(true);
      })
      .catch((e) =>
        setError(e?.response?.data?.message ?? e?.message ?? "save failed"),
      )
      .finally(() => setSaving(false));
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
          "Choose how the interface looks. The choice applies to everyone in the workspace, so only administrators can change it.",
        )}
      </Text>

      {error && (
        <Alert color="red" icon={<IconAlertTriangle size={18} />} mb="md">
          {error}
        </Alert>
      )}

      {saved && (
        <Alert color="green" icon={<IconCheck size={18} />} mb="md">
          {t("Saved. Everyone sees the new look after a page reload.")}
        </Alert>
      )}

      {loading ? (
        <Loader size="sm" />
      ) : (
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
                    <Text fw={600} size="sm">
                      {t("Docmost, as shipped")}
                    </Text>
                    {theme === "stock" && (
                      <Badge size="xs" variant="light" color="gray">
                        {t("current")}
                      </Badge>
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
                    <Text fw={600} size="sm">
                      {t("Grist style")}
                    </Text>
                    {theme === "grist" && (
                      <Badge size="xs" variant="light" color="green">
                        {t("current")}
                      </Badge>
                    )}
                  </Group>
                }
                description={t(
                  "Green accent, compact 13px type, flat borders and a dark selected item — colours and sizes taken from the Grist sources.",
                )}
              />
            </Paper>
          </Stack>
        </Radio.Group>
      )}

      <Text size="xs" c="dimmed" mt="lg">
        {t(
          "The login page always uses the shipped look: the choice is stored per workspace and is only known after signing in.",
        )}
      </Text>
    </>
  );
}
