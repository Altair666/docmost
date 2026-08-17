import { LoginForm } from "@/features/auth/components/login-form";
import SsoGate from "@/custom-sso/SsoGate";
import { Helmet } from "react-helmet-async";
import { getAppName } from "@/lib/config.ts";
import { useTranslation } from "react-i18next";

export default function LoginPage() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>
          {t("Login")} - {getAppName()}
        </title>
      </Helmet>
      {/* Отправляет на Keycloak сразу, если так настроено;
          иначе просто рисует форму. Вход по паролю — /auth. */}
      <SsoGate>
        <LoginForm />
      </SsoGate>
    </>
  );
}
