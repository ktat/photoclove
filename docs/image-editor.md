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
Located in the DirectoryMenu component, the Editor tab provides:
- Range sliders for each transformation
- Real-time value display
- CSS preview textarea
- Action buttons

### Action Buttons

#### Apply
- Saves the current CSS style to the database
- Persists transformations for future viewing
- Requires photo selection

#### Save as Copy
- Planned feature for creating styled image copies
- Generates SHA256 hash of CSS for unique filenames
- Format: `originalname-hash.extension`

#### Reset
- Clears all transformations
- Resets sliders to default values
- Removes temporary styling

#### Download
- Planned feature for downloading styled images
- Will apply transformations and save as new file

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

## Usage

1. Select a photo from the photo list
2. Switch to the Editor tab
3. Adjust transformations using the sliders
4. Preview changes in real-time
5. Use Apply to save transformations
6. Use Reset to clear all changes

## Future Enhancements

- Image cropping support
- Save as copy functionality
- Download styled images
- Batch transformation application
- Preset styles system