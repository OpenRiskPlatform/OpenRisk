import React from 'react';
import type { ComponentMapping } from './adapter';
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
        const text = typeof data === 'object' ? data.text : data;
        const variant = typeof data === 'object' ? data.variant : undefined;
        return (
            <ComponentBadge
                key={Math.random()}
                data={text}
                variant={variant}
            />
        );
    },

    'std.section': (data, componentsMapping, _metadata) => {
        const mapping = componentsMapping as Record<string, Function>;
        const content = data.content.map((item: any) => {
            const { type, value, metadata: itemMetadata } = item;
            return mapping[type](value, componentsMapping, itemMetadata);
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
        const mapping = componentsMapping as Record<string, Function>;
        const rawValue = data.value as any;
        const value = rawValue?.type
            ? mapping[rawValue.type](rawValue.data, componentsMapping, rawValue.metadata)
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
        const mapping = componentsMapping as Record<string, Function>;
        const items = data.map((item: any) => {
            if (typeof item === 'object' && item.type) {
                return mapping[item.type](item.value, componentsMapping, item.metadata);
            }
            return mapping['std.text'](item, componentsMapping, {});
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
        const mapping = componentsMapping as Record<string, Function>;
        const items = data.map((item: any) => {
            if (typeof item === 'object' && item.type) {
                return mapping[item.type](item.value, componentsMapping, item.metadata);
            }
            return mapping['std.text'](item, componentsMapping, {});
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
    const mapping = componentsMapping as Record<string, Function>;
    const result: React.ReactNode[] = [];

    for (const { type, value, metadata } of data) {
        const renderer = mapping[type];
        if (renderer) {
            result.push(renderer(value, componentsMapping, metadata));
        } else {
            console.warn(`No renderer found for type: ${type}`);
        }
    }

    return result;
};