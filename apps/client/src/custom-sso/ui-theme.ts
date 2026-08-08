import api from "@/lib/api-client";

export type UiTheme = "stock" | "custom";

export interface UiThemeState {
  theme: UiTheme;
  customCss: string;
}

const STYLE_ID = "custom-ui-theme";

// Аварийный выход. Свой CSS может спрятать что угодно, включая саму
// страницу настроек. Открыв любой адрес с ?nocustomcss=1, оформление
// не применится и всё можно будет починить.
export function customCssDisabled(): boolean {
  try {
    return new URLSearchParams(window.location.search).has("nocustomcss");
  } catch {
    return false;
  }
}

// Оформление — это ровно один тег <style> с текстом из настроек.
// Никаких вшитых тем: файл со стилем даётся отдельно и загружается
// администратором, поэтому новая тема не требует пересборки.
export function applyUiTheme(state: UiThemeState): void {
  const existing = document.getElementById(STYLE_ID);

  const shouldApply =
    !customCssDisabled() &&
    state.theme === "custom" &&
    state.customCss.trim().length > 0;

  if (!shouldApply) {
    existing?.remove();
    return;
  }

  const style = existing ?? document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = state.customCss;
  if (!existing) document.head.appendChild(style);
}

export async function loadUiTheme(): Promise<UiThemeState> {
  try {
    const res: any = await api.get("/ui-theme");
    const data = res?.data ?? res;
    return {
      theme: data?.theme === "custom" ? "custom" : "stock",
      customCss: typeof data?.customCss === "string" ? data.customCss : "",
    };
  } catch {
    // не смогли спросить — показываем стоковый вид, это безопасный вариант
    return { theme: "stock", customCss: "" };
  }
}
