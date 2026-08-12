import { Container, Space } from "@mantine/core";
import HomeTabs from "@/features/home/components/home-tabs";
import HomeAiPrompt from "@/features/home/components/home-ai-prompt";
import SpaceCarousel from "@/features/space/components/space-carousel.tsx";
import { getAppName } from "@/lib/config.ts";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useUiFlags } from "@/custom-sso/ui-flags";
import GristHome from "@/custom-sso/GristHome";

function StockHome() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>
          {t("Home")} - {getAppName()}
        </title>
      </Helmet>
      <Container size={"900"} pt="xl">
        <HomeAiPrompt />

        <Space h="xl" />

        <SpaceCarousel />

        <Space h="xl" />

        <HomeTabs />
      </Container>
    </>
  );
}

export default function Home() {
  // У нашей главной свой заголовок, ширина поля и вкладки со ссылкой на
  // все пространства — она живёт отдельным модулем.
  const { customUi } = useUiFlags();
  return customUi ? <GristHome /> : <StockHome />;
}
