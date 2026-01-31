# 日記機能 (Daily Journal)

## Overview
日付ごとに日記（テキストメモ）を記録・表示する機能を追加します。写真のコメント機能は個別写真に対するメモですが、日記機能は日付全体に対するメモとして機能し、その日の出来事や思い出を記録できます。

## User Impact

### Who benefits
- **個人利用ユーザー**: 写真と共にその日の出来事を記録したい人
- **家族の記録係**: 家族の思い出を写真とテキストで残したい人
- **趣味の記録者**: 旅行やイベントの詳細を日記として残したい人

### Workflow improvement
- **統合された記録**: 写真とテキストを一緒に管理できる
- **振り返りやすい**: カレンダービューで日記のある日が一目でわかる
- **検索可能**: 日記の内容から特定の日を見つけられる

### Pain points solved
- 写真だけでは後から状況を思い出しにくい
- 個別写真のコメントではその日全体の記録として不十分
- 別のアプリで日記を書くと写真との関連が失われる
- 日記アプリと写真アプリを行き来する手間

## Influence on Existing Features

### Compatibility
**Breaking Changes**: なし - 既存機能への追加機能

**Interacting Features**:
- **DateList** (`src/App/DateList.jsx`) - カレンダービューで日記のある日を視覚的に表示
- **PhotosList** (`src/App/PhotosList.jsx`) - 日付ビューで日記を表示・編集
- **Search** - 日記のテキスト内容を検索対象に含める
- **Photo Comment** (`src/App/PhotosList/PhotoOption/PhotoInfo.jsx`) - 既存のコメント機能と類似のUI/UX

**Migration**: なし - 新規テーブル追加のみ

### Related Features
- **Photo Comment System**: 個別写真のコメント（既存）と日記（新規）の違い
  - Photo Comment: 個別写真に対するメモ（`photo_metadata.comment`）
  - Daily Journal: 日付全体に対するメモ（新規 `daily_journal` テーブル）
- **Date Summary** (`date_summary` テーブル): 日付ごとの写真枚数を集計
  - 日記の有無フラグを追加して、カレンダー表示を強化
- **Search System**: テキスト検索に日記内容を追加
- **DateList Navigation**: 日記のある日をハイライト表示

## Implementation Approach

### Architecture

**DDD Pattern**:
- **Entity**: `DailyJournal` - 日記エンティティ（date, content, created_at, updated_at）
- **Value Object**: `JournalContent` - 日記本文（バリデーション、文字数制限）
- **Repository**: `JournalRepository` - 日記のCRUD操作
- **Domain Service**: なし（シンプルなCRUDのため不要）

**State Management**:
- 新規Context不要 - `PhotoContext` に日記状態を追加
- 新規Hook: `useJournal(date)` - 特定日付の日記取得・更新

**Backend**:
- 新規Tauriコマンド:
  - `get_journal(date: String) -> Result<Option<Journal>>`
  - `save_journal(date: String, content: String) -> Result<()>`
  - `delete_journal(date: String) -> Result<()>`
  - `search_journals(query: String) -> Result<Vec<JournalSearchResult>>`
- 新規テーブル: `daily_journal`

### Source Code Changes

#### Frontend

**1. PhotoContext拡張** (`src/context/PhotoContext.jsx`)
```javascript
const PhotoContext = createContext({
  // ... existing state
  currentJournal: null,
  setCurrentJournal: () => {},
});

// Add journal state to PhotoProvider
const [currentJournal, setCurrentJournal] = useState(null);
```

