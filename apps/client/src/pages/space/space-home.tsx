import { Container, Group, Title } from "@mantine/core";
import { IconHome } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useUiFlags } from "@/custom-sso/ui-flags";
import SpaceHomeTabs from "@/features/space/components/space-home-tabs.tsx";
import {useParams} from "react-router-dom";
import {useGetSpaceBySlugQuery} from "@/features/space/queries/space-query.ts";
import {getAppName} from "@/lib/config.ts";
import {Helmet} from "react-helmet-async";

export default function SpaceHome() {
    const {t} = useTranslation();
    const {customUi} = useUiFlags();
    const {spaceSlug} = useParams();
    const {data: space} = useGetSpaceBySlugQuery(spaceSlug);

    return (
        <>
            <Helmet>
                <title>{space?.name || 'Overview'} - {getAppName()}</title>
            </Helmet>
            {/* Поле и отступ сверху те же, что на «Все документы» */}
            <Container
                size={customUi ? 1340 : ("900" as any)}
                px={customUi ? 24 : undefined}
                pt={customUi ? 16 : "xl"}
            >
                {/* Ярлычок раздела — как на остальных страницах */}
                {customUi && (
                    <Group gap={11} align="center" mb="xl">
                        <IconHome size={24} stroke={2}/>
                        <Title order={1} size="h3">{t("Overview")}</Title>
                    </Group>
                )}

                {space && <SpaceHomeTabs/>}
            </Container>
        </>
    );
}
