import classes from "./page-header.module.css";
import PageHeaderMenu from "@/features/page/components/header/page-header-menu.tsx";
import { Group } from "@mantine/core";
import Breadcrumb from "@/features/page/components/breadcrumbs/breadcrumb.tsx";
import { useUiFlags } from "@/custom-sso/ui-flags";
import PageBylineTop from "@/custom-sso/PageBylineTop";

interface Props {
  readOnly?: boolean;
}
export default function PageHeader({ readOnly }: Props) {
  // В нашем оформлении крошки живут в шапке приложения, у стрелки
  // сворачивания панели. В стоковом виде остаются здесь.
  const { customUi } = useUiFlags();

  return (
    <div className={classes.header} data-page-header="true">
      <Group justify="space-between" h="100%" px="md" wrap="nowrap" className={classes.group}>
        {/* Слева — кто создал страницу, подробности и значок проверки.
            Крошки живут выше, в шапке приложения. */}
        {customUi ? (
          <div data-page-byline="">
            <PageBylineTop readOnly={readOnly} />
          </div>
        ) : (
          <Breadcrumb />
        )}

        <Group justify="flex-end" h="100%" px="md" wrap="nowrap" gap="var(--mantine-spacing-xs)">
          <PageHeaderMenu readOnly={readOnly} />
        </Group>
      </Group>
    </div>
  );
}
