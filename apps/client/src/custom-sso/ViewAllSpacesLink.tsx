import { Anchor } from "@mantine/core";
import { Link } from "react-router-dom";
import { IconArrowRight } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useGetSpacesQuery } from "@/features/space/queries/space-query";

// Ссылка на список всех пространств. Оформлена как выбор сортировки у
// Grist (cssSortSelect в DocList.js): без рамки и заливки, 14px
// начертанием 500, зазор до значка 6px, отступов нет.
//
// Когда пространство одно, показывать нечего — список повторит карусель.
export default function ViewAllSpacesLink() {
  const { t } = useTranslation();
  const { data } = useGetSpacesQuery({ limit: 20 });

  if (!data?.items || data.items.length <= 1) return null;

  return (
    <Anchor
      component={Link}
      to="/spaces"
      underline="never"
      style={{
        display: "inline-flex",
        alignItems: "center",
        columnGap: 6,
        padding: 0,
        fontSize: 14,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {t("All spaces")}
      <IconArrowRight size={14} stroke={2} />
    </Anchor>
  );
}
