import { ReactNode } from "react";
import { Container, Group, Space, Tabs, Text, Title } from "@mantine/core";
import { IconClockHour3, IconHome, IconStar, IconUser } from "@tabler/icons-react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useAtom } from "jotai";

import RecentChanges from "@/components/common/recent-changes";
import GristFavoritesPages from "@/custom-sso/GristFavoritesPages";
import CreatedByMe from "@/features/home/components/created-by-me";
import HomeAiPrompt from "@/features/home/components/home-ai-prompt";
import SpaceCarousel from "@/features/space/components/space-carousel.tsx";
import { homeTabAtom } from "@/features/home/atoms/home-tab-atom";
import { getAppName } from "@/lib/config.ts";

import ViewAllSpacesLink from "@/custom-sso/ViewAllSpacesLink";

// Вкладки главной. От вкладок апстрима отличаются одним: справа на их
// черте стоит управляющий элемент — у Grist там выбор сортировки, у нас
// ссылка на все пространства. Черта вкладок до него не доходит.
function GristHomeTabs({ rightSection }: { rightSection?: ReactNode }) {
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
        <GristFavoritesPages />
      </Tabs.Panel>
      <Tabs.Panel value="created">
        <CreatedByMe />
      </Tabs.Panel>
    </Tabs>
  );
}

export default function GristHome() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>
          {t("Home")} - {getAppName()}
        </title>
      </Helmet>
      {/* Как поле содержимого у Grist: во всю ширину, но не шире 1340
          и по центру (DocMenuCss.js: max-width 1340px, margin 0 auto).
          Узкий контейнер в 900 у апстрима оставлял список висеть посреди
          пустоты, а «во всю ширину» без потолка растягивало его.
          Поле и отступ сверху те же, что на «Все документы». */}
      <Container size={1340} px={24} pt={16}>
        {/* Ярлычок раздела — как на «Все документы» */}
        <Group gap={11} align="center" mb="xl">
          <IconHome size={24} stroke={2} />
          <Title order={1} size="h3">
            {t("Home")}
          </Title>
        </Group>

        <HomeAiPrompt />

        <SpaceCarousel />

        <Space h="xl" />

        {/* Ссылка встаёт на черту вкладок справа — там же, где у Grist
            выбор сортировки. */}
        <GristHomeTabs rightSection={<ViewAllSpacesLink />} />
      </Container>
    </>
  );
}
