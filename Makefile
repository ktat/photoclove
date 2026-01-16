build:
	rm -rf src-tauri/target
	pnpm build dev

licenses:
	pnpm dlx license-checker --json --production --out public/licenses-npm.json
	cd src-tauri && cargo license --json > ../public/licenses-rust.json
