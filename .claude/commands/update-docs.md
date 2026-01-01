# Update Documentation

Update PhotoClove documentation to match latest code changes.

## Process

1. **Read baseline SHA**:
   ```bash
   cat docs/.current-docs-sha
   ```
   This contains the commit hash from the last documentation update

2. **Identify changes**:
   ```bash
   git log {old_sha}..HEAD --oneline --name-status
   ```
   Review which files changed and what features were added/modified

3. **Update documentation**:
   - Review and update files in `docs/` directory
   - Update `README*.md` files as needed
   - **Carefully check** if `docs/feature-documentation-index.md` needs updates
   - Update `docs/guides/troubleshooting-guide.md` for new bugs/fixes
   - Use terminology from `docs/terms.md` for consistency

4. **Commit documentation updates**:
   ```bash
   git add docs/ README*.md
   git commit -m "docs: Update documentation for [changes]"
   ```

5. **Update baseline SHA**:
   ```bash
   git rev-parse HEAD > docs/.current-docs-sha
   git add docs/.current-docs-sha
   git commit -m "docs: Update .current-docs-sha"
   ```

## What to Document

Focus on:
- **New features**: Add to feature-documentation-index.md
- **Bug fixes**: Add to troubleshooting-guide.md if user-facing
- **API changes**: Update affected documentation
- **Breaking changes**: Clearly document migration steps
- **Architecture changes**: Update architecture documentation
- **Deprecated features**: Mark as deprecated with timeline

## Quality Checks

- Verify all code examples are up to date
- Check that file paths and line numbers are accurate
- Ensure cross-references between docs are valid
- Maintain existing documentation structure and style
