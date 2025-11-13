import React from 'react';
import type { ComponentMapping } from '@/types/adapter';
import {
  ComponentText,
  ComponentTitle,
  ComponentSubtitle,
  ComponentParagraph,
  ComponentBadge,
  ComponentDate,
  ComponentBoolean,
  ComponentUrl,
  ComponentLink,
  ComponentEmail,
  ComponentPhone,
  ComponentAddress,
  ComponentProperty,
  ComponentArray,
  ComponentGrid,
  ComponentTable,
  ComponentSection,
} from './base-components';

/**
 * Универсальный маппинг типов данных на React компоненты
 */
export const allComponentsMapping: ComponentMapping = {
  // Базовые типы текста
  'std.text': (data) => {
    return <ComponentText key={Math.random()} data={data} />;
  },

  'std.title': (data) => {
    return <ComponentTitle key={Math.random()} data={data} />;
  },

  'std.subtitle': (data) => {
    return <ComponentSubtitle key={Math.random()} data={data} />;
  },

  'std.paragraph': (data) => {
    return <ComponentParagraph key={Math.random()} data={data} />;
  },

  'std.badge': (data, _componentsMapping, _metadata) => {
    return (
      <ComponentBadge 
        key={Math.random()} 
        data={data.text || data} 
        variant={data.variant}
      />
    );
  },

  'std.section': (data, componentsMapping, _metadata) => {
    const content = data.content.map((item: any) => {
      const { type, value, metadata: itemMetadata } = item;
      return componentsMapping[type](value, componentsMapping, itemMetadata);
    });

    return (
      <ComponentSection key={Math.random()} title={data.title}>
        {content}
      </ComponentSection>
    );
  },

  'std.date': (data, _componentsMapping, metadata) => {
    return (
      <ComponentDate 
        key={Math.random()}
        date={data}
        format={metadata?.format}
        locale={metadata?.locale}
      />
    );
  },

  'std.boolean': (data) => {
    return <ComponentBoolean key={Math.random()} value={data} />;
  },

  'std.url': (data) => {
    return <ComponentUrl key={Math.random()} url={data} />;
  },

  'std.link': (data) => {
    return <ComponentLink key={Math.random()} url={data.url} text={data.text} />;
  },

  'std.email': (data) => {
    return <ComponentEmail key={Math.random()} email={data} />;
  },

  'std.phone': (data) => {
    return <ComponentPhone key={Math.random()} phone={data} />;
  },

  'std.address': (data) => {
    return (
      <ComponentAddress 
        key={Math.random()}
        country={data.country}
        city={data.city}
        street={data.street}
        postalCode={data.postalCode}
      />
    );
  },

  // Свойства
  'std.property': (data, componentsMapping, _metadata) => {
    const value = data.value?.type 
      ? componentsMapping[data.value.type](data.value.data, componentsMapping, data.value.metadata)
      : data.value;

    return (
      <ComponentProperty 
        key={Math.random()}
        key_name={data.key}
        value={value}
      />
    );
  },

  // Массив элементов
  'std.array': (data, componentsMapping, metadata) => {
    const items = data.map((item: any) => {
      if (typeof item === 'object' && item.type) {
        return componentsMapping[item.type](item.value, componentsMapping, item.metadata);
      }
      return componentsMapping['std.text'](item, componentsMapping, {});
    });

    return (
      <ComponentArray 
        key={Math.random()}
        items={items} 
        variant={metadata?.variant}
      />
    );
  },

  // Сетка элементов
  'std.grid': (data, componentsMapping, metadata) => {
    const items = data.map((item: any) => {
      if (typeof item === 'object' && item.type) {
        return componentsMapping[item.type](item.value, componentsMapping, item.metadata);
      }
      return componentsMapping['std.text'](item, componentsMapping, {});
    });

    return (
      <ComponentGrid 
        key={Math.random()}
        items={items} 
        columns={metadata?.columns}
      />
    );
  },

  // Таблица
  'std.table': (data, _componentsMapping, metadata) => {
    return (
      <ComponentTable 
        key={Math.random()}
        headers={data.headers}
        rows={data.rows}
        variant={metadata?.variant}
      />
    );
  },
};

/**
 * Рендерит данные используя маппинг компонентов
 */
export const renderData = (
  data: Array<{ type: string; value: any; metadata?: any }>,
  componentsMapping: ComponentMapping = allComponentsMapping
): React.ReactNode[] => {
  const result: React.ReactNode[] = [];

  for (const { type, value, metadata } of data) {
    const renderer = componentsMapping[type];
    if (renderer) {
      result.push(renderer(value, componentsMapping, metadata));
    } else {
      console.warn(`No renderer found for type: ${type}`);
    }
  }

  return result;
};
