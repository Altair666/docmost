import {
  Table,
  Text,
  Group,
  ActionIcon,
  Box,
  Space,
  Menu,
  Anchor,
  Tooltip,
  VisuallyHidden,
} from "@mantine/core";
import { IconDots, IconSettings, IconEye, IconEyeOff } from "@tabler/icons-react";
import StarButton from "@/features/favorite/components/star-button";
import {
  useWatchedSpaceIds,
  useWatchSpaceMutation,
  useUnwatchSpaceMutation,
} from "@/features/space/queries/space-watcher-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import CreatorCell from "@/custom-sso/CreatorCell";
import React, { useState } from "react";
import { useDisclosure } from "@mantine/hooks";
import { formatMemberCount } from "@/lib";
import { formattedDate } from "@/lib/time";
import { getSpaceUrl } from "@/lib/config";
import { prefetchSpace } from "@/features/space/queries/space-query";
import { SearchInput } from "@/components/common/search-input";
import Paginate from "@/components/common/paginate";
import NoTableResults from "@/components/common/no-table-results";
import SpaceSettingsModal from "@/features/space/components/settings-modal";
import classes from "./all-spaces-list.module.css";
import rowClasses from "@/components/ui/clickable-table-row.module.css";
import clsx from "clsx";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";
import { AutoTooltipText } from "@/components/ui/auto-tooltip-text.tsx";

function WatchButton({ spaceId, watchedIds, size = 16 }: { spaceId: string; watchedIds: Set<string>; size?: number }) {
  const { t } = useTranslation();
  const watchMutation = useWatchSpaceMutation();
  const unwatchMutation = useUnwatchSpaceMutation();
  const isWatching = watchedIds.has(spaceId);
  const isPending = watchMutation.isPending || unwatchMutation.isPending;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isWatching) {
      unwatchMutation.mutate(spaceId);
    } else {
      watchMutation.mutate(spaceId);
    }
  };

  const label = isWatching ? t("Stop watching space") : t("Watch space");

  return (
    <Tooltip label={label} openDelay={250} withArrow>
      <ActionIcon
        variant="subtle"
        color={isWatching ? "blue" : "gray"}
        aria-label={label}
        aria-pressed={isWatching}
        onClick={handleToggle}
        loading={isPending}
      >
        {isWatching ? (
          <IconEyeOff size={size} stroke={2} />
        ) : (
          <IconEye size={size} stroke={2} />
        )}
      </ActionIcon>
    </Tooltip>
  );
}

interface AllSpacesListProps {
  spaces: any[];
  // Выбор сортировки рисуется в шапке таблицы, справа от заголовков
  // колонок — так он стоит у Grist.
  sortControl?: React.ReactNode;
  onSearch: (query: string) => void;
  hasPrevPage?: boolean;
  hasNextPage?: boolean;
  onNext: () => void;
  onPrev: () => void;
}

