import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * Универсальные React компоненты для отображения данных
 */

// Простой текст
export const ComponentText: React.FC<{ data: string }> = ({ data }) => (
  <span className="text-sm">{data}</span>
);

// Заголовок первого уровня
export const ComponentTitle: React.FC<{ data: string }> = ({ data }) => (
  <h2 className="text-2xl font-bold mb-4">{data}</h2>
);

// Подзаголовок второго уровня
export const ComponentSubtitle: React.FC<{ data: string }> = ({ data }) => (
  <h3 className="text-lg font-semibold mb-2">{data}</h3>
);

// Параграф текста
export const ComponentParagraph: React.FC<{ data: string }> = ({ data }) => (
  <p className="text-sm text-muted-foreground leading-relaxed">{data}</p>
);

// Badge - цветная метка
export const ComponentBadge: React.FC<{ 
  data: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}> = ({ data, variant = 'default' }) => (
  <Badge variant={variant}>{data}</Badge>
);

// Tag - простой тег (alias для badge но нейтральный)
export const ComponentTag: React.FC<{ data: string }> = ({ data }) => (
  <Badge variant="outline">{data}</Badge>
);

// Число
export const ComponentNumber: React.FC<{ data: number; format?: string }> = ({ data, format }) => {
  const formatted = format === 'percent' 
    ? `${(data * 100).toFixed(0)}%`
    : format === 'decimal'
    ? data.toFixed(2)
    : data.toString();
  
  return <span className="text-sm font-mono">{formatted}</span>;
};

// Валюта
export const ComponentCurrency: React.FC<{ 
  amount: number; 
  currency?: string;
  locale?: string;
}> = ({ amount, currency = 'USD', locale = 'en-US' }) => {
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency
  }).format(amount);
  
  return <span className="text-sm font-mono">{formatted}</span>;
};

// Дата
export const ComponentDate: React.FC<{ 
  date: string; 
  format?: 'full' | 'date' | 'time';
  locale?: string;
}> = ({ date, format = 'full', locale = 'ru-RU' }) => {
  if (!date) return <span className="text-sm text-muted-foreground">N/A</span>;
  
  const d = new Date(date);
  let formatted: string;
  
  if (format === 'date') {
    formatted = d.toLocaleDateString(locale);
  } else if (format === 'time') {
    formatted = d.toLocaleTimeString(locale);
  } else {
    formatted = d.toLocaleString(locale);
  }
  
  return <span className="text-sm text-muted-foreground">{formatted}</span>;
};

// Boolean
export const ComponentBoolean: React.FC<{ value: boolean }> = ({ value }) => (
  <span className="text-sm">{value ? '✓ Да' : '✗ Нет'}</span>
);

// URL - простая ссылка
export const ComponentUrl: React.FC<{ url: string }> = ({ url }) => (
  <a 
    href={url} 
    target="_blank" 
    rel="noopener noreferrer"
    className="text-sm text-blue-600 hover:underline break-all"
  >
    {url}
  </a>
);

// Link - ссылка с текстом
export const ComponentLink: React.FC<{ url: string; text: string }> = ({ url, text }) => (
  <a 
    href={url} 
    target="_blank" 
    rel="noopener noreferrer"
    className="text-sm text-blue-600 hover:underline"
  >
    {text}
  </a>
);

