# Image Editor Documentation

PhotoClove includes a CSS-based image editor for non-destructive image transformations.

## Features

### Available Transformations

#### Rotation
- Range: 0-360 degrees
- Real-time preview
- CSS transform: `rotate(Ndeg)`

#### Brightness
- Range: 0-200%
- Default: 100%
- CSS filter: `brightness(N%)`

#### Contrast
- Range: 0-200%
- Default: 100%
- CSS filter: `contrast(N%)`

#### Saturation
- Range: 0-200%
- Default: 100%
- CSS filter: `saturate(N%)`

#### Hue Rotation
- Range: 0-360 degrees
- CSS filter: `hue-rotate(Ndeg)`

#### Scale
- Range: 50-200%
- Default: 100%
- CSS transform: `scale(N)`

## User Interface

### Editor Tab
Located in the PhotoInfo component as a tabbed interface, the Editor tab provides:
- Range sliders for each transformation with individual reset buttons
- Real-time value display next to each slider
- CSS preview textarea showing generated styles
- Compact action buttons in a single row
- Rotation shortcuts for 90-degree increments

### Enhanced Controls

#### Individual Reset Buttons
- Each slider control has its own reset button (↻)
- Allows resetting individual properties without affecting others
- Provides granular control over transformations

#### Rotation Shortcuts
- Turn left 90° button (↶ 90°)
- Turn right 90° button (↷ 90°)
- Located below the rotation slider for quick access
- Maintains rotation values within 0-359 degree range

#### Smart Value Handling
- Rotation value of 360° automatically converts to 0°
- Preserves original image styles when applying editor transformations
- Real-time synchronization between sliders and value displays

### Action Buttons

#### Apply
- Saves the current CSS style to the database
- Persists transformations for future viewing
- Requires photo selection
- Compact button design for better layout

#### Save as Copy (Copy)
- Planned feature for creating styled image copies
- Will generate SHA256 hash of CSS for unique filenames
- Format: `originalname-hash.extension`

#### Reset
- Clears all transformations
- Resets sliders to default values
- Removes temporary styling
- Restores original image appearance

#### Download
- **IMPLEMENTED**: Downloads styled images as PNG files
- Applies transformations using canvas rendering
- Saves to configurable download directory
- Shows system notifications and clickable footer messages
- Opens downloaded files when notification is clicked

## Technical Implementation

### CSS Generation
The editor generates CSS using two main properties:
- `transform`: For rotation and scaling
- `filter`: For brightness, contrast, saturation, and hue

### Real-time Preview
- Transformations are applied immediately to the displayed image
- CSS is generated on every slider change
- Preview updates are handled via DOM manipulation

### Database Storage
- CSS styles are stored in the `css_style` column
- Stored as complete CSS property string
- Retrieved when displaying photos with saved styles

### API Commands
- `save_css_style(photo_path, css_style)`: Save transformations
- `get_css_style(photo_path)`: Retrieve saved transformations
- `get_download_dir()`: Get configurable download directory
- `open_file_in_default_app(file_path)`: Open downloaded files

### Download Implementation
- Canvas-based rendering for styled image generation
- Configurable download directory via preferences
- System notifications with permission handling
- Click-to-open functionality for downloaded files
- Cross-platform file opening with fallback support

## Usage

1. Select a photo from the photo list
2. Click the "🎨 Editor" tab in the PhotoInfo panel
3. Adjust transformations using the sliders
4. Use individual reset buttons (↻) to reset specific controls
5. Use rotation shortcuts (↶ 90°, ↷ 90°) for quick rotation
6. Preview changes in real-time
7. Use Apply to save transformations permanently
8. Use Download to save styled image as PNG file
9. Use Reset to clear all changes and restore original

## Recent Enhancements

### Version Updates
- **UI Redesign**: Moved editor from DirectoryMenu to PhotoInfo tabbed interface
- **Enhanced Controls**: Added individual reset buttons and rotation shortcuts
- **Download Feature**: Implemented styled image download with notifications
- **Smart Handling**: Rotation 360° automatically converts to 0°
- **Improved Layout**: Compact action buttons and better responsive design
- **Click-to-Open**: Downloaded files can be opened by clicking notifications

## Future Enhancements

- Image cropping support
- Save as copy functionality  
- Batch transformation application
- Preset styles system
- Additional filter effects (blur, sepia, etc.)