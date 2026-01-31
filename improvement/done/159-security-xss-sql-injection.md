# セキュリティ問題: XSS と SQLインジェクション

## 概要

コードレビューで発見されたセキュリティ脆弱性の詳細と修正方法。

**重要度**: Low（下記考慮事項参照）
**対応優先度**: Low

---

## 考慮事項: ローカルアプリケーションの特性

PhotoCloveはTauriデスクトップアプリケーションであり、以下の点でWebアプリケーションとはリスクプロファイルが異なります。

### 攻撃ベクターの制限

1. **外部からのアクセス不可**: ネットワーク経由での攻撃ベクターが存在しない
2. **攻撃者=ユーザー自身**: DevTools/Inspectorを使ってUIやJavaScriptを変更できるのはユーザー自身のみ
3. **自己への不利益のみ**: 仮にユーザーがInspectorで悪意のあるコードを実行しても、被害を受けるのは自分自身のデータのみ

### リスク評価

| 脆弱性タイプ | Webアプリでのリスク | PhotoCloveでのリスク | 理由 |
|-------------|-------------------|---------------------|------|
| XSS | HIGH | LOW | 外部攻撃者がスクリプトを注入する経路がない |
| SQLインジェクション | CRITICAL | LOW | ローカルDB、外部入力なし |

### 結論

技術的には脆弱性の「形式」は存在するが、ローカルアプリケーションの特性上、実質的なセキュリティリスクは低い。ただし、コード品質とベストプラクティスの観点から、以下の対応を検討する価値はある。

---

## 1. XSS（クロスサイトスクリプティング）脆弱性

### 1.1 PhotoDisplay.jsx の dangerouslySetInnerHTML

**ファイル**: `src/App/PhotosList/PhotosListMini/PhotoDisplay.jsx`
**行**: 369
**重要度**: Medium

#### 問題のコード

```javascript
<div dangerouslySetInnerHTML={{ __html: props.selectedContent }} />
```

#### リスク

- `selectedContent` がユーザー入力または外部データソースから来る場合、悪意のあるスクリプトが実行される可能性
- HTMLタグやJavaScriptコードが注入されると、セッションハイジャックやデータ漏洩のリスク

#### 修正方法

**オプション1: DOMPurify を使用したサニタイズ**

```javascript
import DOMPurify from 'dompurify';

// 使用時
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(props.selectedContent) }} />
```

**オプション2: テキストのみを許可**

```javascript
// HTMLを許可しない場合
<div>{props.selectedContent}</div>
```

**オプション3: 安全なマークダウンパーサーを使用**

```javascript
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const safeHtml = DOMPurify.sanitize(marked.parse(props.selectedContent));
<div dangerouslySetInnerHTML={{ __html: safeHtml }} />
```

#### 調査すべき点

1. `selectedContent` のデータソースを特定
2. ユーザー入力が含まれるかどうかを確認
3. 既存のサニタイズ処理の有無を確認

---

### 1.2 DocumentViewer.jsx のマークダウンレンダリング

**ファイル**: `src/components/DocumentViewer.jsx`
**行**: 125
**重要度**: Low（ローカルファイルのみのため）

#### 問題のコード

```javascript
<div dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
```

#### リスク

- 現状はローカルファイル（ドキュメント）のみを読み込むため、リスクは低い
- ただし、将来的に外部ソースからのマークダウンを読み込む場合はリスクが高まる

#### 推奨対応

```javascript
import DOMPurify from 'dompurify';

const renderMarkdown = (content) => {
  const html = marked.parse(content);
  return DOMPurify.sanitize(html);
};
```

---

## 2. SQLインジェクションの可能性

### 2.1 検索クエリのソートフィールド

**ファイル**: `src-tauri/src/repository/meta_db/sqlite/search.rs`
**行**: 260, 385-428
**重要度**: CRITICAL

#### 問題のコード

```rust
// search.rs:260
sql_query.push_str(&format!(" LIMIT {}", max_photos_per_fetch));

// add_order_by_clause関数（385-428行）
fn add_order_by_clause(sql_query: &mut String, sort_field: &str, sort_order: &str) {
    sql_query.push_str(&format!(" ORDER BY {} {}", sort_field, sort_order));
}
```

#### リスク

- `sort_field` がユーザー入力から来る場合、SQLインジェクションが可能
- 攻撃者が `; DROP TABLE photos; --` のような値を渡すとデータベースが破壊される可能性
- データの漏洩、改ざん、削除のリスク

#### 修正方法

**なぜプレースホルダーが使えないか**

SQLのプレースホルダー（パラメータ化クエリ）は「値」のためのもので、「識別子」や「キーワード」には使用できません。

| 用途 | 例 | プレースホルダー |
|------|-----|-----------------|
| 値 | `WHERE id = ?` | 使用可能 |
| 値 | `LIMIT ?` | 使用可能 |
| 識別子（カラム名） | `ORDER BY column_name` | 使用不可 |
| キーワード | `ASC / DESC` | 使用不可 |

そのため、`sort_field`（カラム名）と`sort_order`（ASC/DESC）にはホワイトリスト検証が必要です。

**ホワイトリスト方式による検証**

```rust
fn add_order_by_clause(sql_query: &mut String, sort_field: &str, sort_order: &str) {
    // 許可されたフィールドのみを受け入れる
    let allowed_fields = [
        "exif_date_time_original",
        "photo_date",
        "path",
        "star",
        "file_size",
        "width",
        "height",
    ];

    let allowed_orders = ["ASC", "DESC"];

    // フィールド名の検証
    if !allowed_fields.contains(&sort_field) {
        log::warn!(target: "search", "invalid_sort_field; field={}", sort_field);
        return;
    }

    // ソート順の検証
    let safe_order = if allowed_orders.contains(&sort_order.to_uppercase().as_str()) {
        sort_order.to_uppercase()
    } else {
        "ASC".to_string()
    };

    sql_query.push_str(&format!(" ORDER BY {} {}", sort_field, safe_order));
}
```

**LIMITはプレースホルダーを使用可能**

```rust
// LIMITは値なのでプレースホルダーが使える
// rusqliteの例:
stmt.execute(params![limit])?;

// または、Rust型システムによる安全性（現状）
fn add_limit_clause(sql_query: &mut String, limit: u32) {
    // u32型なのでSQLインジェクションの可能性なし
    sql_query.push_str(&format!(" LIMIT {}", limit));
}
```

---

## 対応チェックリスト

> **注**: ローカルアプリケーションのため、セキュリティリスクは低い。
> コード品質の観点から、余裕がある場合に対応を検討。

### 低優先度（コード品質向上として）

- [ ] PhotoDisplay.jsx の `selectedContent` のデータソースを確認
- [ ] search.rs のソートフィールドにホワイトリスト検証を追加（防御的プログラミング）
- [ ] `dangerouslySetInnerHTML` 使用箇所の監査（将来の機能拡張に備えて）

### 将来検討（必要に応じて）

- [ ] 外部データ連携機能追加時にサニタイズ処理を導入
- [ ] DOMPurify ライブラリの導入（外部コンテンツ表示機能追加時）

---

## 参考リンク

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [DOMPurify](https://github.com/cure53/DOMPurify)

---

*作成日: 2025-01-13*
*元ファイル: 2026-01-13-code-review.md*
