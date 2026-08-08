import { Box, Text } from "@mantine/core";
import { Link } from "react-router-dom";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { getAvatarUrl } from "@/lib/config.ts";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";

// Плашка с названием фирмы в левом верхнем углу. Ведёт на главную —
// в Grist этот блок выполняет ту же роль, отдельная ссылка «Главная»
// в шапке не нужна.
//
// Это НЕ выпадающий список: воркспейс один, выбирать нечего. Всё, что
// раньше висело на этой плашке (настройки, участники, профиль, тема,
// выход), переехало в кружок пользователя справа.
//
// Собрана как одно целое: рамка и скругление у внешнего блока, внутри
// без зазора квадрат-иконка. overflow: hidden обрезает её левые углы
// по радиусу рамки, поэтому иконка выглядит частью плашки, а не
// вложенным квадратом.
//
// Адрес картинки строится через getAvatarUrl — в workspace.logo лежит
// не готовый URL, и подстановка его напрямую в src давала битую картинку.
export default function WorkspaceBadge() {
  const [workspace] = useAtom(workspaceAtom);

  if (!workspace) return null;

  const logoUrl = workspace.logo
    ? getAvatarUrl(workspace.logo, AvatarIconType.WORKSPACE_ICON)
    : "/icons/favicon-32x32.png";

  return (
    <Box
      component={Link}
      to="/home"
      title={workspace.name}
      aria-label={workspace.name}
      style={{
        display: "flex",
        alignItems: "stretch",
        height: 30,
        minWidth: 0,
        maxWidth: "100%",
        textDecoration: "none",
        color: "inherit",
        userSelect: "none",
        border: "1px solid var(--app-shell-border-color)",
        borderRadius: 4,
        overflow: "hidden",
        background: "var(--mantine-color-body)",
      }}
    >
      <img
        src={logoUrl}
        alt=""
        style={{
          width: 28,
          height: "100%",
          flex: "none",
          display: "block",
          objectFit: "cover",
        }}
      />

      <Box
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          minWidth: 0,
        }}
      >
        <Text fw={650} size="sm" lh={1} lineClamp={1}>
          {workspace.name}
        </Text>
      </Box>
    </Box>
  );
}
