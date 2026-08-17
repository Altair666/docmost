import { ReactNode, useEffect, useState } from "react";
import { Center, Loader, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { fetchSsoPublicState } from "./sso-public";

// Отметка о том, что мы только что отправили человека в Keycloak.
// Живёт в пределах вкладки: если он вернулся сюда сразу же, значит
// вход не состоялся, и второй раз отправлять его туда нельзя — это
// был бы бесконечный круг.
const ОТМЕТКА = "sso-auto-redirect-at";
const ОКНО_МС = 20000;

/**
 * Отправка на Keycloak сразу при заходе на сайт.
 *
 * Включается администратором на странице настроек Keycloak. Пока
 * выключено — ничего не происходит, страница входа остаётся прежней.
 *
 * Вход по паролю при включённой отправке доступен по /auth: он рисует
 * ту же форму, но мимо этой проверки.
 */
export default function SsoGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [решено, setРешено] = useState(false);
  const [уходим, setУходим] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Случаи, когда отправлять нельзя:
    //   logout=1 — человек только что вышел, и Keycloak по своей ещё
    //              живой сессии молча впустил бы его обратно;
    //   error    — вход через Keycloak уже сорвался;
    //   local=1  — попросили форму пароля явно.
    const мимо =
      params.get("logout") === "1" ||
      params.has("error") ||
      params.get("local") === "1";

    if (мимо) {
      setРешено(true);
      return;
    }

    let недавно = 0;
    try {
      недавно = Number(window.sessionStorage.getItem(ОТМЕТКА) || 0);
    } catch {
      // приватный режим — просто не будет защиты от круга
    }
    if (недавно && Date.now() - недавно < ОКНО_МС) {
      setРешено(true);
      return;
    }

    let живо = true;
    fetchSsoPublicState().then((s) => {
      if (!живо) return;
      if (!s.autoRedirect) {
        setРешено(true);
        return;
      }
      try {
        window.sessionStorage.setItem(ОТМЕТКА, String(Date.now()));
      } catch {
        // см. выше
      }
      setУходим(true);
      window.location.href = "/api/auth/oidc/login";
    });

    return () => {
      живо = false;
    };
  }, []);

  if (решено) return <>{children}</>;

  // Пока спрашиваем сервер — пусто с крутилкой. Показать форму и
  // отобрать её через мгновение было бы хуже: человек успел бы начать
  // печатать.
  return (
    <Center h="100vh">
      <Stack align="center" gap="xs">
        <Loader size="sm" />
        {уходим && <Text c="dimmed" size="sm">{t("Signing in with Keycloak")}</Text>}
      </Stack>
    </Center>
  );
}
