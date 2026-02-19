import { forage, cryptoForage as _cryptoForage } from '@tauri-apps/tauri-forage'

export const localForage = forage.createInstance({ name: "photoclove", storeName: "photoclove" });