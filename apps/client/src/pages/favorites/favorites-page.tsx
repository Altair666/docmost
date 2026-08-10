import {
  Text,
  Group,
  UnstyledButton,
  Badge,
  Table,
  Container,
  Title,
  ThemeIcon,
  Button,
  VisuallyHidden,
} from "@mantine/core";
import { Link } from "react-router-dom";
import { buildPageUrl, getPageTitle } from "@/features/page/page.utils";
import { formattedDate } from "@/lib/time";
import { useFavoritesQuery } from "@/features/favorite/queries/favorite-query";
import { IconFileDescription, IconStar } from "@tabler/icons-react";
import { EmptyState } from "@/components/ui/empty-state";
import { getSpaceUrl } from "@/lib/config";
import { useTranslation } from "react-i18next";
import { getInitialsColor } from "@/lib/get-initials-color";
import PageListSkeleton from "@/components/ui/page-list-skeleton";
import { PageListIcon } from "@/components/common/page-list-icon";
import rowClasses from "@/components/ui/clickable-table-row.module.css";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { AvatarIconType } from "@/features/attachments/types/attachment.types";
import { useUiFlags } from "@/custom-sso/ui-flags";
import { IconGristPin } from "@/custom-sso/GristIcons";
import GristSortSelect, { GristSort } from "@/custom-sso/GristSortSelect";
import { useState } from "react";
import { useAtomValue } from "jotai";
import { listFilterAtom } from "@/custom-sso/list-filter";

export default function FavoritesPage() {
  const { t } = useTranslation();
  // Без указания вида сервер отдаёт всё закреплённое — и страницы, и
  // пространства. В стоковом виде оставляем прежнее поведение.
  const { customUi } = useUiFlags();
  const [sort, setSort] = useState<GristSort>("date");
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useFavoritesQuery(customUi ? undefined : "page");
  const loaded = data?.pages.flatMap((p) => p.items) ?? [];

  // Порядок как у Grist: по имени или по дате (свежие сверху).
  // Сравниваем показанное имя, а не сырое поле: у страницы без названия
  // оно пустое, и такие строки не переставлялись вовсе.
  const nameOf = (f: any) =>
    f.page ? getPageTitle(f.page.title, undefined, t) : f.space?.name || "";
  // Набранное в шапке в режиме «Найти пространство» отсеивает строки
  const listFilter = useAtomValue(listFilterAtom).trim().toLowerCase();
  const shown = listFilter
    ? loaded.filter((f: any) =>
        nameOf(f).toLowerCase().includes(listFilter),
      )
    : loaded;

  const favorites = [...shown].sort((a, b) =>
    sort === "name"
      ? nameOf(a).localeCompare(nameOf(b), undefined, { sensitivity: "base" })
      : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  if (isLoading) {
    return (
      <Container size={1340} px={24} py="xl">
        <Title order={3} mb="lg">
          {t("Favorites")}
        </Title>
        <PageListSkeleton />
      </Container>
    );
  }

  if (isError) {
    return (
      <Container size={1340} px={24} py="xl">
        <Title order={3} mb="lg">
          {t("Favorites")}
        </Title>
        <Text>{t("Failed to fetch favorite pages")}</Text>
      </Container>
    );
  }

  // Поле и отступ сверху те же, что на «Все документы»
  return (
    <Container size={1340} px={24} pt={16} pb="xl">
      {/* Ярлычок раздела — как на «Все документы» */}
      <Group gap={11} align="center" mb="xl">
        <IconGristPin size={24} stroke={2} />
        <Title order={1} size="h3">
          {t("Favorites")}
        </Title>
      </Group>

      {favorites.length > 0 ? (
        <>
          <Table.ScrollContainer minWidth={500}>
            <Table highlightOnHover verticalSpacing="sm">
              {/* Шапка та же, что на «Все документы»: подписи столбцов,
                  полоса под ними и сортировка в последней ячейке. */}
              {customUi && (
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: "50%" }}>{t("Name")}</Table.Th>
                    <Table.Th style={{ width: "20%", maxWidth: 200 }}>
                      {t("Space")}
                    </Table.Th>
                    <Table.Th style={{ width: "30%", maxWidth: 250 }}>
                      {t("Added")}
                    </Table.Th>
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
                      <VisuallyHidden>{t("Sort")}</VisuallyHidden>
                      <GristSortSelect value={sort} onChange={setSort} />
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
              )}

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
                            {/* Тот же значок, что в списке документов, —
                                иначе строки выглядят по-разному. */}
                            <PageListIcon
                              icon={fav.page.icon}
                              isBase={fav.page.isBase}
                            />
                            <Text fw={500} size="md" lineClamp={1}>
                              {getPageTitle(fav.page.title, undefined, t)}
                            </Text>
                          </Group>
                        </UnstyledButton>
                      </Table.Td>
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
                      {/* Под столбцом сортировки — он же столбец действий */}
                      <Table.Td />
                    </Table.Tr>
                  ) : fav.space ? (
                    // Закреплённое пространство. Отдельной секции для них
                    // в меню больше нет, поэтому показываем здесь же.
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
                              size={16}
                              radius="sm"
                            />
                            <Text fw={500} size="md" lineClamp={1}>
                              {fav.space.name}
                            </Text>
                          </Group>
                        </UnstyledButton>
                      </Table.Td>
                      <Table.Td />
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
                      <Table.Td />
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
          title={t("No favorite pages")}
          description={t("Pages you favorite will show up here.")}
        />
      )}
    </Container>
  );
}
