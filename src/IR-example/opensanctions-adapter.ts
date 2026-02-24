import type { AdapterData } from "./adapter";

/**
 * Адаптер для преобразования данных OpenSanctions в универсальный формат
 */
export class OpenSanctionsAdapter {
  /**
   * Конвертирует результат поиска OpenSanctions в формат с header и results
   */
  static adaptSearchResult(result: any): {
    header: AdapterData[];
    results: AdapterData[][];
  } {
    const header: AdapterData[] = [];

    // Заголовок с информацией о поиске
    header.push({
      type: "std.property",
      value: { key: "Запрос", value: result.query },
      metadata: {},
    });
    header.push({
      type: "std.property",
      value: { key: "Найдено", value: result.total.value.toString() },
      metadata: {},
    });
    header.push({
      type: "std.property",
      value: { key: "Время", value: result.timestamp },
      metadata: {},
    });

    // Обрабатываем каждый результат
    const results: AdapterData[][] = [];
    result.results?.forEach((item: any) => {
      const itemData = this.adaptResultItem(item);
      results.push(itemData);
    });

    return { header, results };
  }

  /**
   * Адаптирует отдельный элемент результата
   */
  private static adaptResultItem(item: any): AdapterData[] {
    const itemData: AdapterData[] = [];

    // 1. Заголовок
    itemData.push({
      type: "std.title",
      value: item.caption,
      metadata: {},
    });

    // 2. Topics как badges
    const topics = item.properties?.topics || [];
    if (topics.length > 0) {
      itemData.push({
        type: "std.array",
        value: topics.map((topic: string) => ({
          type: "std.badge",
          value: {
            text: topic,
            variant: this.getTopicBadgeVariant(topic),
          },
          metadata: {},
        })),
        metadata: { display: "inline" },
      });
    }

    // 3. Метаинформация в таблице
    const metaRows = [
      ["ID", item.id],
      ["Schema", item.schema],
      ["Score", item.score.toFixed(2)],
      ["Match", item.match ? "✓" : "✗"],
    ];

    if (item.first_seen) {
      metaRows.push([
        "First Seen",
        new Date(item.first_seen).toLocaleDateString(),
      ]);
    }
    if (item.last_seen) {
      metaRows.push([
        "Last Seen",
        new Date(item.last_seen).toLocaleDateString(),
      ]);
    }
    if (item.last_change) {
      metaRows.push([
        "Last Change",
        new Date(item.last_change).toLocaleDateString(),
      ]);
    }
    if (item.datasets?.length > 0) {
      metaRows.push(["Datasets", item.datasets.join(", ")]);
    }

    itemData.push({
      type: "std.table",
      value: {
        headers: ["Field", "Value"],
        rows: metaRows,
      },
      metadata: { variant: "compact" },
    });

    // 4. Properties Section
    if (item.properties && Object.keys(item.properties).length > 0) {
      const gridItems = this.adaptPropertiesAsGrid(item.properties);
      if (gridItems.length > 0) {
        itemData.push({
          type: "std.section",
          value: {
            title: "Properties",
            content: [
              {
                type: "std.grid",
                value: gridItems,
                metadata: { columns: 2 },
              },
            ],
          },
          metadata: {},
        });
      }
    }

    // 5. Notes Section (если есть)
    const notes = item.properties?.notes || [];
    if (notes.length > 0) {
      const notesContent = notes.map((note: string) => ({
        type: "std.paragraph",
        value: note,
        metadata: {},
      }));

      itemData.push({
        type: "std.section",
        value: {
          title: "Notes",
          content: notesContent,
        },
        metadata: {},
      });
    }

    // 6. Source Section (если есть)
    const sourceUrl = item.properties?.sourceUrl?.[0];
    if (sourceUrl) {
      itemData.push({
        type: "std.section",
        value: {
          title: "Source",
          content: [
            {
              type: "std.link",
              value: {
                url: sourceUrl,
                text: "View source",
              },
              metadata: {},
            },
          ],
        },
        metadata: {},
      });
    }

    return itemData;
  }

  /**
   * Определяет вариант badge для topic
   */
  private static getTopicBadgeVariant(topic: string): string {
    if (topic.includes("crime") || topic.includes("wanted"))
      return "destructive";
    if (topic.includes("war")) return "destructive";
    if (topic.includes("pep") || topic.includes("role")) return "default";
    if (topic.includes("poi")) return "secondary";
    return "outline";
  }

  /**
   * Адаптирует properties в формат grid
   */
  private static adaptPropertiesAsGrid(
    properties: Record<string, any[]>
  ): AdapterData[] {
    const gridItems: AdapterData[] = [];

    // Пропускаем topics и notes - они уже обработаны
    const skipKeys = ["topics", "notes", "sourceUrl"];

    for (const [key, values] of Object.entries(properties)) {
      if (skipKeys.includes(key) || !values || values.length === 0) {
        continue;
      }

      // Если значений несколько, показываем список
      if (values.length > 1) {
        gridItems.push({
          type: "std.property",
          value: {
            key: this.humanizeKey(key),
            value: values.join(", "),
          },
          metadata: {},
        });
      } else {
        // Одно значение - простое свойство
        gridItems.push({
          type: "std.property",
          value: {
            key: this.humanizeKey(key),
            value: values[0],
          },
          metadata: {},
        });
      }
    }

    return gridItems;
  }

  /**
   * Преобразует snake_case в человекочитаемый формат
   */
  private static humanizeKey(key: string): string {
    return key
      .split(/[_-]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
}
