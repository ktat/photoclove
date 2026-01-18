# Check Screenshot

Check the latest screenshot file from the user's screenshot directory.

## Process

1. Find the latest screenshot file:
   ```bash
   ls -t ~/ピクチャ/スクリーンショット/ | head -1
   ```

2. Read and analyze the screenshot using the Read tool with the full path

3. Describe what you see in the screenshot and provide relevant feedback

## Usage

Use this command when:
- User wants to show you their current screen state
- Debugging UI issues
- Verifying visual changes after code modifications
- Reviewing application appearance

## Notes

- Screenshots are typically PNG files
- The directory uses Japanese characters (ピクチャ/スクリーンショット)
- Always get the most recent file by modification time
