import api from "@/lib/api-client";
import { setUiFlags } from "@/custom-sso/ui-flags";

export type UiTheme = "stock" | "custom";

export interface UiThemeState {
  theme: UiTheme;
  customCss: string;
  hideEeItems: boolean;
}

const STYLE_ID = "custom-ui-theme";

// Оформление лежит в хранилище рядом с флагами и по той же причине:
// ответа сервера ждать нельзя, иначе первый кадр рисуется стоковым и
// потом дёргается. Расхождение живёт максимум один заход — ровно до
// ответа сервера.
const CACHE_KEY = "custom-ui-theme-cache";

function readCache(): UiThemeState | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.customCss !== "string") return null;
    return {
      theme: p.theme === "custom" ? "custom" : "stock",
      customCss: p.customCss,
      hideEeItems: p.hideEeItems !== false,
    };
  } catch {
    return null;
  }
}

function writeCache(state: UiThemeState): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(state));
  } catch {
    // приватный режим или переполненное хранилище: обойдёмся без кэша,
    // оформление просто появится после ответа сервера
  }
}

// Ставится до отрисовки, из прошлого захода. Без этого оформление
// всегда опаздывает на один кадр, а после входа — на целую загрузку.
export function applyCachedUiTheme(): void {
  const cached = readCache();
  if (cached) applyUiTheme(cached);
}

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

// null означает «не смогли спросить»: чаще всего это 401 на странице
// входа. Раньше здесь возвращался стоковый вид — неотличимо от честного
// ответа сервера, — и вызывающий затирал этим кэш и флаги. Из-за этого
// после входа всё оставалось стоковым до перезагрузки.
export async function loadUiTheme(): Promise<UiThemeState | null> {
  try {
    const res: any = await api.get("/ui-theme");
    const data = res?.data ?? res;
    const state: UiThemeState = {
      theme: data?.theme === "custom" ? "custom" : "stock",
      customCss: typeof data?.customCss === "string" ? data.customCss : "",
      hideEeItems: data?.hideEeItems !== false,
    };
    writeCache(state);
    return state;
  } catch {
    return null;
  }
}

// Спросить и применить. Нужна после входа: до него сервер отвечает 401,
// а переход на главную происходит внутри страницы, без новой загрузки,
// и другого случая спросить уже не будет.
export async function refreshUiTheme(): Promise<void> {
  const state = await loadUiTheme();
  if (!state) return;
  storeUiFlags(state);
  applyUiTheme(state);
}
