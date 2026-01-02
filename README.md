# Gmail CRM - Chrome Extension

A powerful CRM that lives within Gmail, inspired by Streak. Manage deals, contacts, and pipelines directly from your inbox without ever leaving Gmail.

## Features

### 🎯 Core CRM Functionality
- **Pipeline Management**: Create custom pipelines with multiple stages (Sales, Support, Hiring, etc.)
- **Drag & Drop**: Visually move deals between stages with intuitive drag-and-drop
- **Deal Tracking**: Track email conversations as deals with values, notes, and stages
- **Contact Management**: Automatically capture contact information from emails
- **Gmail Integration**: CRM sidebar appears directly in Gmail interface

### 📊 Pipeline Board
- **Kanban View**: Visual board showing all deals organized by stage
- **Real-time Stats**: Track total deals and pipeline value
- **Quick Actions**: View in Gmail, delete deals, and more
- **Custom Pipelines**: Create unlimited pipelines tailored to your workflow

### 💡 Key Features
- **Persistent Storage**: All data saved locally using Chrome storage
- **Real-time Sync**: Changes sync across all Gmail tabs
- **Smart Detection**: Automatically detects email threads and thread IDs
- **Notes & Values**: Add notes and monetary values to each deal
- **Badge Counter**: See deal count directly on extension icon

## Installation

### Load as Unpacked Extension (Development)

1. **Clone or Download** this repository
   ```bash
   git clone <repository-url>
   cd gmailcrm
   ```

2. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/`
   - Or Menu → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle "Developer mode" switch in top-right corner

4. **Load the Extension**
   - Click "Load unpacked"
   - Select the `gmailcrm` folder

5. **Verify Installation**
   - The Gmail CRM extension should appear in your extensions list
   - You should see the extension icon in your Chrome toolbar

## Usage

### Getting Started

1. **Open Gmail**
   - Navigate to https://mail.google.com
   - The CRM sidebar will automatically appear on the right side

2. **Select an Email**
   - Click any email thread
   - The sidebar will show CRM options for that thread

3. **Add to Pipeline**
   - Select a pipeline from the dropdown
   - Choose a stage
   - Add deal value and notes
   - Click "Create Deal"

### Managing Pipelines

1. **Open Pipeline Board**
   - Click the Gmail CRM extension icon
   - View all your deals in a Kanban-style board

2. **Drag & Drop Deals**
   - Drag deal cards between stages
   - Changes save automatically

3. **Create Custom Pipelines**
   - Click the settings icon (⚙️)
   - Click "+ Add Pipeline"
   - Name your pipeline and add stages
   - Click "Save Pipeline"

### Pipeline Examples

**Sales Pipeline**
- Lead → Contacted → Qualified → Proposal → Negotiation → Closed Won/Lost

**Support Pipeline**
- New → In Progress → Waiting on Customer → Resolved

**Hiring Pipeline**
- Applied → Phone Screen → Interview → Offer → Hired/Rejected

## File Structure

```
gmailcrm/
├── manifest.json           # Extension configuration
├── content.js              # Gmail integration script
├── styles.css              # Sidebar and UI styles
├── popup.html              # Pipeline board HTML
├── popup.js                # Pipeline board logic
├── popup-styles.css        # Pipeline board styles
├── background.js           # Background service worker
├── icons/                  # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   └── icon.svg           # Source SVG
└── README.md              # This file
```

## Technical Details

### Architecture

- **Manifest V3**: Uses latest Chrome extension standard
- **Content Script**: Injects into Gmail to detect emails and add UI
- **Service Worker**: Manages data persistence and cross-tab communication
- **Chrome Storage**: Local storage for all pipeline and deal data

### Data Storage

All data is stored locally using Chrome's storage API:

- **Pipelines**: Custom pipeline configurations with stages
- **Deals**: Email threads tracked as deals with metadata
- **Settings**: User preferences and configuration

### Gmail Integration

The extension integrates with Gmail by:
1. Detecting Gmail's single-page app structure
2. Monitoring URL changes to detect thread navigation
3. Extracting thread IDs, subjects, and contact emails
4. Injecting sidebar UI into Gmail's DOM
5. Providing floating action buttons for quick access

## Development

### Customizing Pipelines

Edit `background.js` to modify default pipelines:

```javascript
const defaultPipelines = [
  {
    id: 'custom',
    name: 'My Custom Pipeline',
    stages: [
      { id: 'stage1', name: 'Stage 1' },
      { id: 'stage2', name: 'Stage 2' }
    ]
  }
];
```

### Styling

- **Sidebar**: Edit `styles.css`
- **Pipeline Board**: Edit `popup-styles.css`
- **Colors**: Update CSS variables for consistent theming

### Adding Features

The extension is built with modularity in mind:

- **Content Script** (`content.js`): Add Gmail UI features
- **Popup** (`popup.js`): Add pipeline board features
- **Background** (`background.js`): Add data management features

## Troubleshooting

### Extension Not Loading
- Ensure Developer Mode is enabled
- Check for errors in `chrome://extensions/`
- Reload the extension

### Sidebar Not Appearing in Gmail
- Refresh Gmail after installing extension
- Check browser console for errors (F12)
- Verify you're on `mail.google.com`

### Deals Not Saving
- Check Chrome storage quota
- Open extension popup to verify data
- Check background service worker logs

### Icons Not Showing
If you see placeholder icons:
1. Generate proper icons from the SVG:
   ```bash
   cd icons
   npm install sharp
   node generate-icons.js
   ```
2. Or use the Python script:
   ```bash
   cd icons
   python3 create_icons.py
   ```

## Privacy & Security

- **Local Storage Only**: All data stored locally on your computer
- **No External Servers**: No data sent to external servers
- **Gmail Permissions**: Only accesses Gmail when you're viewing it
- **Open Source**: All code is visible and auditable

## Future Enhancements

Potential features for future versions:

- Email tracking (read receipts)
- Mail merge capabilities
- Team collaboration features
- Export/import pipelines and deals
- Calendar integration
- Keyboard shortcuts
- Search and filtering
- Analytics and reporting

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT License - feel free to use and modify as needed.

## Credits

Inspired by [Streak CRM](https://www.streak.com)

---

**Note**: This is an independent project and is not affiliated with or endorsed by Streak or Google.
