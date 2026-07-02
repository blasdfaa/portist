import {
  type CdkDragDrop,
  CdkDrag,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from "@angular/cdk/drag-drop";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
} from "@angular/core";
import { TranslocoPipe } from "@jsverse/transloco";

import type { GroupSort } from "../../ports/group-order";
import {
  DOCKER_GROUP,
  OTHER_GROUP,
  groupSize,
} from "../../ports/grouped-port";
import { PortInventoryService } from "../../ports/port-inventory-service";
import { PreferencesService } from "../preferences-service";

/** Пункт списка групп в модалке: id, подпись (+флаг перевода) и число портов. */
interface GroupItem {
  id: string;
  label: string;
  translate: boolean;
  count: number;
}

/**
 * Модалка настройки порядка групп (вариант «пины + авто-хвост»). Закреплённые
 * группы вверху перетаскиваются мышью и держат ручной порядок; остальные
 * сортируются автоматически по выбранному ключу. Набор групп динамический, поэтому
 * закреплённые, которых сейчас нет, всё равно показываются (можно открепить).
 * Монтируется условно из настроек; Esc и клик по фону закрывают.
 */
@Component({
  selector: "app-group-order-overlay",
  imports: [TranslocoPipe, CdkDropList, CdkDrag, CdkDragHandle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./group-order-overlay.html",
  styleUrl: "./group-order-overlay.css",
  host: { "(document:keydown.escape)": "onClose()" },
})
export class GroupOrderOverlay {
  private readonly inventory = inject(PortInventoryService);
  protected readonly prefs = inject(PreferencesService);

  /** Просьба закрыть модалку (владелец состояния — родитель). */
  readonly close = output<void>();

  /** Присутствующие сейчас группы с числом портов. */
  private readonly present = computed<GroupItem[]>(() =>
    this.inventory.groups().map((g) => ({
      id: g.id,
      label: g.label,
      translate: g.translate ?? false,
      count: groupSize(g),
    })),
  );

  /** Закреплённые — в пользовательском порядке; отсутствующие тоже показываем. */
  protected readonly pinned = computed<GroupItem[]>(() => {
    const byId = new Map(this.present().map((g) => [g.id, g]));
    return this.prefs
      .pinnedGroups()
      .map((id) => byId.get(id) ?? this.absentItem(id));
  });

  /** Остальные присутствующие группы, отсортированные по ключу авто-хвоста. */
  protected readonly tail = computed<GroupItem[]>(() => {
    const pinnedSet = new Set(this.prefs.pinnedGroups());
    const rest = this.present().filter((g) => !pinnedSet.has(g.id));
    // По id — как в group-order: у особых групп чистые «docker»/«other».
    const alpha = (a: GroupItem, b: GroupItem): number =>
      a.id.localeCompare(b.id);
    return this.prefs.groupSort() === "ports"
      ? [...rest].sort((a, b) => b.count - a.count || alpha(a, b))
      : [...rest].sort(alpha);
  });

  /** Пункт для закреплённой, но сейчас отсутствующей группы (число портов 0). */
  private absentItem(id: string): GroupItem {
    if (id === DOCKER_GROUP.id)
      return { id, label: DOCKER_GROUP.label, translate: true, count: 0 };
    if (id === OTHER_GROUP.id)
      return { id, label: OTHER_GROUP.label, translate: true, count: 0 };
    return { id, label: id, translate: false, count: 0 };
  }

  /** Переставили закреплённую группу — фиксируем новый порядок. */
  protected onDrop(event: CdkDragDrop<GroupItem[]>): void {
    const ids = [...this.prefs.pinnedGroups()];
    moveItemInArray(ids, event.previousIndex, event.currentIndex);
    this.prefs.setPinnedGroups(ids);
  }

  protected setSort(sort: GroupSort): void {
    this.prefs.setGroupSort(sort);
  }

  protected onClose(): void {
    this.close.emit();
  }
}
