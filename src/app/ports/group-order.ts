import { type PortGroup, groupSize } from "./grouped-port";

/** Ключ авто-сортировки незакреплённого «хвоста» групп. */
export type GroupSort = "alpha" | "ports";

/**
 * Порядок отображения групп (вариант «пины + авто-хвост»).
 *
 * Набор групп динамический (по одному на процесс), поэтому явный тотальный
 * порядок не хранится. Пользователь закрепляет несколько групп в ручном порядке
 * (`pinned`, id в желаемом порядке), а всё остальное сортируется автоматически
 * по `sort`. Классификацию портов это не трогает — только отображение.
 *
 * @param groups группы в служебном порядке грузера
 * @param pinned id закреплённых групп в пользовательском порядке
 * @param sort   ключ авто-сортировки хвоста
 */
export function orderGroups(
  groups: PortGroup[],
  pinned: string[],
  sort: GroupSort,
): PortGroup[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  // Закреплённые — в порядке `pinned`, пропуская отсутствующие сейчас.
  const head = pinned
    .map((id) => byId.get(id))
    .filter((g): g is PortGroup => g !== undefined);

  const pinnedSet = new Set(pinned);
  const tail = groups.filter((g) => !pinnedSet.has(g.id));
  // Сортируем по id: у динамических групп он равен имени процесса, у особых —
  // «docker»/«other» (без префикса ключа перевода, что дало бы кривой алфавит).
  const byAlpha = (a: PortGroup, b: PortGroup): number =>
    a.id.localeCompare(b.id);
  tail.sort(
    sort === "ports"
      ? (a, b) => groupSize(b) - groupSize(a) || byAlpha(a, b)
      : byAlpha,
  );

  return [...head, ...tail];
}
