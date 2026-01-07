# ⚡ Fast Development Workflow

## Quick Start (Fastest Method)

1. **Open `test-crm.html` in your browser:**
   ```bash
   # Just double-click test-crm.html
   # Or use a local server:
   python3 -m http.server 8000
   # Then visit: http://localhost:8000/test-crm.html
   ```

2. **Make changes to your code** (content.js, styles.css, etc.)

3. **Press F5 or click the "🔄 Reload" button** - that's it! ⚡

## Benefits

✅ **Instant refresh** - Just reload the browser tab
✅ **Full DevTools** - Use Chrome DevTools without limitations
✅ **No extension reload** - Skip the chrome://extensions dance
✅ **Console helpers** - Built-in dev functions for testing
✅ **Same layout** - Matches the real Gmail environment

## Dev Console Helpers

Open DevTools (F12) and use these commands:

```javascript
// Create a test deal instantly
devHelpers.createTestDeal()

// Clear all data and start fresh
devHelpers.clearData()

// See what's stored
devHelpers.showData()

// Access the CRM instance directly
window.gmailCRM
```

## Workflow

```
1. Edit code (content.js, styles.css, etc.)
   ↓
2. Save file (Ctrl+S)
   ↓
3. Refresh browser (F5)
   ↓
4. See changes instantly! ⚡
```

## When to Use Extension vs Test Page

**Use test-crm.html for:**
- UI changes (faster iteration)
- Testing features
- Debugging logic
- Style tweaks

**Use the actual extension for:**
- Gmail integration testing
- Email parsing
- Final validation before deploying

## Tips

💡 Keep DevTools open on the Console tab
💡 Use `devHelpers.createTestDeal()` to populate test data
💡 The test page uses localStorage (same as the extension)
💡 Changes to content.js/styles.css apply to both

## Troubleshooting

**CRM not loading?**
- Check browser console for errors
- Make sure all files are in the same directory
- Try clearing cache (Ctrl+Shift+R)

**Data not persisting?**
- Data is stored in localStorage
- Use `devHelpers.showData()` to inspect
- Use `devHelpers.clearData()` to reset

---

Happy coding! 🚀
