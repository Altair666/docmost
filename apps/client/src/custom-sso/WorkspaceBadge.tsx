import { Box, Text } from "@mantine/core";
import { Link } from "react-router-dom";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";

// Плашка с названием фирмы в левом верхнем углу. Ведёт на главную —
// в Grist этот блок выполняет ту же роль, поэтому отдельной ссылки
// «Главная» в шапке нет.
//
// Иконку рисует CustomAvatar — тот же компонент, которым Docmost
// показывает иконку воркспейса в настройках. Это важно: пока логотип
// не загружен, там не пусто, а сгенерированные инициалы на цветном
// квадрате. Своя картинка-заглушка показывала бы не то, что в настройках,
// и расходилась бы при любой загрузке логотипа.
//
// Собрана как одно целое: рамка и скругление у внешнего блока, иконка
// внутри вплотную, radius={0} и overflow: hidden — левые углы обрезаются
// по радиусу рамки, а не рисуются отдельно.
// compact: свёрнутый вид — остаётся только иконка, но ссылка на главную
// сохраняется, поэтому по ней по-прежнему можно кликнуть.
export default function WorkspaceBadge({ compact = false }: { compact?: boolean }) {
  const [workspace] = useAtom(workspaceAtom);

  if (!workspace) return null;

  return (
    <Box
      component={Link}
      to="/home"
      title={workspace.name}
      aria-label={workspace.name}
      style={{
        display: "flex",
        alignItems: "stretch",
        // 32px в обоих видах — ровно как логотип Grist (32x32 с рамкой).
        height: 32,
        // Свёрнутый вид — КВАДРАТ 32x32, а не растянутая пилюля.
        // Развёрнутый — во всю ячейку: ячейка сама держит отступы по 16px,
        // и внутри остаётся 208px, как у Grist (x=16..224 при панели 240).
        width: compact ? 32 : "100%",
        flex: compact ? "none" : undefined,
        minWidth: 0,
        maxWidth: "100%",
        textDecoration: "none",
        color: "inherit",
        userSelect: "none",
        // Рамка есть в обоих видах: у Grist свёрнутый логотип — такой же
        // квадрат с обводкой 1px #e8e8e8, просто скруглённый со всех сторон.
        border: "1px solid var(--app-shell-border-color)",
        borderRadius: 4,
        overflow: "hidden",
        // Своего фона нет: он делал левую ячейку светлее правой части
        // шапки. Цвет задаёт сама шапка.
        background: "transparent",
      }}
    >
      <CustomAvatar
        avatarUrl={workspace.logo}
        name={workspace.name}
        type={AvatarIconType.WORKSPACE_ICON}
        variant="filled"
        // 30 = 32 внешних минус рамка сверху и снизу: иконка заполняет
        // квадрат вплотную, как тёмная плитка логотипа у Grist.
        size={30}
        radius={0}
        style={{
          flex: "none",
          // Тонкая черта между плиткой и названием: в Grist у плитки логотипа
          // рамка со всех сторон, а у поля с именем левой нет — на стыке
          // остаётся линия в 1px.
          borderRight: compact ? "none" : "1px solid var(--app-shell-border-color)",
        }}
      />

      {!compact && (
        <Box
          style={{
            display: "flex",
            alignItems: "center",
            // 16px слева от иконки и 8px справа — отступы имени фирмы в Grist.
            padding: "0 8px 0 16px",
            minWidth: 0,
          }}
        >
          <Text fw={500} fz={13} lh={1} lineClamp={1}>
            {workspace.name}
          </Text>
        </Box>
      )}
    </Box>
  );
}
