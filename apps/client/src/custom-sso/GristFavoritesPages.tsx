import {
  Text,
  Group,
  UnstyledButton,
  Badge,
  Table,
  Button,
} from "@mantine/core";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IconStar } from "@tabler/icons-react";

import { buildPageUrl, getPageTitle } from "@/features/page/page.utils";
import { formattedDate } from "@/lib/time";
import { useFavoritesQuery } from "@/features/favorite/queries/favorite-query";
import { EmptyState } from "@/components/ui/empty-state";
import { getSpaceUrl } from "@/lib/config";
import { getInitialsColor } from "@/lib/get-initials-color";
import PageListSkeleton from "@/components/ui/page-list-skeleton";
import { PageListIcon } from "@/components/common/page-list-icon";
import rowClasses from "@/components/ui/clickable-table-row.module.css";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { AvatarIconType } from "@/features/attachments/types/attachment.types";

import CreatorCell from "@/custom-sso/CreatorCell";

interface Props {
  spaceId?: string;
}

// Вкладка «Закреплённые» на главной и в обзоре пространства. От списка
// апстрима отличается столбцом автора и закреплёнными пространствами:
// отдельной секции для них в меню больше нет.
export default function GristFavoritesPages({ spaceId }: Props) {
  const { t } = useTranslation();
  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    // Внутри пространства перечислять пространства незачем — там нужны
    // только страницы этого пространства.
  } = useFavoritesQuery(spaceId ? "page" : undefined, spaceId);

  const favorites = data?.pages.flatMap((p) => p.items) ?? [];

  if (isLoading) {
    return <PageListSkeleton />;
  }

  if (isError) {
    return <Text>{t("Failed to fetch starred pages")}</Text>;
  }

  return favorites.length > 0 ? (
    <>
      <Table.ScrollContainer minWidth={500}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Tbody>
            {favorites.map((fav) =>
              fav.page ? (
                <Table.Tr key={fav.id} className={rowClasses.row}>
                  <Table.Td>
                    <UnstyledButton
                      className={rowClasses.link}
                      component={Link}
                      to={buildPageUrl(
                        fav.space?.slug,
                        fav.page.slugId,
                        fav.page.title,
                      )}
                    >
                      <Group wrap="nowrap">
                        <PageListIcon
                          icon={fav.page.icon}
                          isBase={fav.page.isBase}
                        />
                        <Text fw={500} size="md" lineClamp={1}>
                          {getPageTitle(fav.page.title, fav.page.isBase, t)}
                        </Text>
                      </Group>
                    </UnstyledButton>
                  </Table.Td>
                  {!spaceId && (
                    <Table.Td>
                      {fav.space && (
                        <Badge
                          color={getInitialsColor(fav.space.name)}
                          variant="light"
                          component={Link}
                          to={getSpaceUrl(fav.space.slug)}
                          style={{ cursor: "pointer" }}
                        >
                          {fav.space.name}
                        </Badge>
                      )}
                    </Table.Td>
                  )}
                  <Table.Td>
                    <CreatorCell creator={fav.page?.creator} />
                  </Table.Td>
                  <Table.Td>
                    <Text
                      c="dimmed"
                      style={{ whiteSpace: "nowrap" }}
                      size="xs"
                      fw={500}
                    >
                      {formattedDate(new Date(fav.createdAt))}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : fav.space ? (
                <Table.Tr key={fav.id} className={rowClasses.row}>
                  <Table.Td>
                    <UnstyledButton
                      className={rowClasses.link}
                      component={Link}
                      to={getSpaceUrl(fav.space.slug)}
                    >
                      <Group wrap="nowrap">
                        <CustomAvatar
                          avatarUrl={fav.space.logo}
                          name={fav.space.name}
                          type={AvatarIconType.SPACE_ICON}
                          size={18}
                          radius="sm"
                        />
                        <Text fw={500} size="md" lineClamp={1}>
                          {fav.space.name}
                        </Text>
                      </Group>
                    </UnstyledButton>
                  </Table.Td>
                  {!spaceId && <Table.Td />}
                  <Table.Td>
                    <CreatorCell creator={fav.space?.creator} />
                  </Table.Td>
                  <Table.Td>
                    <Text
                      c="dimmed"
                      style={{ whiteSpace: "nowrap" }}
                      size="xs"
                      fw={500}
                    >
                      {formattedDate(new Date(fav.createdAt))}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : null,
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {hasNextPage && (
        <Button
          variant="subtle"
          fullWidth
          mt="sm"
          mb="xl"
          onClick={() => fetchNextPage()}
          loading={isFetchingNextPage}
        >
          {t("Load more")}
        </Button>
      )}
    </>
  ) : (
    <EmptyState
      icon={IconStar}
      title={t("No favorites yet")}
      description={t("Pages you star will show up here.")}
    />
  );
}