**2. 新規Hook** (`src/hooks/useJournal.js`)
```javascript
/**
 * Custom hook for managing daily journal entries
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Object} Journal data and operations
 */
export function useJournal(date) {
  const [journal, setJournal] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Load journal for the given date
  const loadJournal = useCallback(async () => {
    if (!date) return;

    setIsLoading(true);
    try {
      const result = await invoke('get_journal', { date });
      setJournal(result ? JSON.parse(result) : null);
    } catch (error) {
      logger.error('useJournal', 'load_error', 'Failed to load journal', { date, error });
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  // Save journal
  const saveJournal = useCallback(async (content) => {
    if (!date) return;

    try {
      await invoke('save_journal', { date, content });
      setJournal({ date, content, updated_at: new Date().toISOString() });
      setIsDirty(false);
      logger.info('useJournal', 'save_success', 'Journal saved', { date });
    } catch (error) {
      logger.error('useJournal', 'save_error', 'Failed to save journal', { date, error });
      throw error;
    }
  }, [date]);

  // Delete journal
  const deleteJournal = useCallback(async () => {
    if (!date || !journal) return;

    try {
      await invoke('delete_journal', { date });
      setJournal(null);
      logger.info('useJournal', 'delete_success', 'Journal deleted', { date });
    } catch (error) {
      logger.error('useJournal', 'delete_error', 'Failed to delete journal', { date, error });
      throw error;
    }
  }, [date, journal]);

  return {
    journal,
    isLoading,
    isDirty,
    setIsDirty,
    loadJournal,
    saveJournal,
    deleteJournal
  };
}
```

**3. 新規コンポーネント** (`src/components/DailyJournal.jsx`)
```javascript
/**
 * Daily Journal Editor Component
 * Displays and edits journal entry for a specific date
 */
function DailyJournal({ date, onClose }) {
  const { journal, isLoading, isDirty, setIsDirty, loadJournal, saveJournal, deleteJournal } = useJournal(date);
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadJournal();
  }, [date, loadJournal]);

  useEffect(() => {
    if (journal) {
      setContent(journal.content || '');
    } else {
      setContent('');
    }
  }, [journal]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveJournal(content);
      // Optionally close or show success message
    } catch (error) {
      // Show error message
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm('Delete this journal entry?')) {
      try {
        await deleteJournal();
        setContent('');
      } catch (error) {
        // Show error message
      }
    }
  };

  return (
    <div className="daily-journal">
      <div className="journal-header">
        <h3>Journal for {date}</h3>
        <button onClick={onClose}>Close</button>
      </div>

      <textarea
        className="journal-editor"
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setIsDirty(true);
        }}
        placeholder="Write about your day..."
        rows={15}
      />

      <div className="journal-actions">
        <button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className="save-button"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>

        {journal && (
          <button
            onClick={handleDelete}
            className="delete-button"
          >
            Delete
          </button>
        )}

        <div className="journal-meta">
          {journal?.updated_at && (
            <span>Last updated: {new Date(journal.updated_at).toLocaleString()}</span>
          )}
        </div>
      </div>
    </div>
  );
}
```

**4. PhotosList統合** (`src/App/PhotosList.jsx`)
- 日付ビューモードで日記エディタを表示
- "Open Journal" ボタンを追加（StatusBarまたはDirectoryMenuに）
- モーダルまたはサイドパネルで日記エディタを表示

```javascript
const [showJournalEditor, setShowJournalEditor] = useState(false);

// In render:
{showJournalEditor && viewModeObj.isDateMode() && (
  <DailyJournal
    date={currentDate}
    onClose={() => setShowJournalEditor(false)}
  />
)}
```

**5. DateList強化** (`src/App/DateList.jsx`)
- 日記のある日付にインジケーター表示（例: 📝 アイコン）
- `date_summary` から日記の有無を取得

```javascript
// In date list item render:
<div className="date-item">
  <span className="date-text">{dateObj.date}</span>
  <span className="photo-count">({dateObj.count})</span>
  {dateObj.has_journal && <span className="journal-indicator">📝</span>}
</div>
```

**6. Search統合** (`src/hooks/useSearch.js`, `src/components/SearchBar.jsx`)
- 検索オプションに "Search in Journals" チェックボックス追加
- 日記検索結果を表示（日付とマッチした部分のプレビュー）

#### Backend

