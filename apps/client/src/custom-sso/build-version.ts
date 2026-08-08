// Номер нашей сборки поверх форка. Совпадает с тегом образа
// docmost-custom:vN — поднимать вручную при каждой сборке.
export const CUSTOM_BUILD = 20;

// Апстримные major.minor берём с сервера (он читает их из package.json),
// а патч-версию подставляем свою. Получается 0.95.<наша сборка>: видно и
// на какой версии Docmost стоим, и какая у нас сборка. Обновится Docmost
// до 0.96 — первые два числа поедут сами.
export function formatCustomVersion(upstream?: string): string | undefined {
  if (!upstream) return undefined;

  const parts = upstream.split(".");
  if (parts.length < 2) return upstream;

  return `${parts[0]}.${parts[1]}.${CUSTOM_BUILD}`;
}
