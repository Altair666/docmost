import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

import { LoginForm } from "@/features/auth/components/login-form";
import { getAppName } from "@/lib/config.ts";

/**
 * Вход по паролю — /auth.
 *
 * Та же форма, что на /login, но мимо проверки SsoGate: когда включена
 * отправка сразу на Keycloak, обычный адрес входа форму уже не
 * показывает. Этот адрес нужен администратору, чтобы попасть внутрь и
 * настроить сам Keycloak — в том числе если Keycloak лежит.
 */
export default function LocalLoginPage() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>
          {t("Login")} - {getAppName()}
        </title>
      </Helmet>
      <LoginForm />
    </>
  );
}
