// Что о входе известно тому, кто ещё не вошёл: есть ли вход через
// Keycloak и надо ли отправлять на него сразу, минуя страницу входа.
//
// Нарочно обычным fetch, а не общим клиентом api: у того перехватчик
// на 401 сам уводит на страницу входа, а мы как раз на ней и стоим —
// получился бы круг.

export interface SsoPublicState {
  configured: boolean;
  autoRedirect: boolean;
}

const НЕТ: SsoPublicState = { configured: false, autoRedirect: false };

export async function fetchSsoPublicState(): Promise<SsoPublicState> {
  try {
    const res = await fetch("/api/auth/oidc/public", {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (!res.ok) return НЕТ;

    // глобальный перехватчик сервера заворачивает ответ в { data: ... }
    const body = await res.json();
    const data = body?.data ?? body;

    return {
      configured: data?.configured === true,
      autoRedirect: data?.autoRedirect === true,
    };
  } catch {
    // сервер не ответил — показываем обычную страницу входа: она
    // работает и без Keycloak
    return НЕТ;
  }
}