**1. 新規Migration** (`src-tauri/src/repository/meta_db/migrations/005_create_daily_journal.sql`)
```sql
-- Create daily_journal table
CREATE TABLE IF NOT EXISTS daily_journal (
    date TEXT PRIMARY KEY,  -- YYYY-MM-DD format
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_daily_journal_date ON daily_journal(date);

-- Full-text search support for journal content
CREATE VIRTUAL TABLE IF NOT EXISTS daily_journal_fts USING fts5(
    date,
    content,
    content=daily_journal,
    content_rowid=rowid
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS daily_journal_fts_insert AFTER INSERT ON daily_journal BEGIN
    INSERT INTO daily_journal_fts(rowid, date, content) VALUES (new.rowid, new.date, new.content);
END;

CREATE TRIGGER IF NOT EXISTS daily_journal_fts_update AFTER UPDATE ON daily_journal BEGIN
    UPDATE daily_journal_fts SET date = new.date, content = new.content WHERE rowid = new.rowid;
END;

CREATE TRIGGER IF NOT EXISTS daily_journal_fts_delete AFTER DELETE ON daily_journal BEGIN
    DELETE FROM daily_journal_fts WHERE rowid = old.rowid;
END;
```

**2. date_summary拡張**
```sql
-- Add has_journal column to date_summary
ALTER TABLE date_summary ADD COLUMN has_journal INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_date_summary_has_journal ON date_summary(has_journal);
```

