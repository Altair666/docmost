import { Box, Divider, Modal } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { CreateSpaceForm } from "@/features/space/components/create-space-form.tsx";
import { useSidebarCollapsed } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";

// Зелёная кнопка в начале меню — на месте гристовской «Add new».
// Собрана по его исходнику (app/client/ui/AddNewButton.js):
//
//   cssAddNewButton  display:flex; height:40; overflow:hidden;
//                    margin: 22px 16px (развёрнутая), 22px 0 (свёрнутая)
//     cssLeftMargin  flex: 0 1 24px      — левый зазор
//     cssAddText     flex: 0 0.5 content; white-space:nowrap; min-width:0
//     div            flex: 1 1 16px      — тянущийся зазор
//     cssPlusButton  flex:none; 28x28; radius 14
//     div            flex: 0 1 16px      — правый зазор
//
// Отступы у него — не поля, а гибкие элементы: в комментарии так и
// написано, что это позволяет им схлопываться первыми, когда места мало.
// Поэтому при сужении панели сначала уходят зазоры, потом ужимается
// подпись, а кружок не деформируется и не вылезает за край.
//
// У Grist она создаёт документ, у нас — пространство: это ближайшее по
// смыслу действие, и оно доступно любому участнику.
export default function GristAddButton({
  compact,
}: {
  compact?: boolean;
}) {
  const { t } = useTranslation();
  // Состояние панели спрашиваем сами — см. WorkspaceBadge
  const collapsedNow = useSidebarCollapsed();
  const isCompact = compact ?? collapsedNow;
  const [opened, { open, close }] = useDisclosure(false);

  const label = t("Space");
  const fullLabel = t("Create space");

  return (
    <>
      {/* Всплывающей подсказки нет: она загораживала соседние кнопки.
          Подпись для читалок экрана остаётся в aria-label. */}
      <Box
        component="button"
        type="button"
        onClick={open}
        aria-label={fullLabel}
        data-grist-add=""
        style={{
          display: "flex",
          alignItems: "center",
          // У <button> своя ширина по содержимому — растягиваем явно
          width: isCompact ? 28 : "100%",
          height: isCompact ? 28 : 40,
          // В свёрнутом виде кружок стоит по центру полосы. Боковые
          // отступы развёрнутой кнопки живут в обёртке, иначе ширина
          // в 100% вылезает за край панели.
          margin: isCompact ? "0 auto" : 0,
          // Положение задают отступы, а не зазоры-элементы: те схлопывались
          // на узкой панели и подпись уезжала относительно строк ниже.
          padding: isCompact ? 0 : "0 16px 0 24px",
          border: "none",
          borderRadius: isCompact ? 14 : 4,
          color: "#fff",
          font: "inherit",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          userSelect: "none",
          textAlign: "left",
          // Содержимое не выходит за края, как бы ни сжали панель
          overflow: "hidden",
        }}
      >
        {isCompact ? (
          <Box style={{ flex: "none", display: "grid", placeItems: "center", width: 28, height: 28 }}>
            <IconPlus size={16} stroke={2} />
          </Box>
        ) : (
          <>
            <Box
              style={{
                // Подпись не сжимается: она должна помещаться целиком,
                // а панель — не сужаться сильнее, чем нужно для неё.
                flex: "none",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </Box>

            {/* Распорка: забирает всё свободное место, поэтому кружок
                прижат к правому краю, и не сжимается меньше 16px, поэтому
                подпись к нему ближе не подойдёт. */}
            <Box style={{ flex: "1 1 auto", minWidth: 16 }} />

            <Box
              data-grist-add-circle=""
              style={{
                flex: "none",
                width: 28,
                height: 28,
                borderRadius: 14,
                display: "grid",
                placeItems: "center",
              }}
            >
              <IconPlus size={16} stroke={2} />
            </Box>

          </>
        )}
      </Box>

      <Modal
        opened={opened}
        onClose={close}
        title={fullLabel}
        closeButtonProps={{ "aria-label": t("Close") }}
      >
        <Divider size="xs" mb="xs" />
        <CreateSpaceForm />
      </Modal>
    </>
  );
}
