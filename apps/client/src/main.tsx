import "@mantine/core/styles.css";
import "@mantine/spotlight/styles.css";
import "@mantine/notifications/styles.css";
import '@mantine/dates/styles.css';
import "@/styles/a11y-overrides.css";
import {
  applyCachedUiTheme,
  applyUiTheme,
  loadUiTheme,
  storeUiFlags,
} from "@/custom-sso/ui-theme";

import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { mantineCssResolver, theme } from "@/theme";
import { MantineProvider } from "@mantine/core";
import { BrowserRouter } from "react-router-dom";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import "./i18n";
import { PostHogProvider } from "posthog-js/react";
import {
  getPostHogHost,
  getPostHogKey,
  isCloud,
  isPostHogEnabled,
} from "@/lib/config.ts";
import posthog from "posthog-js";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

if (isCloud() && isPostHogEnabled) {
  posthog.init(getPostHogKey(), {
    api_host: getPostHogHost(),
    defaults: "2025-05-24",
    disable_session_recording: true,
    capture_pageleave: false,
  });
}

// Оформление общее для всех участников, поэтому спрашиваем сервер
// до отрисовки. Не смогли — остаётся стоковый вид.
// Оформление и переключатели вида приходят одним запросом. Флаги
// раскладываем сразу: разметка читает их синхронно при отрисовке,
// а до ответа берёт прошлые значения из localStorage.
// Анимации переходов — только со второго кадра. Иначе выставление ширины
// панели при монтировании само считается изменением и запускает переход,
// а до его конца нарисованное расходится с посчитанным.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.documentElement.setAttribute("data-app-ready", "");
  });
});

// Оформление из прошлого захода — до отрисовки. Иначе первый кадр
// всегда стоковый, а после входа таким остаётся весь заход.
applyCachedUiTheme();

void loadUiTheme().then((state) => {
  // null — сервер не ответил (обычно 401 на странице входа). Ставить
  // на этом стоковый вид нельзя: затрём то, что уже показали.
  if (!state) return;
  storeUiFlags(state);
  applyUiTheme(state);
});

const container = document.getElementById("root") as HTMLElement;
const root = (container as any).__reactRoot ??= ReactDOM.createRoot(container);

root.render(
  <BrowserRouter>
    <MantineProvider theme={theme} cssVariablesResolver={mantineCssResolver}>
      <ModalsProvider>
        <QueryClientProvider client={queryClient}>
          <Notifications position="bottom-center" limit={3} zIndex={10000} />
          <HelmetProvider>
            <PostHogProvider client={posthog}>
              <App />
            </PostHogProvider>
          </HelmetProvider>
        </QueryClientProvider>
      </ModalsProvider>
    </MantineProvider>
  </BrowserRouter>,
);
