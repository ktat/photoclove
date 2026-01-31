# Improvement #145: Simplify compatProps Further

## 目的

#139-#144の結果を踏まえて、compatPropsの残存プロパティを分析し、さらなる簡素化の余地を探る。

## 現状（#144完了後の予想）

### 残存するcompatPropsの内容

```javascript
const compatProps = {
    currentDate: currentDate || "",
    setDatePage: updateDatePage,
    setCurrentDate: updateCurrentDate,
    setDateNum: updateDateNum,
    setDateList: updateDateList,
    setCurrentDateNum: setCurrentDateNum
};
```

### 使用箇所の分析

**1. currentDate**
- 既に`viewState.currentDate`に含まれている
- compatPropsでも持つ必要があるか？

**2. setDatePage, setCurrentDate, setDateNum, setDateList, setCurrentDateNum**
- これらは状態更新関数
- どこで使われているか確認が必要

## 調査事項

### currentDate の重複

```javascript
// viewState (already defined)
const viewState = useMemo(() => ({
    mode: viewMode,
    currentDate: currentDate,  // ← すでにある
    viewModeObj: viewModeObj
}), [viewMode, currentDate, viewModeObj]);

// compatProps
const compatProps = {
    currentDate: currentDate || "",  // ← 重複？
    // ...
};
```

→ **調査**: compatProps.currentDate は本当に必要か？viewState.currentDate で代替できないか？

### 状態更新関数の配置

状態更新関数は通常`handlers`に入れるのが一般的だが、これらは:
- PhotoContextから来ている
- 日付ナビゲーション専用

→ **調査**: これらを`handlers`に移動できるか？それとも個別propsとして渡すべきか？

## 実装詳細（調査結果による）

### パターンA: currentDate を viewState に統一

もし compatProps.currentDate が不要なら:

```javascript
// compatProps から削除
const compatProps = {
    setDatePage: updateDatePage,
    setCurrentDate: updateCurrentDate,
    setDateNum: updateDateNum,
    setDateList: updateDateList,
    setCurrentDateNum: setCurrentDateNum
};

// 使用箇所を viewState.currentDate に変更
```

### パターンB: 状態更新関数を handlers に移動

もし handlers に入れるのが適切なら:

```javascript
const handlers = useMemo(() => ({
    // ... 既存のhandlers

    // Date navigation (from PhotoContext)
    setDatePage: updateDatePage,
    setCurrentDate: updateCurrentDate,
    setDateNum: updateDateNum,
    setDateList: updateDateList,
    setCurrentDateNum: setCurrentDateNum,
}), [/* deps */]);

// compatProps はほぼ空に
const compatProps = {};
```

### パターンC: 個別propsとして渡す

もし特定のコンポーネントでしか使わないなら:

```javascript
// 必要なコンポーネントに直接渡す
<SomeComponent
    updateDatePage={updateDatePage}
    updateCurrentDate={updateCurrentDate}
    // ...
/>

// compatProps 削除
```

## 実装方針（調査後に決定）

### ステップ1: 使用箇所の調査

```bash
# currentDate の使用箇所
grep -rn "compatProps.currentDate" src/

# 状態更新関数の使用箇所
grep -rn "compatProps.setDatePage" src/
grep -rn "compatProps.setCurrentDate" src/
grep -rn "compatProps.setDateNum" src/
grep -rn "compatProps.setDateList" src/
grep -rn "compatProps.setCurrentDateNum" src/
```

### ステップ2: 最適な配置を決定

調査結果に基づいて:
1. どのプロパティがどこで使われているか
2. viewState/handlers/個別props のどこに配置すべきか
3. compatProps に残す必要があるものはあるか

### ステップ3: 実装

決定した方針に従って実装

## 影響範囲（調査結果による）

### 変更候補のファイル
- `src/App/PhotosList.jsx`
- compatProps を使用している子コンポーネント（調査により特定）

## 期待される効果

- ✅ **compatPropsのさらなる簡素化**
- ✅ **データフローの明確化**
- ✅ **状態管理の一貫性向上**

## 注意点/リスク

### リスク: 中
- 調査結果により影響範囲が変わる
- 慎重な使用箇所の確認が必要

### 検証方法

1. アプリを起動
2. すべてのモード（Date, Recent, Album, Tag, Search）で動作確認
3. 日付ナビゲーションが正常に動作するか確認
4. コンソールにエラーがないか確認

## 依存関係

- **前提タスク**: #139-#144（必須）
- **次のタスク**: #146
- **ブロックするタスク**: なし

## 実装順序

1. 使用箇所の調査を実施
2. 調査結果を分析
3. 最適な配置を決定
4. 実装計画を立てる
5. 実装
6. テスト

## 備考

このタスクは調査タスクの側面が強い。調査結果によっては:
- 大きな変更が必要になる可能性
- 逆に、ほとんど変更が不要な可能性
- 複数のサブタスクに分割する必要がある可能性

調査を先に実施し、結果に応じて柔軟に対応する。
