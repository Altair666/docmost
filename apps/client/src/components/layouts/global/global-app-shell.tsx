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
  useSidebarCollapsed,
  GRIST_SIDEBAR_MIN,
  GRIST_SIDEBAR_MAX,
} from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { SpaceSidebar } from "@/features/space/components/sidebar/space-sidebar.tsx";
import AiChatSidebar from "@/ee/ai-chat/components/ai-chat-sidebar.tsx";
import { AppHeader } from "@/components/layouts/global/app-header.tsx";
import Aside from "@/components/layouts/global/aside.tsx";
import GristRightPanel from "@/custom-sso/GristRightPanel";
import {
  rightPanelOpenAtom,
  rightPanelWidthAtom,
  RIGHT_PANEL_MIN,
  RIGHT_PANEL_MAX,
} from "@/custom-sso/right-panel-atom";
import classes from "./app-shell.module.css";
import { useTrialEndAction } from "@/ee/hooks/use-trial-end-action.tsx";
import { useToggleSidebar } from "@/components/layouts/global/hooks/hooks/use-toggle-sidebar.ts";
import GlobalSidebar from "@/components/layouts/global/global-sidebar.tsx";
import { ASIDE_PANEL_ID } from "@/hooks/use-toggle-aside.tsx";
import { MAIN_CONTENT_ID, SkipToMain } from "@/components/ui/skip-to-main.tsx";

