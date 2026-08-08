import api from "@/lib/api-client";

export type UiTheme = "stock" | "grist";

const ATTR = "data-ui-theme";

// Оформление живёт атрибутом на <html>. Вся наша тема в grist-theme.css
// написана под селектор [data-ui-theme="grist"], поэтому при stock она
// не срабатывает вообще — стоковый вид остаётся нетронутым.
export function applyUiTheme(theme: UiTheme): void {
  const root = document.documentElement;
  if (theme === "grist") {
    root.setAttribute(ATTR, "grist");
  } else {
    root.removeAttribute(ATTR);
  }
}

export async function loadUiTheme(): Promise<UiTheme> {
  try {
    const res: any = await api.get("/ui-theme");
    const theme = (res?.data ?? res)?.theme;
    return theme === "grist" ? "grist" : "stock";
  } catch {
    // не смогли спросить — показываем стоковый вид, это безопасный вариант
    return "stock";
  }
}
