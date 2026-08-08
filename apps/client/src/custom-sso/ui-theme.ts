import api from "@/lib/api-client";

export type UiTheme = "stock" | "grist" | "custom";

export interface UiThemeState {
  theme: UiTheme;
  customCss: string;
}

const ATTR = "data-ui-theme";
const STYLE_ID = "custom-ui-theme";

// Аварийный выход. Если вставить CSS, который прячет интерфейс, можно
// остаться без доступа к самой странице настроек. Открыв любой адрес с
// ?nocustomcss=1, оформление не применится и всё можно будет починить.
export function customCssDisabled(): boolean {
  try {
    return new URLSearchParams(window.location.search).has("nocustomcss");
  } catch {
    return false;
  }
}

// Встроенная тема живёт в grist-theme.css и висит на атрибуте.
// Свой CSS вставляется отдельным тегом <style>.
export function applyUiTheme(state: UiThemeState): void {
  const root = document.documentElement;
  const existing = document.getElementById(STYLE_ID);

  if (customCssDisabled()) {
    root.removeAttribute(ATTR);
    existing?.remove();
    return;
  }

  if (state.theme === "grist") {
    root.setAttribute(ATTR, "grist");
  } else {
    root.removeAttribute(ATTR);
  }

  if (state.theme === "custom" && state.customCss.trim().length > 0) {
    const style = existing ?? document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = state.customCss;
    if (!existing) document.head.appendChild(style);
  } else {
    existing?.remove();
  }
}

export async function loadUiTheme(): Promise<UiThemeState> {
  try {
    const res: any = await api.get("/ui-theme");
    const data = res?.data ?? res;
    const theme = data?.theme;
    return {
      theme: theme === "grist" || theme === "custom" ? theme : "stock",
      customCss: typeof data?.customCss === "string" ? data.customCss : "",
    };
  } catch {
    // не смогли спросить — показываем стоковый вид, это безопасный вариант
    return { theme: "stock", customCss: "" };
  }
}