// Score - числовой показатель (0-1)
export const ComponentScore: React.FC<{ value: number }> = ({ value }) => {
  const percentage = Math.round(value * 100);
  const color = value >= 0.7 ? 'text-green-600' : value >= 0.4 ? 'text-yellow-600' : 'text-red-600';
  
  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm font-mono font-semibold ${color}`}>{value.toFixed(2)}</span>
      <div className="flex-1 max-w-[100px] h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all ${value >= 0.7 ? 'bg-green-600' : value >= 0.4 ? 'bg-yellow-600' : 'bg-red-600'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// Email
export const ComponentEmail: React.FC<{ email: string }> = ({ email }) => (
  <a 
    href={`mailto:${email}`}
    className="text-sm text-blue-600 hover:underline"
  >
    {email}
  </a>
);

// Phone
export const ComponentPhone: React.FC<{ phone: string }> = ({ phone }) => (
  <a 
    href={`tel:${phone}`}
    className="text-sm text-blue-600 hover:underline"
  >
    {phone}
  </a>
);

// Address
export const ComponentAddress: React.FC<{ 
  country?: string;
  city?: string;
  street?: string;
  postalCode?: string;
}> = ({ country, city, street, postalCode }) => (
  <div className="text-sm space-y-0.5">
    {street && <div>{street}</div>}
    {city && <div>{city}{postalCode ? `, ${postalCode}` : ''}</div>}
    {country && <div className="text-muted-foreground">{country}</div>}
  </div>
);

// Field - вертикальное поле (label сверху, value снизу)
export const ComponentField: React.FC<{ 
  label: string; 
  value: React.ReactNode;
}> = ({ label, value }) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs font-medium text-muted-foreground uppercase">{label}</span>
    <span className="text-sm">{value}</span>
  </div>
);

// Property - inline свойство (key: value в строку)
export const ComponentProperty: React.FC<{ 
  key_name: string; 
  value: React.ReactNode;
}> = ({ key_name, value }) => (
  <div className="flex items-center gap-2">
    <span className="text-sm font-medium">{key_name}:</span>
    <span className="text-sm text-muted-foreground">{value}</span>
  </div>
);

// Array - массив элементов
export const ComponentArray: React.FC<{ 
  items: React.ReactNode[];
  variant?: 'inline' | 'block';
  display?: 'inline';
}> = ({ items, variant = 'inline' }) => {
  if (variant === 'block') {
    return (
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index}>{item}</div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {items.map((item, index) => (
        <React.Fragment key={index}>{item}</React.Fragment>
      ))}
    </div>
  );
};

// List - список с маркерами
export const ComponentList: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul className="list-disc list-inside space-y-1">
    {items.map((item, index) => (
      <li key={index} className="text-sm">{item}</li>
    ))}
  </ul>
);

// Object - группа элементов
export const ComponentObject: React.FC<{ 
  children: React.ReactNode;
  variant?: 'vertical' | 'horizontal' | 'grid';
}> = ({ children, variant = 'vertical' }) => {
  const className = 
    variant === 'horizontal' ? 'flex flex-wrap gap-4 items-center' :
    variant === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' :
    'space-y-2';

  return <div className={className}>{children}</div>;
};

// Grid - сетка элементов
export const ComponentGrid: React.FC<{ 
  items: React.ReactNode[];
  columns?: 1 | 2 | 3 | 4;
}> = ({ items, columns = 3 }) => {
  const gridClass = 
    columns === 1 ? 'grid-cols-1' :
    columns === 2 ? 'grid-cols-1 md:grid-cols-2' :
    columns === 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' :
    'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
    
  return (
    <div className={`grid ${gridClass} gap-4`}>
      {items.map((item, index) => (
        <div key={index}>{item}</div>
      ))}
    </div>
  );
};

// Table - таблица
export const ComponentTable: React.FC<{ 
  headers: string[];
  rows: React.ReactNode[][];
  variant?: 'default' | 'compact';
}> = ({ headers, rows, variant = 'default' }) => {
  const isCompact = variant === 'compact';
  const cellPadding = isCompact ? 'p-1.5' : 'p-2';
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className={isCompact ? 'border-b border-muted' : 'border-b'}>
            {headers.map((header, index) => (
              <th key={index} className={`text-left ${cellPadding} font-medium text-xs ${isCompact ? 'text-muted-foreground' : ''}`}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={isCompact ? 'border-b border-muted/50' : 'border-b'}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className={cellPadding}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Section - секция с заголовком и контентом
export const ComponentSection: React.FC<{
  title?: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <div className="mt-6 space-y-3">
    {title && <h3 className="text-base font-semibold text-foreground">{title}</h3>}
    <div className="space-y-2">{children}</div>
  </div>
);

// Card - карточка контейнер
export const ComponentCard: React.FC<{ 
  title?: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <Card className="w-full">
    {title && (
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
    )}
    <CardContent className={title ? '' : 'pt-6'}>
      {children}
    </CardContent>
  </Card>
);
