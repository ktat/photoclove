# Trash bin mangement

## Del behavior

When del key, photo is removed from list and move it to trash path.
But `photo_metadata` record of the deleted photo is not updated.
It should be set `delte_flg = 1` when photo is deleted.

## trash bin management view

### List photos in trash bin

From Trash bin icon, list files which is in trash bin(`delete_flg = 1`).
Use PhotosList and PhotosListMini like other mode(date, album, serch etc.)

### remove Permanently

- Ctrl+Del in 1 photo mode, delete photo permanetly from file system and also `DELETE` from `photo_metadb`.
- Delete selected photos from dropdown menu in `Selection` tab.
   - Tutorial is required like selection in other mode
