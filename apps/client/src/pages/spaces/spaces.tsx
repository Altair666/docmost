import { Container, Title, Group, Box } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { getAppName } from "@/lib/config";
import { useGetSpacesQuery } from "@/features/space/queries/space-query";
import CreateSpaceModal from "@/features/space/components/create-space-modal";
import { AllSpacesList } from "@/features/space/components/spaces-page";
import FavoriteSpacesGrid from "@/features/space/components/spaces-page/favorite-spaces-grid";
import { usePaginateAndSearch } from "@/hooks/use-paginate-and-search";
import useUserRole from "@/hooks/use-user-role";
import { useUiFlags } from "@/custom-sso/ui-flags";
import { IconGristStack } from "@/custom-sso/GristIcons";
import GristSortSelect, { GristSort } from "@/custom-sso/GristSortSelect";
import { useState } from "react";
import { useAtomValue } from "jotai";
import { listFilterAtom } from "@/custom-sso/list-filter";

export default function Spaces() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const { customUi } = useUiFlags();
  const [sort, setSort] = useState<GristSort>("date");

  const { search, cursor, goNext, goPrev, handleSearch } = usePaginateAndSearch();

  const { data, isLoading } = useGetSpacesQuery({
    cursor,
    limit: 30,
    query: search,
  });

  // Набранное в шапке в режиме «Найти пространство» отсеивает строки
  const listFilter = useAtomValue(listFilterAtom).trim().toLowerCase();
  const shownSpaces = (data?.items || []).filter((s: any) =>
    listFilter ? (s.name || "").toLowerCase().includes(listFilter) : true,
  );

  // Порядок как у Grist: по наименованию или по дате (свежие сверху).
  // Сортируется показанная страница: список приходит с сервера частями.
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
      <Container size={1340} px={24} pt={customUi ? 16 : "xl"}>
        <Group justify="space-between" mb="xl" align="flex-end">
          {/* Значок тот же, что у пункта меню «Все документы» */}
          <Group gap={11} align="center">
            {customUi && <IconGristStack size={24} stroke={2} />}
            <Title order={1} size="h3">
              {t("Spaces")}
            </Title>
          </Group>

          {/* Кнопки создания здесь нет: пространство создаётся зелёной
              кнопкой в меню слева, а дублировать её на странице незачем. */}
        </Group>

        {/* Избранные пространства дублируют список ниже — на этой
            странице они не нужны. В стоковом виде остаются. */}
        {!customUi && <FavoriteSpacesGrid />}

        <Box>
          {/* Второго заголовка здесь нет: страница уже подписана сверху */}
          <AllSpacesList
            spaces={sortedSpaces}
            sortControl={
              customUi ? (
                <GristSortSelect value={sort} onChange={setSort} withCreator />
              ) : undefined
            }
            onSearch={handleSearch}
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
