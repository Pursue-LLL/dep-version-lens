[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/PursueLLL.version-lens?style=flat-square&label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=PursueLLL.version-lens)

# Dep Version Lens

A Visual Studio Code extension that displays the latest available versions for Python and Node.js dependencies directly in your editor, with intelligent upgrade suggestions and one-click updates.

## Features

- **Smart Version Suggestions**: Shows multiple upgrade options (satisfies, patch, minor, major) for each dependency.
- **Multi-Language Support**: Works with both Python (PyPI) and Node.js (npm) packages.
- **One-Click Updates**: Click on version lenses to instantly update package versions.
- **Comprehensive File Support**: Supports Python and Node.js dependency files.
- **Smart Caching**: Efficient caching system to minimize API calls and improve performance.
- **Configurable**: Customize behavior, appearance, and supported file types.

## Supported File Types

### Python Dependencies
- `requirements.txt` and `requirements-*.txt`
- `pyproject.toml` (PEP 621 and Poetry formats)
- `setup.py`
- `Pipfile`

### Node.js Dependencies
- `package.json` (dependencies, devDependencies, peerDependencies)

## Usage

1. Open any supported dependency file (Python or Node.js).
2. Version lenses will automatically appear next to package versions showing upgrade options:
   - ✅ **satisfies**: Latest version that satisfies current constraint
   - 🔧 **patch**: Latest patch version (bug fixes)
   - 📈 **minor**: Latest minor version (new features)
   - 🚀 **major**: Latest major version (breaking changes)
3. Click on any version lens to update to that specific version.
4. Use Command Palette commands to show/hide version lenses or refresh version information.

## Commands

- `Dep Version Lens: Show Version Lenses` - Enable version lens display.
- `Dep Version Lens: Hide Version Lenses` - Disable version lens display.
- `Dep Version Lens: Toggle Version Lenses` - Toggle version lens display on/off.
- `Dep Version Lens: Refresh Version Information` - Manually refresh version data.
- `Dep Version Lens: Update Package Version` - Update a specific package version.

## Configuration

Configure the extension through VS Code settings:

```json
{
  "versionLens.enabled": true,
  "versionLens.cacheTimeout": 3600000,
  "versionLens.supportedFiles": [
    "requirements.txt",
    "requirements-*.txt",
    "pyproject.toml",
    "setup.py",
    "Pipfile",
    "package.json"
  ],
  "versionLens.customPyPIIndex": "",
  "versionLens.excludePatterns": [],
  "versionLens.decorationStyle": {
    "color": "#999999",
    "fontStyle": "italic"
  }
}
```

## Requirements

- Visual Studio Code 1.74.0 or higher
- Internet connection for fetching version information from PyPI and npm

## Installation

1. Install from the VS Code Marketplace.
2. Reload VS Code.
3. Open a Python or Node.js project with dependency files.

## Development

To contribute to this extension:

1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Press F5 to open a new Extension Development Host window.
4. Make changes and test in the development environment.

## License

MIT License - see LICENSE file for details.