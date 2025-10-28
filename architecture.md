# Architecture Decision Log

## Project: Mocked View OpenRisk - Risk Analysis Application

### Overview
A modular, plugin-based risk analysis application built with React, TypeScript, TailwindCSS, and shadcn/ui. This is a frontend prototype with abstracted backend communication designed for future Tauri integration.

---

## Initial Architecture Decisions (2025-10-26)

### 1. Technology Stack

**Decision**: Use Vite + React + TypeScript + TailwindCSS + shadcn/ui
- **Rationale**: 
  - Vite provides fast development experience and optimal build performance
  - React for component-based UI
  - TypeScript for type safety and better DX
  - TailwindCSS for utility-first styling
  - shadcn/ui for high-quality, customizable components

**Decision**: Use TanStack Router for routing
- **Rationale**:
  - Type-safe routing with excellent TypeScript support
  - Better performance than React Router
  - File-based routing convention
  - Built-in code splitting

**Decision**: No state management library (React state + Context)
- **Rationale**:
  - Keeps architecture simple
  - Context API sufficient for our needs
  - Easier to migrate to other solutions if needed
  - Reduces bundle size

---

### 2. Plugin System Architecture

**Decision**: Plugin manifest-based system with `plugin.json` files
- **Rationale**:
  - Declarative plugin definition
  - Easy to validate and parse
  - Flexible schema that can evolve
  - Standard format similar to VS Code extensions

**Plugin Manifest Schema**:
```json
{
  "version": "string",
  "name": "string",
  "description": "string",
  "authors": [{ "name": "string", "email": "string" }],
  "icon": "string",
  "license": "string",
  "entrypoint": "string",
  "settings": [{
    "name": "string",
    "type": "string | number | boolean",
    "title": "string",
    "description": "string",
    "default": "any"
  }],
  "inputs": [{
    "name": "string",
    "type": "string | number | boolean | list[T] | map[K,V]",
    "optional": "boolean",
    "title": "string",
    "description": "string"
  }]
}
```

**Decision**: Frontend-only plugin management
- **Rationale**:
  - Backend handles actual plugin execution
  - Frontend only configures plugins and displays results
  - Clear separation of concerns
  - Security: arbitrary code execution isolated to backend

**Decision**: Mock plugin system for prototype
- **Rationale**:
  - Allows frontend development without backend
  - Dropdown menu with predefined mock plugins
  - Easy to test UI/UX flows
  - Mock plugins: Open Sanctions, Credit Check, Identity Verify, Fraud Detection

---

### 3. Backend Communication Abstraction

**Decision**: Abstract backend interface with multiple implementations
- **Rationale**:
  - Future-proof for Tauri integration
  - Easy to swap implementations (mock → HTTP → Tauri IPC)
  - Testable without real backend
  - Supports event-driven communication

**Interface Design**:
```typescript
abstract class BackendClient {
  // Execute plugin with inputs
  abstract executePlugin(pluginId: string, inputs: any): Promise<any>
  
  // Subscribe to backend events/messages
  abstract subscribeToEvents(callback: (event: BackendEvent) => void): void
  
  // Get plugin execution status
  abstract getPluginStatus(pluginId: string): Promise<PluginStatus>
  
  // Unsubscribe from events
  abstract unsubscribe(): void
}
```

**Initial Implementation**: MockBackendClient
- In-memory simulation
- Simulated async delays
- Mock event generation
- Easy debugging

**Future Implementation**: TauriBackendClient (stub created)
- Uses Tauri IPC for communication
- Listens to Tauri events
- Type-safe command invocation

---

### 4. Settings Management

**Decision**: Abstract settings store with in-memory implementation
- **Rationale**:
  - Decouples settings logic from storage mechanism
  - Easy to migrate to LocalStorage, IndexedDB, or backend API
  - Testable with mock implementations
  - Consistent API across application

**Settings Structure**:
- **Global Settings**: Application-wide configuration
- **Plugin Settings**: Per-plugin configuration defined in manifest

**Interface Design**:
```typescript
interface SettingsStore {
  // Global settings
  getGlobalSettings(): GlobalSettings
  setGlobalSettings(settings: Partial<GlobalSettings>): void
  
  // Plugin settings
  getPluginSettings(pluginId: string): PluginSettings
  setPluginSettings(pluginId: string, settings: PluginSettings): void
  
  // Reset
  resetToDefaults(): void
}
```

