import api from "@/lib/api-client";
import { setUiFlags } from "@/custom-sso/ui-flags";

export type UiTheme = "stock" | "custom";

export interface UiThemeState {
  theme: UiTheme;
  customCss: string;
  hideEeItems: boolean;
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

// Переключатели вида нужны компонентам синхронно, при первом же кадре,
// поэтому раскладываем их в ui-flags сразу, как только узнали.
// «Наш интерфейс» — это тот же выбор, что и своя тема: оформление и
// доработки шапки с меню включаются вместе, порознь они выглядят
// несобранно.
export function storeUiFlags(state: UiThemeState): void {
  setUiFlags({
    customUi: state.theme === "custom" && !customCssDisabled(),
    hideEeItems: state.hideEeItems,
  });
}

export async function loadUiTheme(): Promise<UiThemeState> {
  try {
    const res: any = await api.get("/ui-theme");
    const data = res?.data ?? res;
    return {
      theme: data?.theme === "custom" ? "custom" : "stock",
      customCss: typeof data?.customCss === "string" ? data.customCss : "",
      hideEeItems: data?.hideEeItems !== false,
    };
  } catch {
    // не смогли спросить — показываем стоковый вид, это безопасный вариант
    return { theme: "stock", customCss: "", hideEeItems: true };
  }
}
