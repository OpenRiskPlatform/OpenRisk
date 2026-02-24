// Типы для адаптера данных

// Базовые текстовые типы
type TextData = {
  type: "std.text";
  value: string;
  metadata?: Record<string, any>;
};
type TitleData = {
  type: "std.title";
  value: string;
  metadata?: Record<string, any>;
};
type SubtitleData = {
  type: "std.subtitle";
  value: string;
  metadata?: Record<string, any>;
};
type ParagraphData = {
  type: "std.paragraph";
  value: string;
  metadata?: Record<string, any>;
};

// Метки
type BadgeData = {
  type: "std.badge";
  value:
    | string
    | {
        text: string;
        variant?: "default" | "secondary" | "destructive" | "outline";
      };
  metadata?: Record<string, any>;
};

// Ссылки
type LinkData = {
  type: "std.link";
  value: { url: string; text: string };
  metadata?: Record<string, any>;
};
type UrlData = {
  type: "std.url";
  value: string;
  metadata?: Record<string, any>;
};

// Контакты
type EmailData = {
  type: "std.email";
  value: string;
  metadata?: Record<string, any>;
};
type PhoneData = {
  type: "std.phone";
  value: string;
  metadata?: Record<string, any>;
};
type AddressData = {
  type: "std.address";
  value: {
    country?: string;
    city?: string;
    street?: string;
    postalCode?: string;
  };
  metadata?: Record<string, any>;
};

// Данные
type DateData = {
  type: "std.date";
  value: string;
  metadata?: { format?: "full" | "date" | "time"; locale?: string };
};
type BooleanData = {
  type: "std.boolean";
  value: boolean;
  metadata?: Record<string, any>;
};

// Свойства
type PropertyData = {
  type: "std.property";
  value: { key: string; value: string | number };
  metadata?: Record<string, any>;
};

// Структуры
type ArrayData = {
  type: "std.array";
  value: AdapterData[];
  metadata?: { display?: "inline" | "block" };
};

type GridData = {
  type: "std.grid";
  value: AdapterData[];
  metadata?: { columns?: 1 | 2 | 3 | 4 };
};

type TableData = {
  type: "std.table";
  value: {
    headers: string[];
    rows: any[][];
  };
  metadata?: { variant?: "default" | "compact" };
};

type SectionData = {
  type: "std.section";
  value: {
    title?: string;
    content: AdapterData[];
  };
  metadata?: Record<string, any>;
};

// Объединенный тип
export type AdapterData =
  | TextData
  | TitleData
  | SubtitleData
  | ParagraphData
  | BadgeData
  | LinkData
  | UrlData
  | EmailData
  | PhoneData
  | AddressData
  | DateData
  | BooleanData
  | PropertyData
  | ArrayData
  | GridData
  | TableData
  | SectionData;

type TypeConverter<U> = U extends { type: infer T; value: infer V }
  ? T extends string
    ? Record<
        T,
        (
          data: V,
          componentsMapping: TypeConverter<AdapterData>,
          metadata?: Record<string, any>
        ) => React.ReactNode
      >
    : never
  : never;

export type ComponentMapping = TypeConverter<AdapterData>;

// type TypeConverter<U> = U extends { type: infer T; value: infer V }
//   ? [T, V]
//   : never;

// type AdapterDataTypes = TypeConverter<AdapterData>;
// export type ComponentMapping = Record<
//   AdapterDataTypes,
//   (
//     data: any,
//     componentsMapping: ComponentMapping,
//     metadata?: Record<string, any>
//   ) => React.ReactNode
// >;
