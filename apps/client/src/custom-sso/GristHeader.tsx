import React from "react";
import { ActionIcon, Badge, Group, Tooltip, UnstyledButton } from "@mantine/core";
import { Link, useLocation } from "react-router-dom";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { IconSparkles } from "@tabler/icons-react";

import classes from "@/components/layouts/global/app-header.module.css";
import TopMenu from "@/components/layouts/global/top-menu.tsx";
import SidebarToggle from "@/components/ui/sidebar-toggle-button.tsx";
import useToggleAside from "@/hooks/use-toggle-aside.tsx";
import APP_ROUTE from "@/lib/app-route.ts";
import { isCloud } from "@/lib/config.ts";
import useTrial from "@/ee/hooks/use-trial.tsx";
import {
  desktopSidebarAtom,
  mobileSidebarAtom,
} from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { useToggleSidebar } from "@/components/layouts/global/hooks/hooks/use-toggle-sidebar.ts";
import { NotificationPopover } from "@/features/notification/components/notification-popover.tsx";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import Breadcrumb from "@/features/page/components/breadcrumbs/breadcrumb.tsx";

import { rightPanelOpenAtom } from "@/custom-sso/right-panel-atom";
import GristSearch from "@/custom-sso/GristSearch";
import { IconGristPanel } from "@/custom-sso/GristIcons";

// Правая половина шапки: поиск, уведомления, кружок пользователя.
// Собрана из тех же деталей, что берёт шапка апстрима, но своим
// порядком — поиск у нас живёт строкой, а не отдельной модалкой.
function HeaderTools() {
  const { t } = useTranslation();
  const location = useLocation();
  const toggleAside = useToggleAside();
  const { isTrial, trialDaysLeft } = useTrial();
  const [workspace] = useAtom(workspaceAtom);

  const aiChatEnabled = workspace?.settings?.ai?.chat === true;
  const isPageRoute = location.pathname.includes("/p/");

  const openAiChat = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) {
      return;
    }
    if (isPageRoute) {
      e.preventDefault();
      toggleAside("chat");
    }
  };

  return (
    <>
      <GristSearch />

      <Group wrap="nowrap">
        {aiChatEnabled && (
          <>
            <UnstyledButton
              component={Link}
              to="/ai"
              className={classes.link}
              visibleFrom="sm"
              onClick={openAiChat}
            >
              {t("AI Chat")}
            </UnstyledButton>
            <Tooltip label={t("AI Chat")} openDelay={250} withArrow>
              <ActionIcon
                component={Link}
                to="/ai"
                variant="subtle"
                color="dark"
                size="sm"
                hiddenFrom="sm"
                aria-label={t("AI Chat")}
                onClick={openAiChat}
              >
                <IconSparkles size={20} stroke={2} />
              </ActionIcon>
            </Tooltip>
          </>
        )}
        <NotificationPopover />
        {isCloud() && isTrial && trialDaysLeft !== 0 && (
          <Badge
            variant="light"
            style={{ cursor: "pointer" }}
            component={Link}
            to={APP_ROUTE.SETTINGS.WORKSPACE.BILLING}
            visibleFrom="xs"
          >
            {trialDaysLeft === 1 ? "1 day left" : `${trialDaysLeft} days left`}
          </Badge>
        )}
        <TopMenu />
      </Group>
    </>
  );
}

// Наша шапка. Ссылки «Главная» нет: на главную ведёт плашка с названием
// фирмы, она живёт внутри самой панели слева — как у Grist. Кнопка
// сворачивания стоит сразу за вертикальной линией панели, в начале
// правой части, а не внутри сворачиваемой колонки.
export default function GristHeader() {
  const { t } = useTranslation();
  const location = useLocation();
  const isPageRoute = location.pathname.includes("/p/");
  const [rightOpen, setRightOpen] = useAtom(rightPanelOpenAtom);
  const [mobileOpened] = useAtom(mobileSidebarAtom);
  const toggleMobile = useToggleSidebar(mobileSidebarAtom);
  const [desktopOpened] = useAtom(desktopSidebarAtom);
  const toggleDesktop = useToggleSidebar(desktopSidebarAtom);

  return (
    <Group h="100%" gap={0} wrap={"nowrap"} align="stretch">
      <Group
        flex={1}
        pl={0}
        // На странице кнопка правой панели стоит вплотную к её черте —
        // так же, как левая к своей.
        pr={isPageRoute ? 0 : "md"}
        justify="space-between"
        wrap={"nowrap"}
        style={{ minWidth: 0 }}
      >
        <Group gap="xs" wrap="nowrap">
          {/* На узких экранах меню открывается этой кнопкой. */}
          <Tooltip label={t("Sidebar toggle")}>
            <SidebarToggle
              aria-label={t("Sidebar toggle")}
              opened={mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
            />
          </Tooltip>

          {/* Без всплывающей подписи: она загораживала угол и не нужна.
              Не SidebarToggle: тот рисует свои значки Tabler, а нам нужен
              контур Grist — стрелка, уходящая в полосу. 32x32 вплотную к
              вертикальной линии, прямые углы — размеры и место оттуда же.
              Зелёный в обоих положениях: проверено по пикселям значка
              Grist, 22,179,120. Само значение живёт в теме. */}
          <ActionIcon
            aria-label={t("Sidebar toggle")}
            data-sidebar-toggle=""
            aria-expanded={desktopOpened}
            onClick={toggleDesktop}
            visibleFrom="sm"
            variant="subtle"
            color="gray"
            c="var(--grist-primary, #16b378)"
            size={32}
          >
            <IconGristPanel size={16} mirrored={!desktopOpened} />
          </ActionIcon>

          {/* Крошки стоят здесь, сразу за стрелкой. В шапке страницы их
              больше нет — иначе дублировались бы. Только на самой
              странице: узел держит разобранный путь и сам его не
              сбрасывает, поэтому на главной оставались крошки прошлой. */}
          {isPageRoute && <Breadcrumb />}
        </Group>

        <Group gap="xs" wrap="nowrap">
          <HeaderTools />

          {/* Кнопка правой панели — такая же и на том же месте, что у
              левой: значок Grist вплотную к черте панели. */}
          {isPageRoute && (
            <ActionIcon
              aria-label={t("Commands")}
              data-right-toggle=""
              aria-expanded={rightOpen}
              onClick={() => setRightOpen(!rightOpen)}
              visibleFrom="sm"
              variant="subtle"
              color="gray"
              c="var(--grist-primary, #16b378)"
              size={32}
            >
              <IconGristPanel size={16} mirrored={rightOpen} />
            </ActionIcon>
          )}
        </Group>
      </Group>
    </Group>
  );
}