**3. 新規Entity** (`src-tauri/src/entity/journal.rs`)
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyJournal {
    pub date: String,           // YYYY-MM-DD
    pub content: String,
    pub created_at: String,     // ISO 8601
    pub updated_at: String,     // ISO 8601
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalSearchResult {
    pub date: String,
    pub snippet: String,        // Matched text snippet with context
    pub match_count: usize,     // Number of matches in this entry
}

impl DailyJournal {
    pub fn new(date: String, content: String) -> Self {
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        Self {
            date,
            content,
            created_at: now.clone(),
            updated_at: now,
        }
    }

    pub fn validate(&self) -> Result<(), String> {
        // Validate date format (YYYY-MM-DD)
        if !regex::Regex::new(r"^\d{4}-\d{2}-\d{2}$")
            .unwrap()
            .is_match(&self.date)
        {
            return Err("Invalid date format".to_string());
        }

        // Limit content length (e.g., 50,000 characters)
        if self.content.len() > 50_000 {
            return Err("Journal content too long (max 50,000 characters)".to_string());
        }

        Ok(())
    }
}
```

**4. Repository実装** (`src-tauri/src/repository/meta_db/sqlite/journal.rs`)
```rust
use crate::entity::journal::{DailyJournal, JournalSearchResult};
use rusqlite::{params, Connection, Result};

impl super::SQLite {
    /// Get journal entry for a specific date
    pub fn get_journal(&self, date: &str) -> Result<Option<DailyJournal>> {
        let conn = self.get_connection()?;

        let mut stmt = conn.prepare(
            "SELECT date, content, created_at, updated_at
             FROM daily_journal
             WHERE date = ?1"
        )?;

        let journal = stmt.query_row(params![date], |row| {
            Ok(DailyJournal {
                date: row.get(0)?,
                content: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        }).optional()?;

        Ok(journal)
    }

    /// Save or update journal entry
    pub fn save_journal(&self, date: &str, content: &str) -> Result<()> {
        let conn = self.get_connection()?;
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

        conn.execute(
            "INSERT INTO daily_journal (date, content, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?3)
             ON CONFLICT(date) DO UPDATE SET
                 content = excluded.content,
                 updated_at = excluded.updated_at",
            params![date, content, now],
        )?;

        // Update date_summary has_journal flag
        conn.execute(
            "UPDATE date_summary SET has_journal = 1 WHERE date = ?1",
            params![date],
        )?;

        log::info!(target: "journal", "save_journal; date={}; content_length={}", date, content.len());
        Ok(())
    }

    /// Delete journal entry
    pub fn delete_journal(&self, date: &str) -> Result<()> {
        let conn = self.get_connection()?;

        conn.execute("DELETE FROM daily_journal WHERE date = ?1", params![date])?;

        // Update date_summary has_journal flag
        conn.execute(
            "UPDATE date_summary SET has_journal = 0 WHERE date = ?1",
            params![date],
        )?;

        log::info!(target: "journal", "delete_journal; date={}", date);
        Ok(())
    }

    /// Search journals using FTS
    pub fn search_journals(&self, query: &str) -> Result<Vec<JournalSearchResult>> {
        let conn = self.get_connection()?;

        let mut stmt = conn.prepare(
            "SELECT date, snippet(daily_journal_fts, 1, '<mark>', '</mark>', '...', 30) as snippet,
                    COUNT(*) as match_count
             FROM daily_journal_fts
             WHERE daily_journal_fts MATCH ?1
             GROUP BY date
             ORDER BY rank"
        )?;

        let results = stmt
            .query_map(params![query], |row| {
                Ok(JournalSearchResult {
                    date: row.get(0)?,
                    snippet: row.get(1)?,
                    match_count: row.get(2)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        log::info!(target: "journal", "search_journals; query={}; results={}", query, results.len());
        Ok(results)
    }

    /// Get all dates with journals (for calendar highlighting)
    pub fn get_journal_dates(&self) -> Result<Vec<String>> {
        let conn = self.get_connection()?;

        let mut stmt = conn.prepare("SELECT date FROM daily_journal ORDER BY date DESC")?;

        let dates = stmt
            .query_map([], |row| row.get(0))?
            .collect::<Result<Vec<String>>>()?;

        Ok(dates)
    }
}
```

**5. Tauri Commands** (`src-tauri/src/commands/journal_commands.rs`)
```rust
use crate::app_state::AppState;
use crate::entity::journal::DailyJournal;

#[tauri::command]
pub fn get_journal(date: String, state: tauri::State<AppState>) -> Result<Option<String>, String> {
    log::info!(target: "journal_commands", "get_journal; date={}", date);

    let db = &state.meta_db;

    match db.get_journal(&date) {
        Ok(Some(journal)) => {
            serde_json::to_string(&journal)
                .map(Some)
                .map_err(|e| format!("Failed to serialize journal: {}", e))
        }
        Ok(None) => Ok(None),
        Err(e) => Err(format!("Failed to get journal: {}", e)),
    }
}

#[tauri::command]
pub fn save_journal(date: String, content: String, state: tauri::State<AppState>) -> Result<(), String> {
    log::info!(target: "journal_commands", "save_journal; date={}; content_length={}", date, content.len());

    // Validate
    let journal = DailyJournal::new(date.clone(), content.clone());
    journal.validate()?;

    let db = &state.meta_db;

    db.save_journal(&date, &content)
        .map_err(|e| format!("Failed to save journal: {}", e))
}

#[tauri::command]
pub fn delete_journal(date: String, state: tauri::State<AppState>) -> Result<(), String> {
    log::info!(target: "journal_commands", "delete_journal; date={}", date);

    let db = &state.meta_db;

    db.delete_journal(&date)
        .map_err(|e| format!("Failed to delete journal: {}", e))
}

#[tauri::command]
pub fn search_journals(query: String, state: tauri::State<AppState>) -> Result<String, String> {
    log::info!(target: "journal_commands", "search_journals; query={}", query);

    let db = &state.meta_db;

    match db.search_journals(&query) {
        Ok(results) => {
            serde_json::to_string(&results)
                .map_err(|e| format!("Failed to serialize results: {}", e))
        }
        Err(e) => Err(format!("Failed to search journals: {}", e)),
    }
}

#[tauri::command]
pub fn get_journal_dates(state: tauri::State<AppState>) -> Result<Vec<String>, String> {
    log::info!(target: "journal_commands", "get_journal_dates");

    let db = &state.meta_db;

    db.get_journal_dates()
        .map_err(|e| format!("Failed to get journal dates: {}", e))
}
```

**6. lib.rs登録** (`src-tauri/src/lib.rs`)
```rust
mod commands {
    // ... existing modules
    pub mod journal_commands;
}

// In tauri::Builder::default():
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    commands::journal_commands::get_journal,
    commands::journal_commands::save_journal,
    commands::journal_commands::delete_journal,
    commands::journal_commands::search_journals,
    commands::journal_commands::get_journal_dates,
])
```

#### Database

**Migration Strategy**:
1. 新規migration file: `005_create_daily_journal.sql`
2. 既存 `date_summary` テーブルに `has_journal` カラム追加
3. FTS5バーチャルテーブルで全文検索対応
4. トリガーでFTSインデックスを自動同期

**Schema Changes**:
```sql
-- New table
daily_journal (
    date TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
)

-- FTS virtual table
daily_journal_fts (
    date, content
)

-- Existing table modification
ALTER TABLE date_summary ADD COLUMN has_journal INTEGER DEFAULT 0;
```

## Dependencies & Risks

### External Dependencies
**None** - 全て既存の依存関係で実装可能
- SQLite FTS5: 既にSQLiteに含まれている
- chrono: 既に使用中
- serde/serde_json: 既に使用中

### Performance

**Database**:
- 日記テーブルは軽量（日付数 × 平均5KB = 数MB程度）
- FTS5インデックスで全文検索は高速（10,000エントリでも100ms以下）
- `has_journal` フラグで `date_summary` クエリへの影響最小

**UI**:
- 日記エディタはモーダル/パネルで表示（メイン画面への影響なし）
- テキストエリアの自動保存は debounce 処理（500ms）

**Memory**:
- 日記データは必要時のみロード（メモリ常駐しない）
- 1エントリ平均5KB × 表示中の1エントリのみ = 5KB程度

### Security

**Input Validation**:
- 日付形式検証（YYYY-MM-DD正規表現）
- 文字数制限（50,000文字まで）
- SQLインジェクション対策（prepared statements使用）
- XSS対策（ユーザー入力をそのまま表示しない）

**Data Storage**:
- 日記データはローカルDBに保存（プライバシー保護）
- 外部同期機能なし（将来的にオプション機能として追加可能）

**SQL Injection**:
- 全てのクエリで prepared statements 使用
- ユーザー入力を直接SQL文字列に埋め込まない

## Testing Strategy

### Manual Testing

**1. 基本CRUD操作**:
- [ ] 新規日記作成
- [ ] 日記編集
- [ ] 日記削除
- [ ] 日記のある日付を再度開いて内容が保存されているか確認

**2. UI/UX**:
- [ ] 日記エディタの開閉がスムーズか
- [ ] 保存中の状態表示が適切か
- [ ] 未保存の変更がある場合の警告（オプション）
- [ ] カレンダーで日記のある日が視覚的にわかるか

**3. 検索機能**:
- [ ] 日記内容でテキスト検索できるか
- [ ] 検索結果から該当日付に移動できるか
- [ ] 日本語/英語の検索が正しく動作するか

**4. パフォーマンス**:
- [ ] 100エントリの日記データで検索速度を確認
- [ ] 長文日記（10,000文字）の保存・表示速度

### Edge Cases

- **日付境界**: 2024-12-31, 2025-01-01 など年をまたぐ日付
- **特殊文字**: 絵文字、改行、HTML特殊文字（<, >, &）
- **空コンテンツ**: 空の日記を保存しようとした場合
- **重複保存**: 同じ日付で複数回保存（UPDATE動作確認）
- **存在しない日付**: 2024-13-01, 2024-02-30 など
- **超長文**: 50,000文字制限の動作確認
- **同時編集**: 同じ日記を複数ウィンドウで開いた場合（競合検出）

### Performance Benchmarks

**Target Metrics**:
- 日記読み込み: <50ms
- 日記保存: <100ms
- 全文検索（1,000エントリ）: <200ms
- カレンダー表示（has_journal取得）: <100ms

**Test Data**:
- 100日分の日記データ（各5KB）
- 検索テスト用のキーワード頻度分布

## Open Questions

1. **日記の表示位置**: どこに配置するのが最適か？
   - オプションA: DirectoryMenuの新規タブ "Journal"
   - オプションB: PhotosListの上部にバナー表示
   - オプションC: モーダルダイアログ
   - **推奨**: オプションB（バナー） + オプションC（拡大編集時）

2. **自動保存**: 編集中に自動保存するか？
   - Yes: 500ms debounce で自動保存（Googleドキュメント方式）
   - No: 明示的な "Save" ボタンのみ
   - **推奨**: Yes（自動保存 + 明示的Saveボタン両方）

3. **日記のインポート/エクスポート**: 必要か？
   - テキストファイルとしてエクスポート（1ファイル or 日付ごと）
   - Markdownフォーマット対応
   - **推奨**: Phase 2 機能として後回し

4. **リッチテキスト編集**: Markdown対応するか？
   - プレーンテキストのみ（シンプル）
   - Markdownプレビュー（中程度）
   - WYSIWYGエディタ（複雑）
   - **推奨**: Phase 1はプレーンテキスト、Phase 2でMarkdown

5. **写真とのリンク**: 日記から特定の写真を参照する機能は？
   - 日記内に写真パスを埋め込み
   - クリックでその写真を表示
   - **推奨**: Phase 2 機能として検討

6. **複数日記エントリ**: 同じ日に複数の日記を書けるようにするか？
   - 1日1エントリ（シンプル）
   - 1日複数エントリ（時刻付き）
   - **推奨**: Phase 1は1日1エントリ

## Implementation Phases

### Phase 1: 基本機能（MVP）
**期間**: 3-5日

- [ ] Database migration（`daily_journal` テーブル）
- [ ] Backend CRUD commands
- [ ] 基本的な日記エディタUI（プレーンテキスト）
- [ ] PhotosList統合（モーダル表示）
- [ ] 保存・削除機能

**成功基準**:
- 日記の作成・編集・削除ができる
- データがDBに永続化される
- UIが直感的で使いやすい

### Phase 2: カレンダー統合
**期間**: 2-3日

- [ ] `date_summary.has_journal` カラム追加
- [ ] DateListで日記のある日を視覚的に表示（📝アイコン）
- [ ] カレンダーから日記エディタを直接開く

**成功基準**:
- カレンダーで日記のある日が一目でわかる
- 日記アクセスが2クリック以内

### Phase 3: 検索機能
**期間**: 2-3日

- [ ] FTS5バーチャルテーブル
- [ ] `search_journals` コマンド実装
- [ ] 検索UI統合（既存検索バーを拡張）
- [ ] 検索結果から日付へのナビゲーション

**成功基準**:
- 日記内容で検索できる
- 検索結果が1秒以内に表示される
- 日本語・英語の検索が正しく動作

### Phase 4: UX改善
**期間**: 1-2日

- [ ] 自動保存機能（debounce）
- [ ] 未保存変更の警告
- [ ] キーボードショートカット（Ctrl+S で保存）
- [ ] 文字数カウンター表示
- [ ] Last updated タイムスタンプ表示

**成功基準**:
- データ損失のリスクが最小化
- 編集体験がスムーズ

**Total Estimate**: 8-13日 for full implementation

## Success Criteria

- [ ] 日記の作成・編集・削除が正しく動作
- [ ] データがDBに永続化され、アプリ再起動後も残る
- [ ] カレンダーで日記のある日が視覚的にわかる
- [ ] 日記内容でテキスト検索できる
- [ ] 保存操作が100ms以内に完了
- [ ] 検索が1秒以内に結果を返す
- [ ] 10,000文字の長文日記でもスムーズに編集可能
- [ ] UIが直感的で、初回使用時に説明なしで使える
- [ ] 日本語・英語両方で正しく動作
- [ ] エラー処理が適切（ネットワークエラー、DB エラー等）

## Future Enhancements (Out of Scope)

以下は今回の実装対象外だが、将来的に検討可能な機能：

1. **Markdownサポート**: リッチテキスト編集とプレビュー
2. **写真リンク**: 日記から特定の写真を参照
3. **タグ付け**: 日記にタグを付けて分類
4. **エクスポート**: テキスト/Markdown/PDFでエクスポート
5. **テンプレート**: 日記のテンプレート機能（旅行、食事など）
6. **時刻付き複数エントリ**: 1日複数の日記エントリ
7. **気分トラッキング**: その日の気分を記録（😊😐😢など）
8. **写真との自動リンク**: その日の写真を日記に自動表示
9. **クラウド同期**: 複数デバイス間での日記同期
10. **AI要約**: 長文日記の自動要約

## References

- **Terms**: `docs/terms.md` - PhotosList, DateList, PhotoContext
- **Database**: `docs/database-schema.md` - photo_metadata, date_summary
- **Related Features**:
  - Photo Comment System: `src/App/PhotosList/PhotoOption/PhotoInfo.jsx`
  - Date Summary: `src-tauri/src/repository/meta_db/sqlite/date_summary.rs`
  - Search System: `src/hooks/useSearch.js`
  - Calendar Navigation: `src/App/DateList.jsx`
- **Similar Implementations**:
  - Photo Comment: `save_comment` command pattern
  - Tag System: Collection-based CRUD pattern
  - Search: FTS5 full-text search pattern
