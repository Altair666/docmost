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
import { useSidebarWidth } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import WorkspaceBadge from "@/custom-sso/WorkspaceBadge";
import { COMPACT_RAIL_WIDTH } from "@/custom-sso/CompactRail";
import { useUiFlags } from "@/custom-sso/ui-flags";
import GristSearch from "@/custom-sso/GristSearch";
import { IconGristPanel } from "@/custom-sso/GristIcons";

const links = [{ link: APP_ROUTE.HOME, label: "Home" }];

// Правая половина шапки одинакова в обоих видах: поиск, уведомления,
// кружок пользователя. Вынесена отдельно, чтобы стоковая и наша разметка
// не расходились, когда сюда что-то добавят при обновлении Docmost.
function HeaderTools() {
  const { t } = useTranslation();
  // В нашем виде поиск живёт строкой в шапке, а не отдельной модалкой.
  const { customUi } = useUiFlags();
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
      {customUi ? (
        <GristSearch />
      ) : (
        <>
          <Group visibleFrom="sm">
            <SearchControl onClick={searchSpotlight.open} />
          </Group>
          <Group hiddenFrom="sm">
            <SearchMobileControl onSearch={searchSpotlight.open} />
          </Group>
        </>
      )}

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

// Шапка Docmost, какой она приходит из апстрима. Показывается, когда наш
// интерфейс выключен в «Оформлении».
function StockHeader() {
  const { t } = useTranslation();
  const [mobileOpened] = useAtom(mobileSidebarAtom);
  const toggleMobile = useToggleSidebar(mobileSidebarAtom);
  const [desktopOpened] = useAtom(desktopSidebarAtom);
  const toggleDesktop = useToggleSidebar(desktopSidebarAtom);

  const items = links.map((link) => (
    <Link key={link.label} to={link.link} className={classes.link}>
      {t(link.label)}
    </Link>
  ));

  return (
    <Group h="100%" px="md" justify="space-between" wrap={"nowrap"}>
      <Group wrap="nowrap">
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

        <Link to="/home" className={classes.brand} aria-label="Docmost">
          <Box hiddenFrom="sm" className={classes.brandIcon}>
            <img
              src="/icons/favicon-32x32.png"
              alt="Docmost"
              width={22}
              height={22}
            />
          </Box>
          <Text size="lg" fw={600} style={{ userSelect: "none" }} visibleFrom="sm">
            Docmost
          </Text>
        </Link>

        <Group ml={50} gap={5} className={classes.links} visibleFrom="sm">
          {items}
        </Group>
      </Group>

      <Group px={"xl"} wrap="nowrap">
        <HeaderTools />
      </Group>
    </Group>
  );
}

// Наша шапка: слева ячейка ровно по ширине сайдбара с плашкой фирмы,
// сразу за вертикальной линией — кнопка сворачивания. Как в Grist.
function CustomHeader() {
  const { t } = useTranslation();
  const [mobileOpened] = useAtom(mobileSidebarAtom);
  const toggleMobile = useToggleSidebar(mobileSidebarAtom);
  const [desktopOpened] = useAtom(desktopSidebarAtom);
  const toggleDesktop = useToggleSidebar(desktopSidebarAtom);
  const sidebarWidth = useSidebarWidth();

  return (
    <Group h="100%" gap={0} wrap={"nowrap"} align="stretch">
      {/* Перекрестье: левая ячейка шапки шириной ровно с сайдбар и с правой
          границей — так вертикальная линия идёт от самого верха, а не от
          нижнего края шапки. Ширина берётся из того же атома, что и у
          сайдбара, поэтому при перетаскивании граница едет вместе с ним.
          Когда сайдбар свёрнут, ячейка сжимается до ширины полосы. */}
      <Group
        gap="xs"
        // 16px по краям развёрнутой ячейки и 8px свёрнутой — так плашка
        // встаёт в те же координаты, что у Grist (x=16..224 и x=8..40).
        px={desktopOpened ? 16 : 8}
        justify={desktopOpened ? undefined : "center"}
        wrap="nowrap"
        w={desktopOpened ? sidebarWidth : COMPACT_RAIL_WIDTH}
        // Метка для темы: цвет этой ячейки задаётся в CSS вместе с
        // цветом сайдбара, чтобы серая колонка читалась сплошной.
        data-brand-cell="true"
        style={{
          flex: "none",
          borderRight: "1px solid var(--app-shell-border-color)",
          overflow: "hidden",
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

        {/* Название фирмы из настроек рабочего пространства. Заменило
            надпись «Docmost». В свёрнутом виде остаётся только иконка —
            она так же кликабельна и ведёт на главную. */}
        <Box
          visibleFrom="sm"
          style={{ minWidth: 0, flex: desktopOpened ? 1 : "none" }}
        >
          <WorkspaceBadge compact={!desktopOpened} />
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
        pl={0}
        pr="md"
        justify="space-between"
        wrap={"nowrap"}
        style={{ minWidth: 0 }}
      >
        {/* Ссылка «Главная» убрана: на главную ведёт сама плашка с
            названием фирмы слева, как в Grist.

            Кнопка сворачивания стоит здесь — сразу за вертикальной
            линией, в начале правой части. Так же она расположена в Grist:
            не внутри сворачиваемой панели и не в левой ячейке, где в
            свёрнутом виде остаётся только квадрат с иконкой. */}
        <Group gap="xs" wrap="nowrap">
          {/* Без всплывающей подписи: она загораживала угол и не нужна.
              Не SidebarToggle: тот рисует свои значки Tabler, а нам нужен
              контур Grist — стрелка, уходящая в полосу. 32x32 вплотную к
              вертикальной линии, прямые углы — размеры и место оттуда же. */}
            <ActionIcon
              aria-label={t("Sidebar toggle")}
              aria-expanded={desktopOpened}
              onClick={toggleDesktop}
              visibleFrom="sm"
              variant="subtle"
              color="gray"
              // Зелёный в обоих положениях — так у Grist, проверено по
              // пикселям значка: 22,179,120. Само значение живёт в теме.
              c="var(--grist-primary, #16b378)"
              size={32}
              radius={0}
            >
              <IconGristPanel size={16} mirrored={!desktopOpened} />
            </ActionIcon>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <HeaderTools />
        </Group>
      </Group>
    </Group>
  );
}

export function AppHeader() {
  // Выключен наш интерфейс — показываем шапку апстрима без изменений.
  const { customUi } = useUiFlags();
  return customUi ? <CustomHeader /> : <StockHeader />;
}
