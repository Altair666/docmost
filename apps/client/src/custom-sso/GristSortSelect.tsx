import { Menu, Box } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

export type GristSort = "name" | "date" | "creator";

// Выбор сортировки — как у Grist (DocList.js, cssSortSelect):
//   без рамки и заливки, зелёный текст 14px начертанием 500,
//   зазор до стрелки 6px, при наведении цвет темнеет.
// Варианты у него ровно два: «по имени» и «по дате».
export default function GristSortSelect({
  value,
  onChange,
  withCreator = false,
}: {
  value: GristSort;
  onChange: (v: GristSort) => void;
  /** Показывать третий порядок — по создателю. Есть там, где в таблице
   *  есть столбец «Кем создано». */
  withCreator?: boolean;
}) {
  const { t } = useTranslation();

  const options: { value: GristSort; label: string }[] = [
    { value: "name", label: t("Sort by name") },
    { value: "date", label: t("Sort by date") },
    ...(withCreator
      ? [{ value: "creator" as GristSort, label: t("Sort by author") }]
      : []),
  ];

  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <Menu position="bottom-end" shadow="md" width={180}>
      <Menu.Target>
        <Box
          component="button"
          type="button"
          data-grist-sort=""
          style={{
            display: "inline-flex",
            alignItems: "center",
            columnGap: 6,
            border: "none",
            background: "none",
            padding: 0,
            font: "inherit",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {current.label}
          <IconChevronDown size={14} stroke={2} />
        </Box>
      </Menu.Target>

      <Menu.Dropdown>
        {options.map((o) => (
          <Menu.Item
            key={o.value}
            onClick={() => onChange(o.value)}
            data-current={o.value === value || undefined}
          >
            {o.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
