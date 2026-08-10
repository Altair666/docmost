import { AppShell, Container } from "@mantine/core";
import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import CompactRail, {
  COMPACT_RAIL_WIDTH,
} from "@/custom-sso/CompactRail";
import { useUiFlags } from "@/custom-sso/ui-flags";
import WorkspaceBadge from "@/custom-sso/WorkspaceBadge";
import { useTranslation } from "react-i18next";
import SettingsSidebar from "@/components/settings/settings-sidebar.tsx";
import { useAtom } from "jotai";
import {
  asideStateAtom,
  desktopSidebarAtom,
  mobileSidebarAtom,
  sidebarWidthAtom,
  sidebarWidthTouchedAtom,
  railHoveredAtom,
  useSidebarWidth,
  GRIST_SIDEBAR_MIN,
  GRIST_SIDEBAR_MAX,
} from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { SpaceSidebar } from "@/features/space/components/sidebar/space-sidebar.tsx";
import AiChatSidebar from "@/ee/ai-chat/components/ai-chat-sidebar.tsx";
import { AppHeader } from "@/components/layouts/global/app-header.tsx";
import Aside from "@/components/layouts/global/aside.tsx";
import classes from "./app-shell.module.css";
import { useTrialEndAction } from "@/ee/hooks/use-trial-end-action.tsx";
import { useToggleSidebar } from "@/components/layouts/global/hooks/hooks/use-toggle-sidebar.ts";
import GlobalSidebar from "@/components/layouts/global/global-sidebar.tsx";
import { ASIDE_PANEL_ID } from "@/hooks/use-toggle-aside.tsx";
import { MAIN_CONTENT_ID, SkipToMain } from "@/components/ui/skip-to-main.tsx";

// Шапка левой панели: плашка с логотипом и названием фирмы.
// Живёт внутри панели, как у Grist, а не в шапке приложения.
function SidebarHeader({ compact = false }: { compact?: boolean }) {
  return (
    <div
      data-sidebar-header=""
      style={{
        display: "flex",
        alignItems: "center",
        height: 49,
        flex: "none",
        padding: compact ? "0 8px" : "0 16px",
      }}
    >
      <WorkspaceBadge compact={compact} />
    </div>
  );
}

