# ESLint Rule: No Hardcoded Pixel Values

## Overview

PhotoClove uses a custom ESLint rule to detect and prevent hardcoded pixel values in CSS-in-JS styles. This ensures consistent use of the design system CSS variables.

## Rule Configuration

The rule is configured in `eslint.config.js` and detects hardcoded pixel values in style properties like:
- `padding`, `margin`
- `width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`
- `top`, `right`, `bottom`, `left`
- `gap`, `borderRadius`, `fontSize`, `lineHeight`

## Running ESLint

```bash
# Check for hardcoded pixel values
pnpm lint

# Auto-fix where possible (note: this rule only warns, doesn't auto-fix)
pnpm lint:fix

# Check specific files
pnpm eslint src/components/MyComponent.jsx
```

## Design System Mapping

When you see a warning about hardcoded pixel values, use these CSS variables instead:

### Spacing (padding, margin, gap, positioning)
- `4px` → `var(--space-1)`
- `8px` → `var(--space-2)`
- `12px` → `var(--space-3)`
- `16px` → `var(--space-4)`
- `20px` → `var(--space-5)`
- `24px` → `var(--space-6)`

### Border Radius
- `4px` → `var(--radius-sm)`
- `6px` → `var(--radius-md)`
- `8px` → `var(--radius-lg)`
- `12px` → `var(--radius-xl)`

### Font Sizes
- `9px` → `var(--font-size-2xs)`
- `11px` → `var(--font-size-xs)`
- `13px` → `var(--font-size-sm)`
- `14px` → `var(--font-size-base)`
- `16px` → `var(--font-size-lg)`
- `18px` → `var(--font-size-xl)`
- `20px` → `var(--font-size-2xl)`

## Examples

### ❌ Bad: Hardcoded values
```javascript
style={{
  padding: '8px',
  margin: '16px',
  borderRadius: '4px',
  fontSize: '14px'
}}
```

### ✅ Good: CSS variables
```javascript
style={{
  padding: 'var(--space-2)',
  margin: 'var(--space-4)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--font-size-base)'
}}
```

## Current Status

As of the latest check, there are ~111 hardcoded pixel values remaining in the codebase. The goal is to gradually replace these with CSS variables during regular development.

## Integration with CI/CD

Consider adding ESLint to your CI pipeline to prevent new hardcoded values:

```yaml
# Example GitHub Actions workflow
- name: Run ESLint
  run: pnpm lint
```

## Suppressing Warnings

If you have a legitimate reason to use hardcoded pixel values (rare cases):

```javascript
// eslint-disable-next-line no-restricted-syntax
style={{ width: '150px' }} // Special case: fixed width for specific component
```

However, it's strongly recommended to add new CSS variables to `src/styles/base.css` instead of using hardcoded values.