import { rem } from "@mantine/core";

interface Props {
  size?: number | string;
}

/**
 * Фирменный знак Trello: синий скруглённый квадрат и две светлые
 * колонки разной высоты — списки на доске.
 *
 * Сделан по образцу остальных значков интеграций Docmost: своя
 * разметка, а не контурная заготовка из общего набора, — иначе он
 * выбивается из ряда, где у всех фирменные цвета.
 */
export function TrelloIcon({ size }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      style={{ width: rem(size), height: rem(size) }}
    >
      <rect width="24" height="24" rx="3.5" fill="#0079BF" />
      <rect x="4" y="4.5" width="6.5" height="15" rx="1.2" fill="#FFFFFF" />
      <rect x="13.5" y="4.5" width="6.5" height="9" rx="1.2" fill="#FFFFFF" />
    </svg>
  );
}

export default TrelloIcon;
