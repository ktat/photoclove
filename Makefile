build:
	rm -rf src-tauri/target
	pnpm build dev

licenses:
	pnpm dlx license-checker --json --production --out public/licenses-npm.json
	cd src-tauri && cargo license --json > ../public/licenses-rust.json

# Check for duplicate code
check-duplicate:
	pnpm dlx jscpd src src-tauri/src --min-lines 5 --min-tokens 50

check-duplicate-rust:
	pnpm dlx jscpd src-tauri/src --min-lines 5 --min-tokens 50

check-duplicate-js:
	pnpm dlx jscpd src --min-lines 5 --min-tokens 50
