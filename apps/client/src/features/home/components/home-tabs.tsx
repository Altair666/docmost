import { ReactNode } from "react";
import { Text, Tabs, Space } from "@mantine/core";
import { IconClockHour3, IconStar, IconUser } from "@tabler/icons-react";
import RecentChanges from "@/components/common/recent-changes";
import FavoritesPages from "./favorites-pages";
import CreatedByMe from "./created-by-me";
import { useTranslation } from "react-i18next";
import { useAtom } from "jotai";
import { homeTabAtom } from "@/features/home/atoms/home-tab-atom";

export default function HomeTabs({
  rightSection,
}: {
  // Управляющий элемент справа от вкладок — у Grist на этом месте стоит
  // выбор сортировки, черта вкладок до него не доходит.
  rightSection?: ReactNode;
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useAtom(homeTabAtom);

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
        {/* Вкладки не сжимаются: иначе на узком окне они прокручиваются
            внутри себя и последняя обрезается. */}
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

        {/* Прижат вправо и на своей строке, если перенёсся */}
        <div style={{ marginLeft: "auto", minWidth: 0 }}>{rightSection}</div>
      </div>

      <Space my="md" />

      <Tabs.Panel value="recent">
        <RecentChanges />
      </Tabs.Panel>
      <Tabs.Panel value="favorites">
        <FavoritesPages />
      </Tabs.Panel>
      <Tabs.Panel value="created">
        <CreatedByMe />
      </Tabs.Panel>
    </Tabs>
  );
}
