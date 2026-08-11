import { Group, Stack, Text } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { extractPageSlugId } from "@/lib";
import { usePageQuery } from "@/features/page/queries/page-query";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";
import { formattedDate } from "@/lib/time";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { AvatarIconType } from "@/features/attachments/types/attachment.types";

// Подробности страницы — своя разметка, ничего из правой панели Docmost.
// Данные берём из самой страницы, число слов и знаков — из редактора.
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Group justify="space-between" gap="xs" wrap="nowrap">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="xs" style={{ textAlign: "right" }}>
        {value}
      </Text>
    </Group>
  );
}

function Person({ label, user }: { label: string; user?: any }) {
  if (!user) return null;
  return (
    <Group justify="space-between" gap="xs" wrap="nowrap">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Group gap={6} wrap="nowrap">
        <CustomAvatar
          avatarUrl={user.avatarUrl}
          name={user.name}
          type={AvatarIconType.AVATAR}
          size={18}
        />
        <Text size="xs" lineClamp={1}>
          {user.name}
        </Text>
      </Group>
    </Group>
  );
}

export default function PageDetailsBlock() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const { data: page } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });
  const editor = useAtomValue(pageEditorAtom);

  if (!page) return null;

  const words = editor?.storage?.characterCount?.words?.() ?? 0;
  const chars = editor?.storage?.characterCount?.characters?.() ?? 0;

  return (
    <Stack gap={6} py="xs">
      <Person label={t("Author")} user={(page as any).creator} />
      <Person label={t("Last edited by")} user={(page as any).lastUpdatedBy} />
      <Row label={t("Created")} value={formattedDate(page.createdAt)} />
      <Row label={t("Last edited")} value={formattedDate(page.updatedAt)} />
      <Row label={t("Words")} value={words} />
      <Row label={t("Characters")} value={chars} />
    </Stack>
  );
}