**Decision**: Use React Context for settings access
- **Rationale**:
  - Avoid prop drilling
  - Easy hook-based access (`useSettings()`)
  - Re-renders only affected components
  - Standard React pattern

---

### 5. Dynamic Form System

**Decision**: Plugin-driven dynamic form generation
- **Rationale**:
  - Each plugin declares required inputs in manifest
  - Form automatically generated from plugin inputs
  - User can add/remove fields dynamically
  - Supports various field types (string, number, boolean, list, map)

**Form Features**:
- Field types: `string`, `number`, `boolean`, `list[T]`, `map[K,V]`
- Optional vs required fields
- Field validation based on type
- "+" button to add custom fields
- Field configuration UI

**Initial Form Configuration**:
- Default fields: name, surname (from first plugin's inputs)
- User can extend with additional fields
- Form state managed in React component state

---

### 6. UI/UX Design Decisions

**Decision**: Obsidian-style settings modal
- **Rationale**:
  - Familiar pattern for power users
  - Clear categorization (General, Plugins, Appearance)
  - Sidebar navigation + content panel
  - Modal overlay, not a separate page

**Decision**: Entry screen with centered branding
- **Rationale**:
  - Clear starting point
  - Simple, focused design
  - Settings access always available (top-right)

**Decision**: Report page with form-first layout
- **Rationale**:
  - Input at top (most important)
  - Results below (secondary)
  - Workflow: configure → execute → view results

**Decision**: Use shadcn/ui components
- **Rationale**:
  - High-quality, accessible components
  - Fully customizable (copied into project)
  - No runtime dependency
  - Consistent design system

---

### 7. Project Structure

**Decision**: Feature-based + layer-based hybrid structure
- **Rationale**:
  - Core abstractions in `/core`
  - Reusable components in `/components`
  - Routes in `/routes` (TanStack Router convention)
  - Clear separation of concerns
  - Easy to navigate

**Key Directories**:
- `/src/core`: Business logic, abstractions, interfaces
- `/src/components`: Reusable UI components
- `/src/routes`: Route definitions (TanStack Router)
- `/src/pages`: Page-level components
- `/src/hooks`: Custom React hooks
- `/src/lib`: Utilities and helpers
- `/plugins-mock`: Mock plugin manifests

---

### 8. Naming Conventions

**Files**:
- Pages: `*Page.tsx`
- Layouts: `*Layout.tsx`
- UI Components: lowercase with hyphens (shadcn convention)
- Feature Components: PascalCase
- Hooks: `use*.ts`
- Classes/Services: PascalCase

**Components**:
- PascalCase for all React components
- Descriptive names (e.g., `DynamicFormField`, `PluginSettingsForm`)

---

## Future Considerations

### Phase 2: Backend Integration
- Implement HTTP-based BackendClient
- WebSocket for real-time events
- Authentication/authorization
- API rate limiting

### Phase 3: Tauri Integration
- Implement TauriBackendClient
- Local plugin execution
- File system access for plugin storage
- Native OS integration

### Phase 4: Advanced Features
- Plugin marketplace
- Plugin versioning and updates
- Result visualization components
- Export/import configurations
- Collaborative features

---

## Technical Debt & Risks

1. **Plugin Manifest Schema**: Not strictly defined, may need versioning strategy
2. **Type Safety**: Plugin inputs/outputs are `any` - need better typing
3. **Form Validation**: Basic validation needed for user inputs
4. **Error Handling**: Need comprehensive error boundaries and user feedback
5. **Performance**: Large result sets may need virtualization
6. **Security**: Plugin settings may contain sensitive data (API keys)

---

## Dependencies

### Core
- `react`: ^18.3.1
- `react-dom`: ^18.3.1
- `typescript`: ^5.6.2

### Routing
- `@tanstack/react-router`: ^1.x
- `@tanstack/router-devtools`: ^1.x
- `@tanstack/router-vite-plugin`: ^1.x

### Styling
- `tailwindcss`: ^3.x
- `autoprefixer`: ^10.x
- `postcss`: ^8.x

### Build
- `vite`: ^7.x
- `@vitejs/plugin-react`: ^4.x

### UI Components (to be added)
- shadcn/ui components (installed via CLI)

---

## Development Workflow

1. **Phase 1**: Core architecture and mock system ← Current
2. **Phase 2**: UI implementation with mock data
3. **Phase 3**: Backend abstraction refinement
4. **Phase 4**: Real backend integration
5. **Phase 5**: Tauri integration

---

*Last updated: 2025-10-26*
