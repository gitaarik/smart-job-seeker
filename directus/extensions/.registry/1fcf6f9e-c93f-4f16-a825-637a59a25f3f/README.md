# Panel Link Extension for Directus

A customizable link panel extension for Directus that displays clickable links with full styling control.

## Features

- **Clickable Links**: Display functional links that users can click
- **Custom Display Text**: Show custom text instead of the raw URL
- **Color Customization**: Choose any color for your links
- **Font Size Control**: Select from Small, Medium, Large, or Extra Large
- **New Tab Option**: Configure links to open in new tabs (default: enabled)
- **Compact Design**: Minimal height with clean styling
- **Responsive**: Works across different screen sizes

## Installation

1. Clone or download this extension
2. Navigate to the extension directory:
   ```bash
   cd extensions/panel-link
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build the extension:
   ```bash
   npm run build
   ```
5. The extension will be available in your Directus dashboard

## Configuration Options

### URL
- **Type**: Text input
- **Required**: Yes
- **Description**: The destination URL for the link
- **Example**: `https://example.com`

### Display Text
- **Type**: Text input
- **Required**: No
- **Description**: Custom text to display instead of the URL
- **Example**: `Click here to visit our website`
- **Fallback**: If empty, the URL will be displayed

### Link Color
- **Type**: Color picker
- **Required**: No
- **Default**: Directus primary color
- **Description**: Choose any color for the link text

### Font Size
- **Type**: Dropdown
- **Required**: No
- **Default**: Medium
- **Options**:
  - Small (0.875rem)
  - Medium (1rem)
  - Large (1.125rem)
  - Extra Large (1.25rem)

### Open in New Tab
- **Type**: Boolean toggle
- **Required**: No
- **Default**: Enabled
- **Description**: When enabled, links open in a new browser tab

## Usage

1. In your Directus dashboard, navigate to the collection where you want to add the link panel
2. Add a new panel and select "Link" from the panel options
3. Configure the panel settings:
   - Enter the URL
   - Optionally add custom display text
   - Choose a color and font size
   - Toggle the "Open in New Tab" option
4. Save the panel configuration

## Development

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Directus instance

### Development Commands

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Development mode with watch
npm run dev

# Link to Directus instance
npm run link

# Validate the extension
npm run validate
```

### Project Structure

```
panel-link/
├── src/
│   ├── index.ts          # Panel configuration
│   ├── panel.vue         # Vue component
│   └── shims.d.ts        # TypeScript declarations
├── dist/                 # Built extension (generated)
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

## Styling

The extension uses Directus design system variables for consistent styling:

- **Primary Color**: `var(--primary)`
- **Subdued Text**: `var(--foreground-subdued)`
- **Hover Effects**: Opacity transitions for smooth interactions

## Browser Compatibility

- Modern browsers with ES6+ support
- Includes proper `rel="noopener noreferrer"` for security when opening in new tabs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This extension is licensed under the MIT License.

## Support

For issues or questions:
1. Check the Directus documentation
2. Review existing issues
3. Create a new issue with detailed information

## Version History

- **1.0.0**: Initial release with basic link functionality
- **1.1.0**: Added color customization and font size options
- **1.2.0**: Added new tab option and compact design 