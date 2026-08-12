import { useState } from "react";
import { Container, Title, Group, Box } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { useAtomValue } from "jotai";

import { getAppName } from "@/lib/config";
import { useGetSpacesQuery } from "@/features/space/queries/space-query";
import GristSpacesList from "@/custom-sso/GristSpacesList";
import { usePaginateAndSearch } from "@/hooks/use-paginate-and-search";

import { IconGristStack } from "@/custom-sso/GristIcons";
import GristSortSelect, { GristSort } from "@/custom-sso/GristSortSelect";
import { listFilterAtom } from "@/custom-sso/list-filter";

export default function GristSpaces() {
  const { t } = useTranslation();
  const [sort, setSort] = useState<GristSort>("date");

  const { search, cursor, goNext, goPrev } = usePaginateAndSearch();

  const { data } = useGetSpacesQuery({ cursor, limit: 30, query: search });

  // Набранное в шапке в режиме «Найти пространство» отсеивает строки
  const listFilter = useAtomValue(listFilterAtom).trim().toLowerCase();
  const shownSpaces = (data?.items || []).filter((s: any) =>
    listFilter ? (s.name || "").toLowerCase().includes(listFilter) : true,
  );

  // Порядок как у Grist: по наименованию, по дате (свежие сверху) или по
  // автору. Сортируется показанная страница: список приходит частями.
  const authorOf = (s: any) => s.creator?.name || s.creator?.email || "";

  const sortedSpaces = [...shownSpaces].sort((a: any, b: any) => {
    if (sort === "name") {
      return (a.name || "").localeCompare(b.name || "", undefined, {
        sensitivity: "base",
      });
    }
    if (sort === "creator") {
      return authorOf(a).localeCompare(authorOf(b), undefined, {
        sensitivity: "base",
      });
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <>
      <Helmet>
        <title>
          {t("Spaces")} - {getAppName()}
        </title>
      </Helmet>

      {/* 16px от верха поля — так заголовок стоит у Grist */}
      <Container size={1340} px={24} pt={16}>
        <Group justify="space-between" mb="xl" align="flex-end">
          {/* Значок тот же, что у пункта меню «Все документы» */}
          <Group gap={11} align="center">
            <IconGristStack size={24} stroke={2} />
            <Title order={1} size="h3">
              {t("Spaces")}
            </Title>
          </Group>

          {/* Кнопки создания здесь нет: пространство создаётся зелёной
              кнопкой в меню слева, а дублировать её на странице незачем. */}
        </Group>

        {/* Плитки избранных пространств у апстрима дублируют список ниже —
            на этой странице они не нужны. */}
        <Box>
          {/* Второго заголовка здесь нет: страница уже подписана сверху */}
          <GristSpacesList
            spaces={sortedSpaces}
            sortControl={
              <GristSortSelect value={sort} onChange={setSort} withCreator />
            }
            hasPrevPage={data?.meta?.hasPrevPage}
            hasNextPage={data?.meta?.hasNextPage}
            onNext={() => goNext(data?.meta?.nextCursor)}
            onPrev={goPrev}
          />
        </Box>
      </Container>
    </>
  );
}
