import {Container} from "@mantine/core";
import SpaceHomeTabs from "@/features/space/components/space-home-tabs.tsx";
import {useParams} from "react-router-dom";
import {useGetSpaceBySlugQuery} from "@/features/space/queries/space-query.ts";
import {getAppName} from "@/lib/config.ts";
import {Helmet} from "react-helmet-async";
import { useUiFlags } from "@/custom-sso/ui-flags";
import GristSpaceHome from "@/custom-sso/GristSpaceHome";

function StockSpaceHome() {
    const {spaceSlug} = useParams();
    const {data: space} = useGetSpaceBySlugQuery(spaceSlug);

    return (
        <>
            <Helmet>
                <title>{space?.name || 'Overview'} - {getAppName()}</title>
            </Helmet>
            <Container size={"900"} pt="xl">
                {space && <SpaceHomeTabs/>}
            </Container>
        </>
    );
}

export default function SpaceHome() {
  // У нашего обзора свой заголовок, ширина поля и сортировка на черте
  // вкладок — он живёт отдельным модулем.
  const { customUi } = useUiFlags();
  return customUi ? <GristSpaceHome /> : <StockSpaceHome />;
}
