import { Box, Text } from "@mantine/core";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";

// Плашка с названием фирмы в левом верхнем углу.
//
// Это НЕ кнопка и не выпадающий список: выбирать нечего, воркспейс один.
// Всё, что раньше висело на ней (настройки, участники, профиль, тема,
// выход), переехало в кружок пользователя справа — иначе эти пункты просто
// исчезли бы вместе со стрелкой.
//
// Собрана как в Grist: плашка логотипа и название — одно целое, общая грань
// без зазора, одинаковая высота, скругления только по внешним углам.
// Текст не выделяется, чтобы читалось как единый элемент, а не как надпись.
export default function WorkspaceBadge() {
  const [workspace] = useAtom(workspaceAtom);

  if (!workspace) return null;

  return (
    <Box
      style={{
        display: "flex",
        alignItems: "stretch",
        height: 30,
        minWidth: 0,
        userSelect: "none",
      }}
      title={workspace.name}
    >
      <Box
        style={{
          width: 30,
          height: 30,
          flex: "none",
          borderRadius: "4px 0 0 4px",
          overflow: "hidden",
          display: "grid",
          placeItems: "center",
          background: "var(--mantine-color-body)",
        }}
      >
        <img
          src={workspace.logo || "/icons/favicon-32x32.png"}
          alt=""
          width={30}
          height={30}
          style={{ display: "block", objectFit: "cover" }}
        />
      </Box>

      <Box
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          minWidth: 0,
          border: "1px solid var(--app-shell-border-color, #e8e8e8)",
          borderLeft: 0,
          borderRadius: "0 4px 4px 0",
          background: "var(--mantine-color-body)",
        }}
      >
        <Text fw={650} size="sm" lh={1} lineClamp={1}>
          {workspace.name}
        </Text>
      </Box>
    </Box>
  );
}
