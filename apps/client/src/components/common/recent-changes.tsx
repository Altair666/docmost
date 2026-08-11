import {
  Text,
  Group,
  UnstyledButton,
  Badge,
  Table,
  Button,
} from "@mantine/core";
import { Link } from "react-router-dom";
import PageListSkeleton from "@/components/ui/page-list-skeleton.tsx";
import { buildPageUrl, getPageTitle } from "@/features/page/page.utils.ts";
import { formattedDate } from "@/lib/time.ts";
import { useRecentChangesQuery } from "@/features/page/queries/page-query.ts";
import { PageListIcon } from "@/components/common/page-list-icon";
import { IconFiles } from "@tabler/icons-react";
import { EmptyState } from "@/components/ui/empty-state.tsx";
import { getSpaceUrl } from "@/lib/config.ts";
import { useTranslation } from "react-i18next";
import { getInitialsColor } from "@/lib/get-initials-color.ts";
import rowClasses from "@/components/ui/clickable-table-row.module.css";
import CreatorCell from "@/custom-sso/CreatorCell";
import { useUiFlags } from "@/custom-sso/ui-flags";
import type { GristSort } from "@/custom-sso/GristSortSelect";

interface Props {
  spaceId?: string;
  sort?: GristSort;
}

export default function RecentChanges({ spaceId, sort }: Props) {
  const { t } = useTranslation();
  const { customUi } = useUiFlags();
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useRecentChangesQuery(spaceId);
  const loaded = data?.pages.flatMap((p) => p.items) ?? [];

  // Столбец «Кем создано» — в обоих списках.
  const withCreator = customUi;
  // Подписи столбцов — только на «Обзоре» пространства: на главной их
  // не просили.
  const withColumns = Boolean(customUi && spaceId);

  // Порядок как у Grist: по наименованию или по дате (свежие сверху).
  // Переставляется загруженная часть: список приходит с сервера кусками.
  const pages = sort
    ? [...loaded].sort((a: any, b: any) =>
        sort === "name"
          ? getPageTitle(a.title, a.isBase, t).localeCompare(
              getPageTitle(b.title, b.isBase, t),
              undefined,
              { sensitivity: "base" },
            )
          : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
    : loaded;

  if (isLoading) {
    return <PageListSkeleton />;
  }

  if (isError) {
    return <Text>{t("Failed to fetch recent pages")}</Text>;
  }

  return pages.length > 0 ? (
    <>
      <Table.ScrollContainer minWidth={500}>
        <Table highlightOnHover verticalSpacing="sm">
          {withColumns && (
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: "50%" }}>{t("Name")}</Table.Th>
                <Table.Th style={{ width: "20%", maxWidth: 200 }}>
                  {t("Author")}
                </Table.Th>
                <Table.Th style={{ width: "30%", maxWidth: 250 }}>
                  {t("Last edited")}
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
          )}

          <Table.Tbody>
            {pages.map((page) => (
              <Table.Tr key={page.id} className={rowClasses.row}>
                <Table.Td>
                  <UnstyledButton
                    className={rowClasses.link}
                    component={Link}
                    to={buildPageUrl(page?.space.slug, page.slugId, page.title)}
                  >
                    <Group wrap="nowrap">
                      <PageListIcon icon={page.icon} isBase={page.isBase} />

                      <Text fw={500} size="md" lineClamp={1}>
                        {getPageTitle(page.title, page.isBase, t)}
                      </Text>
                    </Group>
                  </UnstyledButton>
                </Table.Td>
                {!spaceId && (
                  <Table.Td>
                    <Badge
                      color={getInitialsColor(page?.space.name)}
                      variant="light"
                      component={Link}
                      to={getSpaceUrl(page?.space.slug)}
                      style={{ cursor: "pointer" }}
                    >
                      {page?.space.name}
                    </Badge>
                  </Table.Td>
                )}

                {withCreator && (
                  <Table.Td>
                    <CreatorCell creator={(page as any).creator} />
                  </Table.Td>
                )}

                <Table.Td>
                  <Text
                    c="dimmed"
                    style={{ whiteSpace: "nowrap" }}
                    size="xs"
                    fw={500}
                  >
                    {formattedDate(page.updatedAt)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
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
      icon={IconFiles}
      title={t("No pages yet")}
      description={t("Pages you create will show up here.")}
    />
  );
}
