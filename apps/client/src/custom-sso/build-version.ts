// Номер нашей сборки поверх форка — тот же, что в теге образа
// docmost-custom:vN. Приходит доводом сборки, а не правится руками:
// пока он был константой, я забывал его поднимать, и в настройках
// висела давно устаревшая цифра.
export const CUSTOM_BUILD: string =
  import.meta.env.VITE_CUSTOM_BUILD || "";

// Апстримные major.minor берём с сервера (он читает их из package.json),
// а патч-версию подставляем свою. Получается 0.95.<наша сборка>: видно и
// на какой версии Docmost стоим, и какая у нас сборка. Обновится Docmost
// до 0.96 — первые два числа поедут сами.
export function formatCustomVersion(upstream?: string): string | undefined {
  if (!upstream) return undefined;

  const parts = upstream.split(".");
  if (parts.length < 2) return upstream;

  // Собрали без номера — показываем версию апстрима как есть. Врать
  // чужой цифрой хуже, чем не показать свою.
  if (!CUSTOM_BUILD) return upstream;

  return `${parts[0]}.${parts[1]}.${CUSTOM_BUILD}`;
}
