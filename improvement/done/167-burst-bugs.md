バグ1

1. 日付を選ぶ
1. Busrt ON
1. 写真の一覧からBurstバッジをクリック(1枚目ではないもの)
1. Burst Group の写真一覧が表示
1. 写真を一つ選ぶ
1. Burst Gruop内のPhotoViewerになる
1. 右上の、`Burst Group x`をクリック
1. 【BUG】Burst Group が解除されるが、PhotosListMiniのフォーカスが当たっている写真がおかしい
   (おそらくBurst GroupのPhotoViewerのPhotosListMiniのindexが当たっている)


バグ2

1. 日付を選ぶ
1. Busrt ON
1. 写真の一覧からBurstバッジがある1枚目ではない写真をクリック(Busrt Badgeはクリックしない)
1. Burst Group の1枚目の写真がPhotoViewerで表示される
1. `+ N photos in Group`をクリック
1. 【BUG】PhotoViewerになるが、`Burst Group`になっていない
   また、PhotosListMiniにBusrt Group内の写真が表示されていない
1. Closeする
1. Burst Group 内の写真一覧が表示される
1. 日付の写真の一覧が表示される

バグ3

albumの結果がおかしい
```
sqlite> select ci.name,ci.id,count(*) from photo_collections ci left outer join photo_collection_items on ci.id = photo_collection_items.collection_id where id in (73,97,1102,106,107) group by collection_id,ci.name;
name                id   count(*)
------------------  ---  --------
test4               107  1       
test2222            73   1       
2025/11/22-24 三陸旅行  97   430     
test3               106  1  
```

アルバム一覧で表示されているもの。

- 2025/11/22-24 三陸旅行 ... 写真が表示される
- test2222 ... クリックしても写真がない
- test3 ... クリックしても写真がない
- test4 ... クリックしても写真がない
- train ... これはタグ
