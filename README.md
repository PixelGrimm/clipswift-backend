# ClipSwift - Chrome Extension Snippet Manager

A modern, feature-rich snippet manager Chrome extension built with Manifest V3. ClipSwift allows you to organize, search, and manage your code snippets, templates, and text with a beautiful, intuitive interface.

## Features

✅ **Modern UI Design**
- Clean, minimalist interface with TailwindCSS styling
- Two-column layout: snippet list on the left, editor on the right
- Responsive design that works perfectly in Chrome's popup

✅ **Snippet Organization**
- Categorize snippets: All, Favorites, AI Prompts, Templates, Messages, Code
- Filter snippets by category with tab navigation
- Mark snippets as favorites with star icons

✅ **Rich Text Editor**
- Full rich text formatting (bold, italic, underline)
- Numbered and bulleted lists
- Code block support with syntax highlighting
- Real-time content editing

✅ **Search & Filter**
- Live search through snippet titles and content
- Category-based filtering
- Instant results as you type

✅ **Data Management**
- Automatic saving to Chrome's sync storage
- Cross-device synchronization
- Export/import functionality (coming soon)

✅ **User Experience**
- Double-click to toggle favorites
- Auto-save functionality
- Smooth animations and transitions
- Keyboard shortcuts support

## File Structure

```
ClipSwift/
├── manifest.json          # Extension manifest (Manifest V3)
├── popup.html            # Main popup interface
├── popup.js              # Core functionality and UI logic
├── style.css             # Custom styles and animations
├── background.js         # Service worker for background tasks
├── icons/                # Extension icons
│   ├── icon.svg          # Source SVG icon
│   ├── icon128.png       # 128x128 icon
│   ├── icon48.png        # 48x48 icon
│   ├── icon32.png        # 32x32 icon
│   └── icon16.png        # 16x16 icon
├── create_icons.html     # Icon generator tool
└── README.md             # This file
```

## Installation Instructions

### Method 1: Load as Unpacked Extension (Development)

1. **Download or clone this repository**
   ```bash
   git clone <repository-url>
   cd ClipSwift
   ```

2. **Generate Icons** (if needed)
   - Open `create_icons.html` in your browser
   - Right-click on each icon and save as PNG
   - Place the PNG files in the `icons/` folder with the correct names

3. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the ClipSwift folder
   - The extension should now appear in your extensions list

4. **Access the Extension**
   - Click the ClipSwift icon in your Chrome toolbar
   - The popup will open with the snippet manager interface

### Method 2: Install from Chrome Web Store (Production)

*Coming soon - Extension will be published to the Chrome Web Store*

## How to Use

### Creating Snippets
1. Click the "+" button in the top right
2. Enter a title for your snippet
3. Use the rich text editor to add content
4. Click "Save" to store your snippet

### Organizing Snippets
- **Categories**: Use the tabs at the top to filter by category
- **Favorites**: Double-click any snippet to mark it as favorite
- **Search**: Use the search bar to find specific snippets

### Rich Text Editing
- **Bold**: Click the B button or use Ctrl+B
- **Italic**: Click the I button or use Ctrl+I
- **Underline**: Click the U button or use Ctrl+U
- **Lists**: Click the list button to create bulleted lists

### Data Storage
- All snippets are automatically saved to Chrome's sync storage
- Data syncs across all your Chrome installations
- No external servers or accounts required

## Technical Details

### Manifest V3 Compliance
- Uses the latest Chrome extension manifest format
- Service worker for background tasks
- Minimal permissions (only storage access)

### Storage Structure
```javascript
{
  snippets: [
    {
      id: "unique_id",
      title: "Snippet Title",
      content: "<p>HTML content</p>",
      category: "AI Prompts",
      favorite: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Technologies Used
- **HTML5**: Semantic markup and structure
- **CSS3**: Modern styling with TailwindCSS
- **JavaScript ES6+**: Modern JavaScript features
- **Chrome Extension APIs**: Storage and runtime APIs
- **TailwindCSS**: Utility-first CSS framework

## Publishing to Chrome Web Store

### Step 1: Prepare Your Extension
1. Ensure all files are properly organized
2. Test thoroughly in development mode
3. Create high-quality screenshots and promotional images
4. Write compelling description and keywords

### Step 2: Create Developer Account
1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. Pay the one-time $5 registration fee
3. Complete your developer profile

### Step 3: Package and Upload
1. **Create a ZIP file** of your extension:
   ```bash
   zip -r clipswift.zip . -x "*.git*" "README.md" "create_icons.html"
   ```

2. **Upload to Chrome Web Store**:
   - Log into the Developer Dashboard
   - Click "Add new item"
   - Upload your ZIP file
   - Fill in all required information:
     - Description
     - Screenshots (1280x800 or 640x400)
     - Promotional images
     - Category and language
     - Privacy policy (if applicable)

### Step 4: Submit for Review
1. Review all information carefully
2. Submit for Chrome Web Store review
3. Wait for approval (typically 1-3 business days)
4. Once approved, your extension will be live on the Chrome Web Store

### Step 5: Marketing and Distribution
- Share on social media and developer communities
- Create a landing page for your extension
- Gather user feedback and iterate
- Consider paid promotion for wider reach

## Browser Compatibility

- ✅ Chrome 88+ (Manifest V3 support)
- ✅ Edge 88+ (Chromium-based)
- ✅ Opera 74+ (Chromium-based)
- ❌ Firefox (requires Manifest V2 conversion)
- ❌ Safari (requires separate development)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, feature requests, or bug reports:
- Create an issue on GitHub
- Contact the development team
- Check the documentation

---

**ClipSwift** - Your modern snippet manager for Chrome 🚀
