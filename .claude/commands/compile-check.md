# Compile Check

Verify that Rust code in the Tauri backend compiles without errors.

## Quick Check

```bash
cd /home/ktat/git/github/photoclove/src-tauri/src
cargo check
```

## When to Use

- After modifying any `.rs` files
- Before committing Rust changes
- When troubleshooting compilation errors
- As part of improvement workflow

## What to Check

1. **Compilation errors**: Must be fixed before committing
2. **Warnings**: Should be addressed following Rust best practices
3. **Dependency issues**: Ensure all imports resolve correctly

## Common Issues

- **Missing dependencies**: Check `Cargo.toml` in `src-tauri/`
- **Type mismatches**: Common after refactoring
- **Import paths**: Verify module paths match file structure
- **Lifetime issues**: Check borrow checker complaints

## Full Build (slower but thorough)

```bash
cd /home/ktat/git/github/photoclove/src-tauri
cargo build
```

Use this for more thorough checking including linking.
