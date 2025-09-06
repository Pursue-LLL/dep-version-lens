# Dep Version Lens

A Visual Studio Code extension that displays the latest available versions for Python dependencies directly in your editor, with one-click updates.

## Features

- **Inline Version Display**: Shows "latest: X.Y.Z" next to package versions in your dependency files
- **One-Click Updates**: Click on version lenses to instantly update package versions
- **Multiple File Format Support**: Works with requirements.txt, pyproject.toml, setup.py, and Pipfile
- **Smart Caching**: Efficient caching system to minimize API calls and improve performance
- **Configurable**: Customize behavior, appearance, and supported file types

## Supported File Types

- `requirements.txt` and `requirements-*.txt`
- `pyproject.toml` (PEP 621 and Poetry formats)
- `setup.py`
- `Pipfile`

## Usage

1. Open any supported Python dependency file
2. Version lenses will automatically appear next to package versions
3. Click on a version lens to update to the latest version
4. Use Command Palette commands to show/hide version lenses or refresh version information

## Commands

- `Dep Version Lens: Show Version Lenses` - Enable version lens display
- `Dep Version Lens: Hide Version Lenses` - Disable version lens display
- `Dep Version Lens: Refresh Version Information` - Manually refresh version data
- `Dep Version Lens: Update Package Version` - Update a specific package version

## Configuration

Configure the extension through VS Code settings:

```json
{
  "pythonVersionLens.enabled": true,
  "pythonVersionLens.cacheTimeout": 3600000,
  "pythonVersionLens.supportedFiles": [
    "requirements.txt",
    "requirements-*.txt",
    "pyproject.toml",
    "setup.py",
    "Pipfile"
  ],
  "pythonVersionLens.customPyPIIndex": "",
  "pythonVersionLens.excludePatterns": [],
  "pythonVersionLens.decorationStyle": {
    "color": "#999999",
    "fontStyle": "italic"
  }
}
```

## Requirements

- Visual Studio Code 1.74.0 or higher
- Internet connection for fetching version information from PyPI

## Installation

1. Install from the VS Code Marketplace
2. Reload VS Code
3. Open a Python project with dependency files

## Development

To contribute to this extension:

1. Clone the repository
2. Run `npm install` to install dependencies
3. Press F5 to open a new Extension Development Host window
4. Make changes and test in the development environment

## License

MIT License - see LICENSE file for details