# Improvement 76: Import機能をPhotosList/PhotosListMiniで実装

## Overview
現在のインポート機能をPhotosList/PhotosListMiniコンポーネントを使って再実装し、より統一感のあるUIとコードの再利用性を高める。

## Current State Analysis
- 現在のImporter.jsx: 独自のUIとスクロールベースのページネーション
- PhotosList: 統一されたサムネイル表示、選択機能、フィルタリング
- VIEW_MODES.IMPORT: 既にconstantsで定義済み

## 決定事項
1. **PhotoCollectionアプローチを採用** - データソース抽象化とstateカプセル化
2. **UIContext変更なし** - 既存のuseViewMode()がIMPORTサポート済み
3. **段階的移行** - 既存Importer.jsx → PhotosList統合 → 旧コード削除

## 実装順序
**Phase 1: PhotoCollectionアーキテクチャ基盤整備**
1. PhotoCollection.js拡張 - fetchPhotos()メソッド追加 (既存mode対応)
2. PhotosList.jsx リファクタリング - PhotoCollectionベース使用への変更

**Phase 2: Import機能統合** 
3. PhotoCollection.js import mode追加 - import専用のfactory method + fetchPhotos
4. DirectoryMenu.jsx拡張 - Directory/Selection タブ追加
5. Import Progress統合 - JobQueueイベントベース + DirectoryMenu表示
6. Importer.jsx削除 - 完全移行後のクリーンアップ

## 関連ファイル
- [現在の実装分析](76-current-analysis.md)
- [UI設計](76-ui-design.md) 
- [技術実装](76-implementation.md)
- [進捗管理](76-progress.md)