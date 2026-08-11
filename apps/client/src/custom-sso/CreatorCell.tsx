import { Group, Text } from "@mantine/core";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { AvatarIconType } from "@/features/attachments/types/attachment.types";

// Содержимое столбца «Кем создано»: значок, имя, под ним почта.
// Одинаково в списках недавних, закреплённых, созданных мной и в списке
// пространств — поэтому живёт одним узлом.
export default function CreatorCell({ creator }: { creator?: any }) {
  if (!creator) {
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    );
  }

  return (
    <Group wrap="nowrap" gap="xs">
      <CustomAvatar
        avatarUrl={creator.avatarUrl}
        name={creator.name}
        type={AvatarIconType.AVATAR}
        size={24}
      />
      <div style={{ minWidth: 0 }}>
        <Text size="sm" lineClamp={1}>
          {creator.name}
        </Text>
        {creator.email && (
          <Text size="xs" c="dimmed" lineClamp={1}>
            {creator.email}
          </Text>
        )}
      </div>
    </Group>
  );
}
