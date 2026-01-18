# Create Sample HTML

Create HTML sample files to visualize UI design options based on the current conversation context.

## Process

1. **Analyze Context**: Review the recent conversation to identify:
   - UI components being discussed
   - Design options or variations mentioned
   - Styling requirements (colors, animations, layouts)

2. **Identify Candidates**: If multiple design options exist:
   - List all candidates with brief descriptions
   - Use AskUserQuestion to let user select which options to include
   - Options: "All options", or individual selections

3. **Create HTML File**:
   - Output directory: `tmp/` in project root
   - Filename format: `{feature-name}-samples.html` (e.g., `loading-animation-samples.html`)
   - Include both Dark and Light theme versions when applicable

4. **HTML Structure**:
   ```html
   <!DOCTYPE html>
   <html lang="ja">
   <head>
     <meta charset="UTF-8">
     <title>{Feature} Samples</title>
     <style>
       /* Base styles matching PhotoClove design system */
       * { box-sizing: border-box; }
       body {
         font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
         background: #1b1b1b;
         color: #e4e4e4;
         padding: 40px;
         margin: 0;
       }
       /* ... component styles ... */
     </style>
   </head>
   <body>
     <!-- Current style section -->
     <!-- Option A, B, C... sections -->
     <!-- Light theme versions -->
   </body>
   </html>
   ```

## Design System Reference

Use these colors to match PhotoClove:

### Dark Theme
- Background: `#1b1b1b` (base), `#242424` (elevated)
- Text: `#e4e4e4` (primary), `#9ca3af` (muted)
- Primary: `#4a9eff`
- Border: `#333`

### Light Theme
- Background: `#faf8f5` (base), `#f5f0eb` (elevated)
- Text: `#1f1f1f` (primary), `#737373` (muted)
- Primary: `#2563eb`
- Border: `#e0d8d0`

## Output

1. Report the created file path
2. **Automatically open in browser** using:
   ```bash
   xdg-open tmp/{filename}.html
   ```

## Arguments

Optional: Specify what to create samples for
- If no argument: analyze context automatically
- If argument provided: use as the feature/component name

ARGUMENTS: $ARGUMENTS
