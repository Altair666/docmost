import { Text, Tabs, Space } from "@mantine/core";
import { IconClockHour3, IconStar, IconUser } from "@tabler/icons-react";
import RecentChanges from "@/components/common/recent-changes";
import FavoritesPages from "@/features/home/components/favorites-pages";
import CreatedByMe from "@/features/home/components/created-by-me";
import { useParams } from "react-router-dom";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useAtom } from "jotai";
import { useUiFlags } from "@/custom-sso/ui-flags";
import GristSortSelect, { GristSort } from "@/custom-sso/GristSortSelect";
import { homeTabAtom } from "@/features/home/atoms/home-tab-atom";

export default function SpaceHomeTabs() {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);
  const [activeTab, setActiveTab] = useAtom(homeTabAtom);
  const { customUi } = useUiFlags();
  const [sort, setSort] = useState<GristSort>("date");

  return (
    <Tabs
      color="dark"
      value={activeTab}
      onChange={(value) => {
        if (value) setActiveTab(value);
      }}
    >
      {/* Вкладки растянуты, выбор сортировки стоит за ними через 24px —
          так же, как на «Все документы» (column-gap у cssHeader в Grist). */}
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
          {customUi && <GristSortSelect value={sort} onChange={setSort} />}
        </div>
      </div>

      <Space my="md" />

      <Tabs.Panel value="recent">
        {space?.id && <RecentChanges spaceId={space.id} sort={sort} />}
      </Tabs.Panel>
      <Tabs.Panel value="favorites">
        {space?.id && <FavoritesPages spaceId={space.id} />}
      </Tabs.Panel>
      <Tabs.Panel value="created">
        {space?.id && <CreatedByMe spaceId={space.id} />}
      </Tabs.Panel>
    </Tabs>
  );
}
