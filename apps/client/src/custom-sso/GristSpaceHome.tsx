import { useState } from "react";
import { Container, Group, Space, Tabs, Text, Title } from "@mantine/core";
import { IconClockHour3, IconHome, IconStar, IconUser } from "@tabler/icons-react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { useAtom } from "jotai";

import RecentChanges from "@/components/common/recent-changes";
import GristFavoritesPages from "@/custom-sso/GristFavoritesPages";
import CreatedByMe from "@/features/home/components/created-by-me";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query";
import { homeTabAtom } from "@/features/home/atoms/home-tab-atom";
import { getAppName } from "@/lib/config.ts";

import GristSortSelect, { GristSort } from "@/custom-sso/GristSortSelect";

// Вкладки обзора пространства. Отличие от апстрима одно: на их черте
// справа стоит выбор сортировки — так же, как на «Все документы»
// (column-gap 24px у cssHeader в Grist).
function GristSpaceHomeTabs({ spaceId }: { spaceId: string }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useAtom(homeTabAtom);
  const [sort, setSort] = useState<GristSort>("date");

  return (
    <Tabs
      color="dark"
      value={activeTab}
      onChange={(value) => {
        if (value) setActiveTab(value);
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          columnGap: 24,
          rowGap: 8,
          alignItems: "flex-end",
        }}
      >
        {/* Вкладки не сжимаются — см. такую же полосу на главной */}
        <Tabs.List style={{ flex: "1 0 auto", flexWrap: "nowrap" }}>
          <Tabs.Tab value="recent" leftSection={<IconClockHour3 size={18} />}>
            <Text size="sm" fw={500}>
              {t("Recently updated")}
            </Text>
          </Tabs.Tab>
          <Tabs.Tab value="favorites" leftSection={<IconStar size={18} />}>
            <Text size="sm" fw={500}>
              {t("Favorites")}
            </Text>
          </Tabs.Tab>
          <Tabs.Tab value="created" leftSection={<IconUser size={18} />}>
            <Text size="sm" fw={500}>
              {t("Created by me")}
            </Text>
          </Tabs.Tab>
        </Tabs.List>

        <div style={{ marginLeft: "auto", minWidth: 0 }}>
          <GristSortSelect value={sort} onChange={setSort} />
        </div>
      </div>

      <Space my="md" />

      <Tabs.Panel value="recent">
        <RecentChanges spaceId={spaceId} sort={sort} />
      </Tabs.Panel>
      <Tabs.Panel value="favorites">
        <GristFavoritesPages spaceId={spaceId} />
      </Tabs.Panel>
      <Tabs.Panel value="created">
        <CreatedByMe spaceId={spaceId} />
      </Tabs.Panel>
    </Tabs>
  );
}

export default function GristSpaceHome() {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);

  return (
    <>
      <Helmet>
        <title>
          {space?.name || "Overview"} - {getAppName()}
        </title>
      </Helmet>
      {/* Поле и отступ сверху те же, что на «Все документы» */}
      <Container size={1340} px={24} pt={16}>
        {/* Ярлычок раздела — как на остальных страницах */}
        <Group gap={11} align="center" mb="xl">
          <IconHome size={24} stroke={2} />
          <Title order={1} size="h3">
            {t("Overview")}
          </Title>
        </Group>

        {space?.id && <GristSpaceHomeTabs spaceId={space.id} />}
      </Container>
    </>
  );
}