export default function AllSpacesList({
  spaces,
  sortControl,
  onSearch,
  hasPrevPage,
  hasNextPage,
  onNext,
  onPrev,
}: AllSpacesListProps) {
  const { t } = useTranslation();
  const watchedIds = useWatchedSpaceIds();
  const [settingsOpened, { open: openSettings, close: closeSettings }] =
    useDisclosure(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);

  const handleOpenSettings = (spaceId: string) => {
    setSelectedSpaceId(spaceId);
    openSettings();
  };

  return (
    <Box>
      {/* Поиска здесь нет: он живёт в шапке приложения и ищет
          по всем пространствам сразу. Отбивка под ним ушла вместе с ним:
          зазор до таблицы задаёт заголовок страницы. */}
      <Table.ScrollContainer minWidth={500}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Caption>
            <VisuallyHidden>
              {t("List of spaces in this workspace")}
            </VisuallyHidden>
          </Table.Caption>
          <Table.Thead>
            <Table.Tr>
              {/* Доли колонок — из списка документов Grist: имя 50%,
                  второе поле 20% с потолком 200, дата 30% с потолком 250. */}
              <Table.Th style={{ width: "40%" }}>{t("Space")}</Table.Th>
              <Table.Th style={{ width: "20%", maxWidth: 200 }}>
                {t("Members")}
              </Table.Th>
              <Table.Th style={{ width: "20%", maxWidth: 240 }}>
                {t("Author")}
              </Table.Th>
              <Table.Th style={{ width: "20%", maxWidth: 250 }}>
                {t("Last edited")}
              </Table.Th>
              {/* Ширина по содержимому: полоса слева обрывается ровно за
                  24px до сортировки при любой длине подписи (column-gap
                  24px у cssHeader в Grist). */}
              <Table.Th
                data-sort-cell=""
                style={{
                  width: "1%",
                  whiteSpace: "nowrap",
                  textAlign: "right",
                  paddingLeft: 24,
                  paddingRight: 0,
                }}
              >
                <VisuallyHidden>{t("Action")}</VisuallyHidden>
                {sortControl}
              </Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {spaces.length > 0 ? (
              spaces.map((space) => (
                <Table.Tr key={space.id} className={rowClasses.row}>
                  <Table.Td>
                    <Anchor
                      size="sm"
                      underline="never"
                      style={{
                        cursor: "pointer",
                        color: "var(--mantine-color-text)",
                      }}
                      className={clsx(classes.spaceLink, rowClasses.link)}
                      component={Link}
                      to={getSpaceUrl(space.slug)}
                    >
                      <Group
                        gap="sm"
                        wrap="nowrap"
                        onMouseEnter={() => prefetchSpace(space.slug, space.id)}
                      >
                        <CustomAvatar
                          name={space.name}
                          avatarUrl={space.logo}
                          type={AvatarIconType.SPACE_ICON}
                          color="initials"
                          variant="filled"
                          size="md"
                        />
                        <div style={{ minWidth: 0, overflow: "hidden", maxWidth: 350 }}>
                          <AutoTooltipText fz="sm" fw={500} lineClamp={1}>
                            {space.name}
                          </AutoTooltipText>
                          {space.description && (
                            <Text fz="xs" c="dimmed" lineClamp={2}>
                              {space.description}
                            </Text>
                          )}
                        </div>
                      </Group>
                    </Anchor>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" style={{ whiteSpace: "nowrap" }}>
                      {formatMemberCount(space.memberCount, t)}
                    </Text>
                  </Table.Td>

                  {sortControl && (
                    <Table.Td>
                      <CreatorCell creator={(space as any).creator} />
                    </Table.Td>
                  )}

                  {/* Когда в пространстве последний раз меняли страницу —
                      колонка Last edited из списка документов Grist */}
                  <Table.Td>
                    <Text size="sm" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                      {space.lastEditedAt
                        ? formattedDate(new Date(space.lastEditedAt))
                        : "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-end" wrap="nowrap">
                      <StarButton type="space" spaceId={space.id} name={space.name} size={16} />
                      <WatchButton spaceId={space.id} watchedIds={watchedIds} size={16} />
                      <Menu position="bottom-end">
                        <Menu.Target>
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            aria-label={t("Space menu")}
                          >
                            <IconDots size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconSettings size={16} />}
                            onClick={() => handleOpenSettings(space.id)}
                          >
                            {t("Space settings")}
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            ) : (
              <NoTableResults colSpan={3} />
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {spaces.length > 0 && (
        <Paginate
          hasPrevPage={hasPrevPage}
          hasNextPage={hasNextPage}
          onNext={onNext}
          onPrev={onPrev}
        />
      )}

      {selectedSpaceId && (
        <SpaceSettingsModal
          spaceId={selectedSpaceId}
          opened={settingsOpened}
          onClose={closeSettings}
        />
      )}
    </Box>
  );
}
