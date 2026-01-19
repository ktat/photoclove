---
name: js-development
description: JavaScript/TypeScript development guidelines for PhotoClove. IMPORTANT - This project uses pnpm (not npm or yarn). Use this skill when installing packages, running scripts, or managing dependencies.
---

# JavaScript Development

PhotoClove uses **pnpm** as its package manager. Never use npm or yarn.

## Package Manager: pnpm

**CRITICAL**: This project uses pnpm, not npm or yarn.

### Common Commands

| Task | Command |
|------|---------|
| Install all dependencies | `pnpm install` |
| Add a package | `pnpm add <package>` |
| Add a dev dependency | `pnpm add -D <package>` |
| Remove a package | `pnpm remove <package>` |
| Run a script | `pnpm run <script>` or `pnpm <script>` |
| Update packages | `pnpm update` |
| Check outdated | `pnpm outdated` |

### Build & Development

```bash
# Development server (frontend only)
pnpm dev

# Build for production
pnpm build

# Run Tauri development (full app)
pnpm tauri dev

# Build Tauri app
pnpm tauri build
```

### Vite Commands

```bash
# Build with vite directly
pnpm vite build

# Development build (for debugging)
pnpm vite build --mode development

# Preview production build
pnpm vite preview
```

## Project Structure

```
/
├── src/                    # Frontend (React/Vite)
│   ├── App/               # Main application components
│   ├── components/        # Reusable components
│   ├── context/           # React contexts
│   ├── domain/            # Domain models
│   ├── hooks/             # Custom hooks
│   ├── services/          # Service layer
│   └── styles/            # CSS files
├── src-tauri/             # Backend (Rust/Tauri)
├── public/                # Static assets
├── package.json           # pnpm package config
└── pnpm-lock.yaml         # pnpm lockfile
```

## Frontend Tech Stack

- **Framework**: React 18
- **Build Tool**: Vite 4.x
- **Desktop**: Tauri 2.x
- **State**: React Context + custom hooks
- **Styling**: CSS Modules + CSS Variables

## Common Development Tasks

### Adding a New Component

1. Create component file: `src/components/ComponentName.jsx`
2. Create CSS Module: `src/components/ComponentName.module.css`
3. Use CSS variables from `src/styles/base.css`
4. Import and use in parent component

### Running Tests

```bash
# Run tests (if configured)
pnpm test

# Run specific test file
pnpm test src/test/ViewMode.test.js
```

### Type Checking (if using TypeScript)

```bash
pnpm tsc --noEmit
```

## Troubleshooting

### "Module not found" errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules
pnpm install
```

### Lock file conflicts

```bash
# Regenerate lock file
rm pnpm-lock.yaml
pnpm install
```

### Cache issues

```bash
# Clear pnpm cache
pnpm store prune
```

## Important Reminders

1. **Always use pnpm** - Never use `npm` or `yarn` commands
2. **Check package.json** - Before adding new dependencies
3. **Use CSS variables** - Never hardcode colors/sizes
4. **Use CSS Modules** - For component-specific styles
5. **Follow logging standards** - Use `logger` service, not `console.log`
