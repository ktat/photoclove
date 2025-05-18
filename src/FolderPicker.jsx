import { open } from "@tauri-apps/plugin-dialog";

export default function PickFolderSingle(props) {
    function pickFolderSingle() {
        return async function () {
            const opt = {
                directory: true,
                multiple: false,
            }
            if (props.folder !== undefined && props.folder !== "") {
                opt["defaultPath"] = props.folder;
            }
            const result = await open(opt);

            if (typeof result === "string") props.setFunc(result);
        }
    }

    return (
        <>
            <div className={props.class1 || "row2"}>{props.label}</div>
            <div className={props.class2 || "row3"}>
                <button onClick={pickFolderSingle()}>
                    Select Folder
                </button>
                {props.folder && <>{props.folder}</>}
            </div >
        </>
    );
}