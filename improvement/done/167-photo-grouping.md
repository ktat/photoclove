# 写真グルーピング機能（索引）

## Overview

同じ時間帯に同じカメラで撮影された写真を自動的にグループ化し、連写（バースト撮影）をまとめて表示する機能。Import時・ReCreateDB時にグループIDを割り振り、DBに永続化。手動でのグループ作成/解除もSelectionから可能。

## 分割ファイル

| ファイル | 内容 | Phase |
|----------|------|-------|
| [167-1-grouping-backend.md](167-1-grouping-backend.md) | DB・バックエンド基盤 | Phase 1 |
| [167-2-grouping-frontend.md](167-2-grouping-frontend.md) | フロントエンド表示 | Phase 2 |
| [167-3-grouping-manual.md](167-3-grouping-manual.md) | 手動グループ操作 | Phase 3 |
| [167-4-grouping-settings.md](167-4-grouping-settings.md) | 設定・拡張機能 | Phase 4 |

## アーキテクチャ概要

### データベース

```sql
-- burst_groups テーブル（最小限の設計）
CREATE TABLE burst_groups (
    id TEXT PRIMARY KEY,
    is_manual INTEGER DEFAULT 0,  -- 手動作成フラグ (0=自動, 1=手動)
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- photo_metadata に追加
ALTER TABLE photo_metadata ADD COLUMN burst_group_id TEXT;
CREATE INDEX idx_burst_group_id ON photo_metadata(burst_group_id);
```

### 設計の要点

- **representative_path は不要**: 代表写真はフィルタ条件内で最古の写真として動的に決定
- **photo_count は不要**: フィルタ条件を含めて動的にカウント
- **ViewModeベース**: BurstPhotoMode をフィルタリングレイヤーとして実装

### グループID生成タイミング

| タイミング | 処理 |
|------------|------|
| Import時 | 新規写真にグループID割り振り |
| ReCreateDB時 | 全写真を再グルーピング（手動グループ is_manual=1 は維持） |
| 手動作成 | Selectionから任意の写真をグループ化 |

### UI表示（ViewModeベース）

```
┌─────────────────────────────────────────────────────────────┐
│ 既存ViewMode + BurstPhotoMode (フィルタリングレイヤー)       │
│                                                             │
│  DATE_VIEW ──┬── 通常表示 (全写真)                          │
│              └── + BurstPhotoMode (代表+非グループ)          │
│                        ↓ クリック                           │
│              InBurstGroupMode (グループ内一覧)               │
│                        ↓ 戻る                               │
│              元のViewMode + BurstPhotoMode                   │
└─────────────────────────────────────────────────────────────┘
```

バッジ表示（右上）:
```
┌──────────┐  ┌──────────┐  ┌──────────┐
│┌+5┐      │  │          │  │┌+3┐      │
│└──┘      │  │  単独    │  │└──┘      │
│          │  │  写真    │  │          │
└──────────┘  └──────────┘  └──────────┘
  グループ      単独        グループ
（代表写真）              （代表写真）
```

### unified_search 拡張

| search_type | 説明 |
|-------------|------|
| `burst_date` | 日付内の代表+非グループ写真 |
| `burst_album` | アルバム内の代表+非グループ写真 |
| `burst_tag` | タグ内の代表+非グループ写真 |
| `burst_group` | 特定グループ内の全写真 |

## 段階的実装

### Phase 1: DB・バックエンド基盤
- マイグレーション追加（burst_groups テーブル、burst_group_id カラム）
- BurstGroup エンティティ
- grouping_service（自動グルーピングロジック）
- Import/ReCreateDB への統合
- unified_search に burst パターン追加

### Phase 2: フロントエンド表示
- ViewMode追加: BURST_PHOTO_MODE, IN_BURST_GROUP_MODE
- PhotoCard にバーストバッジ表示（右上）
- グルーピング表示ON/OFF切り替え
- 元のViewModeへの戻り機能

### Phase 3: 手動グループ操作
- Selection から「グループ作成」
- Selection から「グループ解除」
- グループから写真を除外

### Phase 4: 設定・拡張
- Preferences でグルーピング設定
- グループ一括操作
- パフォーマンス最適化

## グルーピング条件

```
同じカメラ（Make + Model）
  + 時間差が閾値以内（デフォルト2秒）
  + 2枚以上
  → 連写グループとして判定
```

## Open Questions

1. **時間閾値**: デフォルト2秒は適切か？
2. **ReCreateDB時**: 手動グループ(is_manual=1)は維持 ✓
3. **アルバム/タグ内**: フィルタスコープ内でのカウント・代表決定 ✓
4. **グループ削除時**: グループが1枚以下になったら自動解除
5. **Import時の既存グループ結合**: 時間が連続していれば結合
