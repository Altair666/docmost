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
import Breadcrumb from "@/features/page/components/breadcrumbs/breadcrumb.tsx";
import { rightPanelOpenAtom } from "@/custom-sso/right-panel-atom";
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
import {
  railHoveredAtom,
  useSidebarWidth,
} from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
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
  const location = useLocation();
  const isPageRoute = location.pathname.includes("/p/");
  const [rightOpen, setRightOpen] = useAtom(rightPanelOpenAtom);
  const { t } = useTranslation();
  const [mobileOpened] = useAtom(mobileSidebarAtom);
  const toggleMobile = useToggleSidebar(mobileSidebarAtom);
  const [desktopOpened] = useAtom(desktopSidebarAtom);
  const toggleDesktop = useToggleSidebar(desktopSidebarAtom);
  const sidebarWidth = useSidebarWidth();
  // Панель выехала по наведению — ячейка с плашкой едет вместе с ней,
  // иначе выезжает только нижняя часть колонки.
  const [railHovered] = useAtom(railHoveredAtom);
  const wide = desktopOpened || railHovered;


  return (
    <Group h="100%" gap={0} wrap={"nowrap"} align="stretch">
      {/* Перекрестье: левая ячейка шапки шириной ровно с сайдбар и с правой
          границей — так вертикальная линия идёт от самого верха, а не от
          нижнего края шапки. Ширина берётся из того же атома, что и у
          сайдбара, поэтому при перетаскивании граница едет вместе с ним.
          Когда сайдбар свёрнут, ячейка сжимается до ширины полосы. */}
      {/* Левой ячейки больше нет: плашка с названием фирмы переехала
          внутрь самой панели, как это сделано у Grist. Пока она жила в
          шапке, колонка состояла из двух кусков и разъезжалась. */}
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
        {/* Ссылка «Главная» убрана: на главную ведёт сама плашка с
            названием фирмы слева, как в Grist.

            Кнопка сворачивания стоит здесь — сразу за вертикальной
            линией, в начале правой части. Так же она расположена в Grist:
            не внутри сворачиваемой панели и не в левой ячейке, где в
            свёрнутом виде остаётся только квадрат с иконкой. */}
        <Group gap="xs" wrap="nowrap">
          {/* На узких экранах меню открывается этой кнопкой: раньше она
              стояла в левой ячейке, которой больше нет. */}
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
              вертикальной линии, прямые углы — размеры и место оттуда же. */}
            <ActionIcon
              aria-label={t("Sidebar toggle")}
              data-sidebar-toggle=""
              aria-expanded={desktopOpened}
              onClick={toggleDesktop}
              visibleFrom="sm"
              variant="subtle"
              color="gray"
              // Зелёный в обоих положениях — так у Grist, проверено по
              // пикселям значка: 22,179,120. Само значение живёт в теме.
              c="var(--grist-primary, #16b378)"
              size={32}
            >
              <IconGristPanel size={16} mirrored={!desktopOpened} />
            </ActionIcon>

          {/* Крошки стоят здесь, сразу за стрелкой сворачивания. В шапке
              страницы их больше нет — иначе они дублировались бы.
              Только на самой странице: узел держит разобранный путь и
              сам его не сбрасывает, поэтому на главной оставались
              крошки прошлой страницы. */}
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

export function AppHeader() {
  // Выключен наш интерфейс — показываем шапку апстрима без изменений.
  const { customUi } = useUiFlags();
  return customUi ? <CustomHeader /> : <StockHeader />;
}
