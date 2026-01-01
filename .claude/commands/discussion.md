# Feature Discussion

Create a new feature proposal for discussion before implementation.

## Process

1. **Determine task number**:
   ```bash
   ls improvement/done/*.md | sort -V | tail -1
   ```
   Extract the number and add 1 for the new proposal

2. **Create proposal file**: `improvement/$number.md`

3. **Structure the discussion** with these sections:

## Proposal Template

```markdown
# Feature Name

## Overview
Brief description of the feature and its purpose

## User Impact
- Who benefits from this feature?
- How does it improve their workflow?
- What pain points does it solve?

## Influence on Existing Features

### Compatibility
- Will this break existing features?
- What features interact with this?
- Migration needed for existing users?

### Related Features
- List interacting features (use `docs/terms.md` for component names)
- Check `docs/feature-documentation-index.md` for related documentation

## Implementation Approach

### Architecture
- DDD pattern: Which domain entities affected?
- State management: New context or hooks needed?
- Backend: New Tauri commands? Database changes?

### Source Code Changes

**Frontend**:
- `src/components/ComponentName.jsx` - description
- `src/context/ContextName.jsx` - description

**Backend**:
- `src-tauri/src/module/file.rs` - description
- `src-tauri/src/entity/entity.rs` - description

**Database**:
- Schema changes if needed
- Migration strategy

## Dependencies & Risks

### External Dependencies
- New npm packages?
- New Rust crates?

### Performance
- Load time impact?
- Memory considerations?

### Security
- Input validation needed?
- File system access?
- SQL injection risks?

## Testing Strategy
- Manual testing steps
- Edge cases
- Performance benchmarks

## Open Questions
List unclear aspects needing clarification
```

## Best Practices

- Reference existing patterns in codebase
- Consider PhotoClove's dark theme and UI conventions
- Follow DDD architecture principles
- Think about backwards compatibility
- Consider future extensibility

## References

- `docs/terms.md` - Standard terminology
- `docs/feature-documentation-index.md` - Related features
- `CLAUDE.md` - Development guidelines
