# 国際化 Phase 2: 追加言語対応

## Overview

172-internationalization.md の第二弾として、追加言語のサポートを実装する。

**前提**: Phase 1（英語、日本語、フランス語、ドイツ語）が完了していること

## 追加言語

| 言語 | コード | 備考 |
|------|--------|------|
| 中国語（簡体字） | `zh-CN` | 中国大陸向け |
| 中国語（繁体字） | `zh-TW` | 台湾・香港向け |
| スペイン語 | `es` | 20カ国以上で使用 |

## ディレクトリ構造

```
src/i18n/locales/
├── en/          # (Phase 1)
├── ja/          # (Phase 1)
├── fr/          # (Phase 1)
├── de/          # (Phase 1)
├── zh-CN/       # 简体中文 (Phase 2)
├── zh-TW/       # 繁體中文 (Phase 2)
└── es/          # Español (Phase 2)
```

## Implementation

### Tasks
- [ ] 簡体字翻訳ファイル作成
- [ ] 繁体字翻訳ファイル作成
- [ ] スペイン語翻訳ファイル作成
- [ ] 言語選択UIに3言語を追加
- [ ] 日付フォーマットの確認（特に中国語）

### 言語選択UI追加

```
🇨🇳  简体中文
🇹🇼  繁體中文
🇪🇸  Español
```

## Notes

- Phase 1 完了後に着手
- 翻訳品質の確保が重要（ネイティブチェック推奨）
- 簡体字と繁体字は単純な変換ではなく、表現の違いもあるため別々に翻訳が必要

## Dependencies

- [172-internationalization.md](./172-internationalization.md) の完了
