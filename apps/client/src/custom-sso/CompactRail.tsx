import { Box, Modal, Stack, Tooltip, UnstyledButton } from "@mantine/core";
import {
  IconHome,
  IconPlus,
  IconSearch,
  IconSettings,
  IconUserPlus,
} from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { Link, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IconGristPin, IconGristStack } from "@/custom-sso/GristIcons";
import { WorkspaceInviteForm } from "@/features/workspace/components/members/components/workspace-invite-form";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";
import { useTreeMutation } from "@/features/page/tree/hooks/use-tree-mutation.ts";
import SpaceSettingsModal from "@/features/space/components/settings-modal.tsx";
import { searchSpotlight } from "@/features/search/constants";
import { getSpaceUrl } from "@/lib/config.ts";
import { useSettingsRailItems } from "@/components/settings/settings-sidebar.tsx";
import GristAddButton from "@/custom-sso/GristAddButton";

// Ширина свёрнутой панели. Её же использует левая ячейка шапки, чтобы
// вертикаль перекрестья не разъезжалась при сворачивании.
export const COMPACT_RAIL_WIDTH = 48;

// Свёрнутая панель. Раньше сайдбар при сворачивании исчезал целиком и
// добраться до разделов было нельзя, пока не развернёшь обратно.
// В Grist остаётся узкая полоса со значками — здесь то же самое.
//
// Набор значков зависит от страницы, как в Grist: там свёрнутая полоса
// показывает инструменты ОТКРЫТОГО документа, а не общее меню приложения.
// Поэтому в пространстве полоса повторяет меню пространства, в настройках —
// разделы настроек, и только на общих страницах — главное меню.
//
// Нижний блок («Пригласить людей» и «Настройки») одинаков везде: эти кнопки
// не должны пропадать при переходе между разделами.
//
// Кнопки разворачивания здесь нет: в Grist она стоит сразу за
// вертикальной линией, в начале правой части шапки — там же она и у нас.

// Общий вид пункта полосы. Размеры сняты из DOM Grist: полоса 48px,
// пункт — плашка ВО ВСЮ ширину полосы высотой 32px, без скруглений,
// значок 16px по центру.
function RailItem({
  label,
  icon: Icon,
  path,
  onClick,
  current,
}: {
  label: string;
  icon: any;
  path?: string;
  onClick?: () => void;
  current?: boolean;
}) {
  return (
    <Tooltip label={label} position="right" withArrow openDelay={200}>
      <UnstyledButton
        component={path ? Link : "button"}
        to={path}
        onClick={onClick}
        aria-label={label}
        data-rail="true"
        aria-current={current ? "page" : undefined}
        data-active={current || undefined}
        style={{
          width: COMPACT_RAIL_WIDTH,
          height: 32,
          borderRadius: 0,
          display: "grid",
          placeItems: "center",
          color: current ? "#fff" : "var(--mantine-color-text)",
          background: current ? "var(--mantine-color-dark-8)" : "transparent",
        }}
      >
        <Icon size={16} stroke={2} />
      </UnstyledButton>
    </Tooltip>
  );
}

// Главное меню — то же, что в развёрнутом виде на общих страницах.
function GlobalRailItems() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  return (
    <>
      <RailItem
        label={t("Home")}
        icon={IconHome}
        path="/home"
        current={pathname === "/home"}
      />
      <RailItem
        label={t("Spaces")}
        icon={IconGristStack}
        path="/spaces"
        current={pathname.startsWith("/spaces")}
      />
      <RailItem
        label={t("Favorites")}
        icon={IconGristPin}
        path="/favorites"
        current={pathname.startsWith("/favorites")}
      />
    </>
  );
}

// Меню пространства: те же четыре пункта, что в развёрнутом сайдбаре.
// «Новая страница» показывается только тем, кто может править страницы —
// проверка прав та же, что в SpaceSidebar.
function SpaceRailItems() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { spaceSlug } = useParams();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);
  const spaceAbility = useSpaceAbility(space?.membership?.permissions);
  const { handleCreate } = useTreeMutation(space?.id ?? "");
  const [settingsOpened, { open: openSettings, close: closeSettings }] =
    useDisclosure(false);

  if (!space) return null;

  const spaceUrl = getSpaceUrl(spaceSlug);
  const canManagePages = spaceAbility.can(
    SpaceCaslAction.Manage,
    SpaceCaslSubject.Page,
  );

  return (
    <>
      <RailItem
        label={t("Overview")}
        icon={IconHome}
        path={spaceUrl}
        current={pathname.toLowerCase() === spaceUrl}
      />
      <RailItem
        label={t("Search")}
        icon={IconSearch}
        onClick={searchSpotlight.open}
      />
      <RailItem
        label={t("Space settings")}
        icon={IconSettings}
        onClick={openSettings}
      />
      {canManagePages && (
        <RailItem
          label={t("New page")}
          icon={IconPlus}
          onClick={() => handleCreate(null)}
        />
      )}

      <SpaceSettingsModal
        opened={settingsOpened}
        onClose={closeSettings}
        spaceId={space.slug}
      />
    </>
  );
}

// Разделы настроек. Список берём из самого сайдбара настроек, чтобы он не
// разъехался с развёрнутым видом при добавлении новых страниц.
function SettingsRailItems() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const items = useSettingsRailItems();

  return (
    <>
      {items.map((item) => (
        <RailItem
          key={item.path}
          label={t(item.label)}
          icon={item.icon}
          path={item.path}
          current={pathname === item.path}
        />
      ))}
    </>
  );
}

export default function CompactRail() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const [inviteOpened, { open: openInvite, close: closeInvite }] =
    useDisclosure(false);

  const isSettings = pathname.startsWith("/settings");
  const isSpace = pathname.startsWith("/s/");

  return (
    <>
      <Stack
        h="100%"
        justify="space-between"
        align="center"
        py="xs"
        gap={2}
        style={{ width: COMPACT_RAIL_WIDTH }}
      >
        <Stack gap={0} align="center">
          {/* Кружок «создать» — там же, где он у Grist в свёрнутой полосе:
              над списком разделов. Показываем только на общих страницах,
              как и развёрнутую кнопку. */}
          {!isSettings && !isSpace && (
            <Box pb={22} pt={6}>
              <GristAddButton compact />
            </Box>
          )}

          {isSettings ? (
            <SettingsRailItems />
          ) : isSpace ? (
            <SpaceRailItems />
          ) : (
            <GlobalRailItems />
          )}
        </Stack>

        <Stack gap={0} align="center">
          <RailItem
            label={t("Invite People")}
            icon={IconUserPlus}
            onClick={openInvite}
          />
          <RailItem
            label={t("Settings")}
            icon={IconSettings}
            path="/settings/account/profile"
            current={isSettings}
          />
        </Stack>
      </Stack>

      <Modal
        size="550"
        opened={inviteOpened}
        onClose={closeInvite}
        title={t("Invite People")}
      >
        <WorkspaceInviteForm onClose={closeInvite} />
      </Modal>
    </>
  );
}
