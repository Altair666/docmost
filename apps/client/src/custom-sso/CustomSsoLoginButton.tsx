import { Button, Divider, Stack } from "@mantine/core";
import { IconShieldLock } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

// Независимая от apps/client/src/ee кнопка входа. Просто делает обычный
// браузерный редирект на наш собственный роут /api/auth/oidc/login —
// вся логика (обмен кода на токены, поиск/создание юзера) живёт на
// сервере в apps/server/src/custom-sso.
export default function CustomSsoLoginButton() {
  const { t } = useTranslation();

  function handleClick() {
    window.location.href = "/api/auth/oidc/login";
  }

  return (
    <Stack gap="sm" mb="md">
      <Button
        fullWidth
        variant="default"
        leftSection={<IconShieldLock size={18} />}
        onClick={handleClick}
      >
        {t("Sign in with Keycloak")}
      </Button>
      <Divider label={t("or")} labelPosition="center" />
    </Stack>
  );
}
