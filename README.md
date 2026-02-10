# Facilitate Studio

A 3D simulation editor for creating interactive tutorials and step-by-step guides with 3D models.

![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![Three.js](https://img.shields.io/badge/Three.js-0.160-green)
![Vite](https://img.shields.io/badge/Vite-5-purple)

---

## Features

- 🎨 **3D Model Import** - Support for GLB, GLTF, FBX, and OBJ formats
- 🎬 **Simulation Steps** - Create info cards and move-item animations
- 🎥 **Live Preview** - Preview simulations with smooth camera animations
- 💾 **Local Persistence** - Projects saved in IndexedDB (no server required)
- ↩️ **Undo/Redo** - Full undo/redo support with keyboard shortcuts
- 🎯 **Child Selection** - Select and manipulate individual parts of imported models

---

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/facilitate-studio.git
cd facilitate-studio

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

---

## Development Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix auto-fixable ESLint issues |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting without changes |
| `npm run test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

---

## Project Structure

```
src/
├── components/           # React components
│   ├── scene/           # Three.js scene components (ImportedModel, etc.)
│   └── preview/         # Preview mode components
├── contexts/            # React contexts
│   └── PopupContext.tsx # Global popup/notification system
├── hooks/               # Custom React hooks
│   ├── useModelUpload.ts
│   ├── useProjects.ts
│   ├── useUndoRedo.ts
│   └── undoRedo/        # Undo/redo command implementations
├── pages/               # Route-level page components
│   ├── HomePage.tsx
│   ├── EditorPage.tsx
│   └── PreviewPage.tsx
├── persistence/         # IndexedDB operations
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
└── test/                # Test setup and utilities
```

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | React 18 |
| **Language** | TypeScript 5.3 (strict mode) |
| **3D Rendering** | Three.js 0.160 via @react-three/fiber & @react-three/drei |
| **Routing** | react-router-dom 7 |
| **Styling** | Tailwind CSS 3.4 |
| **Persistence** | IndexedDB via idb library |
| **Icons** | lucide-react |
| **Build Tool** | Vite 5 |
| **Testing** | Vitest + @testing-library/react |
| **Linting** | ESLint + Prettier |

---

## Development Workflow

### 1. Before Starting a Feature

Use the `/plan` command in Cursor to analyze the codebase and create an implementation plan.

### 2. During Development

- Write TypeScript with strict mode
- Follow patterns in existing code
- Add tests for new functionality
- Use PopupContext for error handling

### 3. After Completing a Feature

Run the `/post-feature` quality gate in Cursor, or manually:

```bash
npm run typecheck && npm run lint && npm run test
```

The `/post-feature` command also generates a Feature Review with your work timeline.

**Note**: All your work is automatically logged! Every prompt, commit, and push is captured. Feature Reviews are generated from these events and saved in `docs/worklog/digests/`.

### 4. Weekly Maintenance

Run `/health` in Cursor to audit the codebase for technical debt.

See [AI_WORKFLOW.md](./AI_WORKFLOW.md) for detailed documentation on all slash commands and the automatic worklog system.

---

## Coding Standards

### TypeScript

- Strict mode enabled - no implicit any
- Export types from where they're defined
- Use discriminated unions for type-safe branching
- JSDoc comments on all exported functions

### React

- Functional components only
- Custom hooks for complex logic
- Memoize callbacks passed as props
- Use refs to prevent stale closures

### Three.js

- Pre-allocate objects outside render loops
- Dispose resources on cleanup
- Memoize transform arrays
- Use React.memo with custom comparators

### Error Handling

- Show user-facing errors via PopupContext
- Never swallow errors silently
- Log technical details to console

---

## Testing

Tests are co-located with source files (e.g., `Button.tsx` → `Button.test.tsx`).

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test -- src/components/Button.test.tsx
```

### Test Structure

```typescript
describe('ComponentName', () => {
  describe('rendering', () => {
    it('renders correctly', () => { ... });
  });

  describe('interactions', () => {
    it('handles click', () => { ... });
  });

  describe('accessibility', () => {
    it('has correct ARIA attributes', () => { ... });
  });
});
```

---

## Styling

See [STYLE_GUIDE.md](./STYLE_GUIDE.md) for the complete design system including:

- Color palette (slate scale with blue accents)
- Typography (Inter + JetBrains Mono)
- Border radius system
- Glass panel effects
- Button and input variants

---

## Keyboard Shortcuts

### Editor

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Y` / `Cmd+Shift+Z` | Redo |
| `F` | Focus on selected object |
| `Home` / `0` | Reset camera view |
| `Delete` / `Backspace` | Delete selected object |
| `WASD` | Pan camera |
| `Q/E` | Rotate camera |

### 3D Navigation

| Action | Input |
|--------|-------|
| Rotate | Left-click drag |
| Pan | Right-click drag |
| Zoom | Scroll wheel |

---

## Browser Support

- Chrome 90+
- Firefox 90+
- Safari 15+
- Edge 90+

Requires WebGL 2.0 support.

---

## Contributing

1. Create a feature branch from `main`
2. Use `/plan` to design the implementation
3. Implement with tests
4. Run `/post-feature` quality gate
5. Create PR with clear description

---

## License

[Your License Here]