export default function GlobalAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  useTrialEndAction();
  const [mobileOpened] = useAtom(mobileSidebarAtom);
  const toggleMobile = useToggleSidebar(mobileSidebarAtom);
  const [desktopOpened] = useAtom(desktopSidebarAtom);
  const [{ isAsideOpen, tab: asideTab }] = useAtom(asideStateAtom);
  const [, setSidebarWidth] = useAtom(sidebarWidthAtom);
  const [, setSidebarWidthTouched] = useAtom(sidebarWidthTouchedAtom);
  const sidebarWidth = useSidebarWidth();
  const [isResizing, setIsResizing] = useState(false);
  // Курсор на свёрнутой полосе — панель временно выезжает поверх страницы.
  // Атом общий: шапке нужно то же значение, чтобы ехать вместе с панелью.
  const [railHovered, setRailHovered] = useAtom(railHoveredAtom);
  const sidebarRef = useRef(null);

  const startResizing = React.useCallback((mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
    // С этого момента ширину задаёт пользователь, а не вид интерфейса
    setSidebarWidthTouched(true);
  }, []);

  const stopResizing = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = React.useCallback(
    (mouseMoveEvent) => {
      if (isResizing) {
        const newWidth =
          mouseMoveEvent.clientX -
          sidebarRef.current.getBoundingClientRect().left;
        if (newWidth < GRIST_SIDEBAR_MIN) {
          setSidebarWidth(GRIST_SIDEBAR_MIN);
          return;
        }
        if (newWidth > GRIST_SIDEBAR_MAX) {
          setSidebarWidth(GRIST_SIDEBAR_MAX);
          return;
        }
        setSidebarWidth(newWidth);
      }
    },
    [isResizing],
  );

  useEffect(() => {
    //https://codesandbox.io/p/sandbox/kz9de
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  // Выключен наш интерфейс — оболочка ведёт себя как у апстрима:
  // шапка 45px, свёрнутый сайдбар прячется целиком, узкой полосы нет.
  const { customUi } = useUiFlags();

  const location = useLocation();
  const isSettingsRoute = location.pathname.startsWith("/settings");
  const isSpaceRoute = location.pathname.startsWith("/s/");
  const isAiRoute = location.pathname.startsWith("/ai");
  const isPageRoute = location.pathname.includes("/p/");
  const showGlobalSidebar = !isSpaceRoute && !isSettingsRoute && !isAiRoute;

  // В настройках панель всегда развёрнута: сворачивать и тянуть её там
  // незачем — разделы одни и те же на всех подстраницах.
  const panelFixed = customUi && isSettingsRoute;
  const collapsed = customUi && !desktopOpened && !panelFixed;

  return (
    <>
      <SkipToMain />
      <AppShell
      // 49px — высота шапки Grist, снята из его DOM. У Docmost 45.
      header={{ height: customUi ? 49 : 45 }}
      // alt: панель идёт во всю высоту страницы, шапка начинается справа
      // от неё. Так собрана левая колонка у Grist — одним элементом, с
      // логотипом внутри. Собранная из двух кусков, она разъезжалась при
      // движении, а вертикальная линия упиралась в шапку.
      layout={customUi ? "alt" : "default"}
      navbar={{
        // Ширина тянется мышью везде, а не только в пространствах:
        // раньше на главной и в настройках она была жёстко 300px.
        //
        // Свёрнутая панель не исчезает, а сжимается до узкой полосы со
        // значками — как в Grist. Поэтому desktop: false: пусть Mantine
        // не прячет панель, шириной управляем сами. На мобильных всё
        // по-прежнему скрывается полностью, полоса там только мешала бы.
        width: collapsed ? COMPACT_RAIL_WIDTH : sidebarWidth,
        breakpoint: "sm",
        collapsed: {
          mobile: !mobileOpened,
          // В нашем виде панель не исчезает, а сжимается до полосы со
          // значками, поэтому прятать её Mantine не даём. В стоковом —
          // всё как в апстриме.
          desktop: customUi ? false : !desktopOpened,
        },
      }}
      aside={
        isPageRoute && {
          width: 350,
          breakpoint: "sm",
          collapsed: { mobile: !isAsideOpen, desktop: !isAsideOpen },
        }
      }
      padding="md"
    >
      {/* Без горизонтального отступа: иначе левая ячейка шапки съезжает
          на 16px и вертикаль перекрестья не совпадает с краем сайдбара.
          Отступы теперь задают сами группы внутри AppHeader. */}
      <AppShell.Header px={customUi ? 0 : undefined} className={classes.header}>
        <AppHeader />
      </AppShell.Header>
      <AppShell.Navbar
        className={classes.navbar}
        withBorder={false}
        // Пока тянут мышью, переход выключен — иначе каждое движение
        // запускает новую анимацию и панель ползёт с задержкой.
        data-dragging={isResizing || undefined}
        ref={sidebarRef}
        aria-label={
          isSpaceRoute
            ? t("Space navigation")
            : isSettingsRoute
              ? t("Settings navigation")
              : isAiRoute
                ? t("AI navigation")
                : t("Main navigation")
        }
      >
        {collapsed ? (
          <div
            onMouseEnter={() => setRailHovered(true)}
            onMouseLeave={() => setRailHovered(false)}
            style={{ height: "100%", position: "relative" }}
          >
            {/* Шапка панели — внутри неё самой, как у Grist.
                Пока панель выезжает, полосу прячем: иначе видно сразу две
                плашки, и наезд одной на другую читается как рябь. */}
            <div
              style={{
                height: "100%",
                visibility: railHovered ? "hidden" : "visible",
              }}
            >
              <SidebarHeader compact />
              <CompactRail />
            </div>

            {/* Наложение висит всегда и раскрывается по ширине — тем же
                свойством и временем, что ячейка шапки с плашкой. Иначе
                колонка выезжает двумя кусками вразнобой. */}
            <div
              data-rail-overlay=""
              data-open={railHovered || undefined}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: railHovered ? sidebarWidth : 0,
                height: "100%",
                overflow: "hidden",
              }}
            >
              {/* Постоянная ширина: содержимое не перестраивается по
                  дороге, значки и подписи стоят на месте и просто
                  выезжают из-под полосы. */}
              <div
                style={{
                  width: sidebarWidth,
                  height: "100%",
                  overflowY: "auto",
                }}
              >
                <SidebarHeader />
                {isSpaceRoute && <SpaceSidebar />}
                {isSettingsRoute && <SettingsSidebar />}
                {isAiRoute && <AiChatSidebar />}
                {showGlobalSidebar && <GlobalSidebar />}
              </div>
            </div>
          </div>
        ) : (
          <>
            {customUi && <SidebarHeader />}
            {/* Тянуть панель можно на любой странице — как в Grist.
                Кроме настроек: там ширина зафиксирована. */}
            {!panelFixed && (
              <div
                className={classes.resizeHandle}
                data-resize-handle=""
                onMouseDown={startResizing}
              />
            )}
            {/* Постоянная ширина: иначе при сворачивании содержимое
                перестраивается вслед за анимацией и текст прыгает.
                Grist на время перехода делает то же самое. */}
            <div style={{ width: sidebarWidth, flex: "1 1 auto", minHeight: 0 }}>
              {isSpaceRoute && <SpaceSidebar />}
              {isSettingsRoute && <SettingsSidebar />}
              {isAiRoute && <AiChatSidebar />}
              {showGlobalSidebar && <GlobalSidebar />}
            </div>
          </>
        )}
      </AppShell.Navbar>
      <AppShell.Main id={MAIN_CONTENT_ID} tabIndex={-1}>
        {isSettingsRoute ? (
          <Container size={900} pb={80}>
            {children}
          </Container>
        ) : (
          children
        )}
      </AppShell.Main>

      {isPageRoute && (
        <AppShell.Aside
          id={ASIDE_PANEL_ID}
          tabIndex={-1}
          className={classes.aside}
          p="md"
          withBorder={false}
          aria-label={
            asideTab === "comments"
              ? t("Comments")
              : asideTab === "toc"
                ? t("Table of contents")
                : asideTab === "chat"
                  ? t("AI Chat")
                  : asideTab === "details"
                    ? t("Details")
                    : undefined
          }
        >
          <Aside />
        </AppShell.Aside>
      )}
    </AppShell>
    </>
  );
}
