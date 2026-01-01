# Do Improvement

Execute pending improvement tasks from `improvement/*.md` files.

## Process

1. **List pending improvements**: Check `improvement/` directory for numbered `.md` files
2. **Read the task file**: Read the lowest numbered file to understand the task if `#number`(eg. #123) is not given, if `#number` is given, read the md file of the number.
3. **Create feature branch**:
   - Branch naming: `improvement-#-summary` (e.g., `improvement-135-css-modules`)
   - Branch from current branch
   ```bash
   git checkout -b improvement-#-summary
   ```
4. **Read related documentation**:
   - Check `docs/feature-documentation-index.md` for related documentation
   - Read any source files referenced in the task
5. **Rename task file**: Rename `$num.md` to `$num-summary.md` where summary describes the task
6. **Implement the task**: Make the required code changes following PhotoClove guidelines
7. **Commit changes**: Commit to the feature branch with proper commit message format
8. **Move to done**: Move the completed `.md` file to `improvement/done/`
9. **Check for more**: If more `.md` files exist in `improvement/`, ask if should continue

## Important Guidelines

- Follow PhotoClove code standards (see CLAUDE.md)
- Use dark theme colors: `var(--bg)`, `var(--text)`, never light backgrounds
- Use structured logging: `LoggerService.js` (frontend), `log::` macros (backend)
- Run `/compile-check` after Rust changes
- Keep files under 1000 lines
- Follow DDD architecture principles

## Context Management

- If the task file ends with "keep context", continue to next task
- Otherwise, clear context between tasks to start fresh
