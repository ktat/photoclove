# CLAUDE.md - PhotoClove Development Guidelines

## ⚠️ 最頻出の問題 TOP5（必ず最初に確認）

以下は過去のセッション分析から最も頻繁に指摘される問題です：

1. **CSS変数を使う** - ハードコードNG
   - ❌ `fontSize: '14px'` → ✅ `var(--font-size-base)`
   - ❌ `padding: '8px'` → ✅ `var(--space-2)`
   - 詳細: `~/.claude/skills/photoclove-css-design-system/`

2. **600行制限を守る** - ファイルが大きくなったら分割
   - 機能ごとにモジュール分割を検討
   - 大きなコンポーネントはサブコンポーネントに分解

3. **ログは構造化** - console.log / println! は使わない
   - ❌ `console.log('error', data)` → ✅ `logger.error('Component', 'event', 'msg', data)`
   - ❌ `println!("error: {}", msg)` → ✅ `log::error!(target: "module", "event; msg={}", msg)`

4. **既存utilsを使う** - 実装前に必ず確認
   - FileUtils, DateUtils, StringUtils, PathUtils を確認
   - Unified Search API があるなら個別検索実装しない

5. **状態は不変に** - Reactの基本原則
   - ❌ `config.items.push(item)` → ✅ `setConfig(prev => ({...prev, items: [...prev.items, item]}))`

詳細な問題リスト（TOP20）は `docs/common-mistakes.md` を参照してください。

## 📋 Core Development Rules

### Logging
- **Frontend**: `import { logger } from '../services/LoggerService.js';`
- **Backend**: `log::info!(target: "module", "event; key={}", value);`
- **LogViewer**: すべてのログは LogViewer.jsx で確認可能

### Code Quality
- **DDD Architecture**: ドメイン層でビジネスロジックを分離
- **DRY Principle**: 共通ロジックは抽出して再利用
- **File Length**: 600行以下を維持
- **Task Verification**: 実装後は元の要件と照合

### Important Rules
- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary
- ALWAYS prefer editing existing files
- NEVER proactively create documentation files

## 🔧 Context-Specific Skills

以下の詳細ガイドラインは専門スキルとして分離されています：

- **CSS & Styling**: `.claude/skills/photoclove-css-design-system/`
- **Database Migrations**: `.claude/skills/photoclove-database-migrations/`
- **Debugging**: `.claude/skills/photoclove-debugging/`

## 🌐 Key Technical Notes

### Tauri External URLs
```javascript
import { openUrl } from '@tauri-apps/plugin-opener';
openUrl('https://example.com'); // ❌ target="_blank" doesn't work
```

### Testing
- Rust: `cargo check` in `src-tauri/src/`
- Frontend: `pnpm test`
- Lint: `pnpm lint` (hardcoded CSS検出含む)

### Terms & Naming
- 用語は `docs/terms.md` を参照
- 例: "photo grid" ではなく "PhotosList" を使用

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files unless explicitly requested.