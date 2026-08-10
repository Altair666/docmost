import { Box, Divider, Modal, Tooltip } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { CreateSpaceForm } from "@/features/space/components/create-space-form.tsx";

// Зелёная кнопка в начале меню — на месте гристовской «Add new».
// Размеры сняты из DOM Grist:
//   развёрнутая  208x40, скругление 4, подпись 13px/700 белым с отступом 24
//   кружок       28x28 внутри, у правого края с отступом 16, фон темнее
//   свёрнутая    остаётся только кружок 28x28, по центру полосы в 48
//
// У Grist она создаёт документ, у нас — пространство: это ближайшее по
// смыслу действие, и оно доступно любому участнику.
export default function GristAddButton({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);

  const label = t("Create space");

  const circle = (
    <Box
      style={{
        flex: "none",
        width: 28,
        height: 28,
        borderRadius: 14,
        background: "var(--grist-primary-muted, #009058)",
        color: "#fff",
        display: "grid",
        placeItems: "center",
      }}
    >
      <IconPlus size={16} stroke={2} />
    </Box>
  );

  return (
    <>
      <Tooltip
        label={label}
        position="right"
        withArrow
        openDelay={200}
        disabled={!compact}
      >
        <Box
          component="button"
          type="button"
          onClick={open}
          aria-label={label}
          data-grist-add=""
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: compact ? "center" : "space-between",
            width: compact ? 28 : 208,
            height: compact ? 28 : 40,
            padding: compact ? 0 : "0 16px 0 24px",
            border: "none",
            borderRadius: compact ? 14 : 4,
            background: compact
              ? "var(--grist-primary-muted, #009058)"
              : "var(--grist-primary, #16b378)",
            color: "#fff",
            font: "inherit",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          {compact ? <IconPlus size={16} stroke={2} /> : label}
          {!compact && circle}
        </Box>
      </Tooltip>

      <Modal
        opened={opened}
        onClose={close}
        title={label}
        closeButtonProps={{ "aria-label": t("Close") }}
      >
        <Divider size="xs" mb="xs" />
        <CreateSpaceForm />
      </Modal>
    </>
  );
}