// Шапка левой панели: плашка с логотипом и названием фирмы.
// Живёт внутри панели, как у Grist, а не в шапке приложения.
function SidebarHeader() {
  // Признак «свёрнуто» плашка узнаёт сама: разметка одна на оба вида, и
  // навязанный сверху признак перебивал её собственный.
  const collapsed = useSidebarCollapsed();

  return (
    <div
      data-sidebar-header=""
      style={{
        display: "flex",
        alignItems: "center",
        height: 49,
        flex: "none",
        padding: collapsed ? "0 8px" : "0 16px",
      }}
    >
      <WorkspaceBadge />
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
  const [rightOpen] = useAtom(rightPanelOpenAtom);
  const [rightWidth, setRightWidth] = useAtom(rightPanelWidthAtom);
  // Правая панель повторяет левую: свёрнута — полоса, наведение —
  // временный выезд, черта у левого края — растягивание.
  const [rightHovered, setRightHovered] = useState(false);
  const [isRightResizing, setIsRightResizing] = useState(false);
  const rightRef = useRef<HTMLElement>(null);
  // Вызванная вкладка раскрывает панель наравне со своим признаком
  const rightCollapsed = !rightOpen && !isAsideOpen;
  const [, setSidebarWidth] = useAtom(sidebarWidthAtom);
  const [, setSidebarWidthTouched] = useAtom(sidebarWidthTouchedAtom);
  const sidebarWidth = useSidebarWidth();
  const [isResizing, setIsResizing] = useState(false);
  // Курсор на свёрнутой полосе — панель временно выезжает поверх страницы.
  // Атом общий: шапке нужно то же значение, чтобы ехать вместе с панелью.
  const [railHovered, setRailHovered] = useAtom(railHoveredAtom);
  const sidebarRef = useRef(null);
  // Содержимое панели: по его собственной ширине определяется, до каких
  // пор панель вообще можно сузить
  const contentRef = useRef<HTMLDivElement>(null);
  // Минимальная ширина, посчитанная браузером по содержимому
  const minWidthRef = useRef(GRIST_SIDEBAR_MIN);

  const startResizing = React.useCallback((mouseDownEvent) => {
    mouseDownEvent.preventDefault();

    // Спрашиваем браузер, сколько места просит содержимое: на миг ставим
    // ширину min-content и читаем результат. Никаких чисел в коде — что
    // бы ни лежало в меню и на каком бы языке, предел получится верный.
    const el = contentRef.current;
    if (el) {
      const prev = el.style.width;
      el.style.width = "min-content";
      minWidthRef.current = Math.max(GRIST_SIDEBAR_MIN, el.offsetWidth);
      el.style.width = prev;
    }

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
        const need = minWidthRef.current;
        if (newWidth < need) {
          setSidebarWidth(need);
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

  // Растягивание правой панели: ширина считается от правого края окна,
  // потому что черта у неё слева, а не справа.
  const startRightResizing = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsRightResizing(true);
  }, []);

  const stopRightResizing = React.useCallback(() => {
    setIsRightResizing(false);
  }, []);

  const resizeRight = React.useCallback(
    (e: MouseEvent) => {
      if (!isRightResizing) return;
      const w = window.innerWidth - e.clientX;
      if (w < RIGHT_PANEL_MIN) return setRightWidth(RIGHT_PANEL_MIN);
      if (w > RIGHT_PANEL_MAX) return setRightWidth(RIGHT_PANEL_MAX);
      setRightWidth(w);
    },
    [isRightResizing],
  );

  useEffect(() => {
    window.addEventListener("mousemove", resizeRight);
    window.addEventListener("mouseup", stopRightResizing);
    return () => {
      window.removeEventListener("mousemove", resizeRight);
      window.removeEventListener("mouseup", stopRightResizing);
    };
  }, [resizeRight, stopRightResizing]);

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

  // Ширина могла остаться с прошлых заходов и не влезать в нынешние
  // пределы. Проверяем один раз при загрузке — иначе панель выглядит
  // сломанной до первого движения черты, которое этот предел применяет.
  useEffect(() => {
    if (!customUi) return;

    const el = contentRef.current;
    if (!el) return;

    const prev = el.style.width;
    el.style.width = "min-content";
    const min = Math.max(GRIST_SIDEBAR_MIN, el.offsetWidth);
    el.style.width = prev;

    minWidthRef.current = min;

    const fixed = Math.min(Math.max(sidebarWidth, min), GRIST_SIDEBAR_MAX);
    if (fixed !== sidebarWidth) setSidebarWidth(fixed);
    // один раз при загрузке: дальше ширину держит перетаскивание
  }, [customUi]);

  const location = useLocation();
  const isSettingsRoute = location.pathname.startsWith("/settings");
  const isSpaceRoute = location.pathname.startsWith("/s/");
  const isAiRoute = location.pathname.startsWith("/ai");
  const isPageRoute = location.pathname.includes("/p/");
  const showGlobalSidebar = !isSpaceRoute && !isSettingsRoute && !isAiRoute;

  const collapsed = customUi && !desktopOpened;

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
      // 0.4s — время перехода панели у Grist. Задаём его самому AppShell,
      // чтобы шапка и содержимое ехали ровно с ней: иначе между ними на
      // время перехода открывается полоса фона.
      transitionDuration={customUi ? 400 : undefined}
      transitionTimingFunction="ease"
      navbar={{
        // Ширина тянется мышью везде, а не только в пространствах:
        // раньше на главной и в настройках она была жёстко 300px.
        //
        // Свёрнутая панель не исчезает, а сжимается до узкой полосы со
        // значками — как в Grist. Поэтому desktop: false: пусть Mantine
        // не прячет панель, шириной управляем сами. На мобильных всё
        // по-прежнему скрывается полностью, полоса там только мешала бы.
        // В свёрнутом виде страница отступает на ширину полосы; выезд по
        // наведению меняет только саму панель (она поверх), поэтому
        // содержимое страницы при этом не едет.
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
          // В нашем виде панель не исчезает, а сжимается до полосы —
          // так же, как левая.
          width: customUi
            ? rightOpen || isAsideOpen
              ? rightWidth
              : COMPACT_RAIL_WIDTH
            : 350,
          breakpoint: "sm",
          collapsed: customUi
            ? { mobile: !rightOpen, desktop: false }
            : { mobile: !isAsideOpen, desktop: !isAsideOpen },
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
        // Свёрнутый вид и временный выезд по наведению — метками, а не
        // подменой разметки.
        data-collapsed={collapsed && !railHovered ? "" : undefined}
        data-hover-open={collapsed && railHovered ? "" : undefined}
        // Выезжает на ту ширину, что выставлена вертикальной чертой,
        // а не на заранее прописанную
        style={
          collapsed && railHovered
            ? ({ "--sidebar-open-width": sidebarWidth + "px" } as any)
            : undefined
        }
        onMouseEnter={collapsed ? () => setRailHovered(true) : undefined}
        onMouseLeave={collapsed ? () => setRailHovered(false) : undefined}
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
        {/* Разметка одна на оба состояния, как у Grist: свёрнутый вид —
            это метка на панели, по которой тема прячет подписи. Подмена
            компонента давала мерцание, сползание значков и «шторку». */}
        {/* Обёртка, подрезающая содержимое: пока панель едет, оно не должно
            торчать поверх страницы. У Grist это cssOverflowContainer. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            flex: "1 1 0px",
            minHeight: 0,
          }}
        >
          <SidebarHeader />

        {/* Тянуть можно только развёрнутую панель. В свёрнутой полосы нет
            даже когда она временно выехала по наведению: менять там
            нечего, а край хватался и подсвечивался. */}
        {!collapsed && (
          <div
            className={classes.resizeHandle}
            data-resize-handle=""
            onMouseDown={startResizing}
          />
        )}

        {/* Ширина содержимого — целевая, а не всегда развёрнутая: иначе в
            свёрнутом виде пункты шире панели и лезут за край. Grist на
            время перехода ставит ровно её же. */}
        <div
          ref={contentRef}
          data-sidebar-content=""
          style={{
            width: collapsed && !railHovered ? COMPACT_RAIL_WIDTH : sidebarWidth,
            flex: "1 1 auto",
            minHeight: 0,
          }}
        >
          {isSpaceRoute && <SpaceSidebar />}
          {isSettingsRoute && <SettingsSidebar />}
          {isAiRoute && <AiChatSidebar />}
          {showGlobalSidebar && <GlobalSidebar />}
        </div>
        </div>
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
          ref={customUi ? (rightRef as any) : undefined}
          data-dragging={isRightResizing || undefined}
          data-collapsed={
            customUi && rightCollapsed && !rightHovered ? "" : undefined
          }
          data-hover-open={
            customUi && rightCollapsed && rightHovered ? "" : undefined
          }
          style={
            customUi && rightCollapsed && rightHovered
              ? ({ "--right-panel-open-width": rightWidth + "px" } as any)
              : undefined
          }
          onMouseEnter={
            customUi && rightCollapsed ? () => setRightHovered(true) : undefined
          }
          onMouseLeave={
            customUi && rightCollapsed ? () => setRightHovered(false) : undefined
          }
          p={customUi ? 0 : "md"}
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
          {customUi ? (
            /* Обёртка подрезает содержимое, пока панель едет, — как слева.
               Внутри либо вызванная вкладка, либо команды. */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                height: "100%",
                minHeight: 0,
                // Опора для черты растягивания: у самой панели position
                // трогать нельзя — Mantine держит её у правого края
                position: "relative",
              }}
            >
              {/* Тянуть можно только развёрнутую: в полосе менять нечего */}
              {!rightCollapsed && (
                <div
                  data-right-resize-handle=""
                  onMouseDown={startRightResizing}
                />
              )}

              {/* Ширина содержимого — целевая, иначе в свёрнутом виде
                  строки шире панели и лезут за край */}
              <div
                data-right-panel-content=""
                style={{
                  width:
                    rightCollapsed && !rightHovered
                      ? COMPACT_RAIL_WIDTH
                      : rightWidth,
                  // Вкладка занимает панель целиком
                  height: "100%",
                  flex: "1 1 auto",
                  minHeight: 0,
                }}
              >
                <GristRightPanel />
              </div>
            </div>
          ) : (
            <Aside />
          )}
        </AppShell.Aside>
      )}
    </AppShell>
    </>
  );
}
