import { Container, Group, Space, Title } from "@mantine/core";
import { IconHome } from "@tabler/icons-react";
import HomeTabs from "@/features/home/components/home-tabs";
import ViewAllSpacesLink from "@/custom-sso/ViewAllSpacesLink";
import HomeAiPrompt from "@/features/home/components/home-ai-prompt";
import SpaceCarousel from "@/features/space/components/space-carousel.tsx";
import { getAppName } from "@/lib/config.ts";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useUiFlags } from "@/custom-sso/ui-flags";

export default function Home() {
  const { t } = useTranslation();
  const { customUi } = useUiFlags();

  return (
    <>
      <Helmet>
        <title>
          {t("Home")} - {getAppName()}
        </title>
      </Helmet>
      {/* Как поле содержимого у Grist: во всю ширину, но не шире 1340
          и по центру (DocMenuCss.js: max-width 1340px, margin 0 auto).
          Прежний узкий контейнер в 900 оставлял список висеть посреди
          пустоты, а «во всю ширину» без потолка растягивало его. */}
      {/* Поле и отступ сверху те же, что на «Все документы» */}
      <Container size={1340} px={24} pt={customUi ? 16 : "xl"}>
        {/* Ярлычок раздела — как на «Все документы» */}
        {customUi && (
          <Group gap={11} align="center" mb="xl">
            <IconHome size={24} stroke={2} />
            <Title order={1} size="h3">
              {t("Home")}
            </Title>
          </Group>
        )}

        <HomeAiPrompt />

        <SpaceCarousel />

        <Space h="xl" />

        {/* Ссылка встаёт на черту вкладок справа — там же, где у Grist
            выбор сортировки. */}
        <HomeTabs rightSection={customUi ? <ViewAllSpacesLink /> : undefined} />
      </Container>
    </>
  );
}
