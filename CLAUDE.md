# Improvement WorkFlow

If I say "do improvement", do the following.

Read files under `improvement/*.md` order by file name as int.
And then do the task in the file.
Before starting task, do current steps

1. create branch `improvement-#-summary` (ex. `improvement-10-improve-ui`) from current branch
2. read the docs/feature-documentation-index.md. and read related document and source code.
3.  re-write the md file to include the following:
    - How do you implement the task? 
    - Which source code you will change
4. review document using another claude agent

When you finished task, `*.md` file which you did should be moved to `improvement/done` directory.
At last commit your changes to the branch if my permission is got.

If `improvement/*.md` are left, repeat this step and clear context if "keep context" is not written at the last line of `*.md` file.

ultra think

# Update Document WorkFlow

If I say "update docs", do the following.

Read "docs/.current-docs-sha" and get commit sha hash.
Check difference from it to latest, update document under docs and README\*.md.
After finishing document update, commit your changes and update "docs/.current-docs-sha" with latest commit sha hash and then commit "docs/.current-docs-sha" at last.

Note that: You carefully check whether the update of docs/feature-documentation-index.md is required or not.

# Compile check

If I say `compile check`, do the follwoing.

You should check `cd src-tauri/src/` and `cargo check` when you change `*.rs` files.
