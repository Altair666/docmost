import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import classes from "./app-header.module.css";
import React from "react";
import TopMenu from "@/components/layouts/global/top-menu.tsx";
import { Link, useLocation } from "react-router-dom";
import { IconSparkles } from "@tabler/icons-react";
import useToggleAside from "@/hooks/use-toggle-aside.tsx";
import APP_ROUTE from "@/lib/app-route.ts";
import { useAtom } from "jotai";
import {
  desktopSidebarAtom,
  mobileSidebarAtom,
} from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { useToggleSidebar } from "@/components/layouts/global/hooks/hooks/use-toggle-sidebar.ts";
import SidebarToggle from "@/components/ui/sidebar-toggle-button.tsx";
import { useTranslation } from "react-i18next";
import useTrial from "@/ee/hooks/use-trial.tsx";
import { isCloud } from "@/lib/config.ts";
import {
  SearchControl,
  SearchMobileControl,
} from "@/features/search/components/search-control.tsx";
import {
  searchSpotlight,
  shareSearchSpotlight,
} from "@/features/search/constants.ts";
import { NotificationPopover } from "@/features/notification/components/notification-popover.tsx";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { sidebarWidthAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import WorkspaceBadge from "@/custom-sso/WorkspaceBadge";

const links = [
  { link: APP_ROUTE.HOME, label: "Home" },
];

export function AppHeader() {
  const { t } = useTranslation();
  const [mobileOpened] = useAtom(mobileSidebarAtom);
  const [sidebarWidth] = useAtom(sidebarWidthAtom);
  const toggleMobile = useToggleSidebar(mobileSidebarAtom);

  const [desktopOpened] = useAtom(desktopSidebarAtom);
  const toggleDesktop = useToggleSidebar(desktopSidebarAtom);
  const { isTrial, trialDaysLeft } = useTrial();
  const location = useLocation();
  const toggleAside = useToggleAside();
  const [workspace] = useAtom(workspaceAtom);
  const aiChatEnabled = workspace?.settings?.ai?.chat === true;

  const isPageRoute = location.pathname.includes("/p/");

  const items = links.map((link) => (
    <Link key={link.label} to={link.link} className={classes.link}>
      {t(link.label)}
    </Link>
  ));

  return (
    <>
      {/* Перекрестье: левая ячейка шапки шириной ровно с сайдбар и с правой
          границей — так вертикальная линия идёт от самого верха, а не от
          нижнего края шапки. Ширина берётся из того же атома, что и у
          сайдбара, поэтому при перетаскивании граница едет вместе с ним.
          Когда сайдбар свёрнут, ячейка схлопывается. */}
      <Group h="100%" gap={0} wrap={"nowrap"} align="stretch">
        <Group
          gap="xs"
          px="sm"
          wrap="nowrap"
          w={desktopOpened ? sidebarWidth : undefined}
          style={{
            flex: "none",
            borderRight: desktopOpened
              ? "1px solid var(--app-shell-border-color)"
              : undefined,
          }}
        >
          <Tooltip label={t("Sidebar toggle")}>
            <SidebarToggle
              aria-label={t("Sidebar toggle")}
              opened={mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
            />
          </Tooltip>

          <Tooltip label={t("Sidebar toggle")}>
            <SidebarToggle
              aria-label={t("Sidebar toggle")}
              opened={desktopOpened}
              onClick={toggleDesktop}
              visibleFrom="sm"
              size="sm"
            />
          </Tooltip>

          {/* Название фирмы из настроек рабочего пространства.
              Заменило надпись «Docmost», которая тут была раньше. */}
          <Box visibleFrom="sm" style={{ minWidth: 0 }}>
            <WorkspaceBadge />
          </Box>

          {/* На узких экранах вместо плашки — иконка, ведущая на главную.
              hiddenFrom понимает Box, а не Link из react-router. */}
          <Box hiddenFrom="sm">
            <Link to="/home" className={classes.brand} aria-label="Docmost">
              <Box className={classes.brandIcon}>
                <img
                  src="/icons/favicon-32x32.png"
                  alt="Docmost"
                  width={22}
                  height={22}
                />
              </Box>
            </Link>
          </Box>
        </Group>

        <Group
          flex={1}
          px="md"
          justify="space-between"
          wrap={"nowrap"}
          style={{ minWidth: 0 }}
        >
          {/* Ссылка «Главная» убрана: на главную ведёт сама плашка с
              названием фирмы слева, как в Grist. Массив links оставлен —
              если понадобится вернуть пункты, менять только его. */}
          <Group gap={5} className={classes.links} visibleFrom="sm" wrap="nowrap" />

          <Group gap="xs" wrap="nowrap">
          <Group visibleFrom="sm">
            <SearchControl onClick={searchSpotlight.open} />
          </Group>
          <Group hiddenFrom="sm">
            <SearchMobileControl onSearch={searchSpotlight.open} />
          </Group>

        <Group wrap="nowrap">
          {aiChatEnabled && (
            <>
              <UnstyledButton
                component={Link}
                to="/ai"
                className={classes.link}
                visibleFrom="sm"
                onClick={(e: React.MouseEvent) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) {
                    return;
                  }
                  if (isPageRoute) {
                    e.preventDefault();
                    toggleAside("chat");
                  }
                }}
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
                  onClick={(e: React.MouseEvent) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) {
                      return;
                    }
                    if (isPageRoute) {
                      e.preventDefault();
                      toggleAside("chat");
                    }
                  }}
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
              {trialDaysLeft === 1
                ? "1 day left"
                : `${trialDaysLeft} days left`}
            </Badge>
          )}
          <TopMenu />
          </Group>
          </Group>
        </Group>
      </Group>
    </>
  );
}
