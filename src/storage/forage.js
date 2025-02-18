import { forage, cryptoForage } from '@tauri-apps/tauri-forage'

cryptoForage.enBox("test")("value").then((r) => console.log("enBox:" + r));
cryptoForage.deBox("test")().then((r) => console.log("deBox:" + r));

export const localForage = forage.createInstance({ name: "photoclove", storeName: "photoclove" });