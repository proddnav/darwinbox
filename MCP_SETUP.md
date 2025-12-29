# MCP Server Setup for Claude Desktop

This MCP (Model Context Protocol) server allows Claude Desktop to extract structured data from invoice/receipt images.

## Prerequisites

1. **Claude Desktop** installed
2. **Node.js** and **npm** installed
3. **CLAUDE_API_KEY** environment variable set (or in `.env` file)

## Installation

1. Install dependencies (if not already done):
```bash
npm install
```

2. Ensure your `.env` file contains:
```
CLAUDE_API_KEY=your-claude-api-key-here
```

## Configuration

### Option 1: Using Claude Desktop Config File (Recommended)

1. Locate your Claude Desktop config file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. Add the MCP server configuration:

```json
{
  "mcpServers": {
    "invoice-ocr": {
      "command": "npm",
      "args": ["run", "mcp-server"],
      "cwd": "/absolute/path/to/darwinbox-reimbursements",
      "env": {
        "CLAUDE_API_KEY": "your-claude-api-key-here"
      }
    }
  }
}
```

**Important**: Replace `/absolute/path/to/darwinbox-reimbursements` with the actual absolute path to your project directory.

### Option 2: Using Environment Variables

You can also set the `CLAUDE_API_KEY` in your system environment variables instead of hardcoding it in the config.

## Available Tools

Once configured, Claude Desktop will have access to these tools:

### 1. `extract_invoice_data`
Extracts structured data from an invoice/receipt image.

**Parameters:**
- `filePath` (required): Full path to the invoice image file (PNG, JPEG, WEBP, or GIF)

**Returns:**
```json
{
  "date": "2025-11-17",
  "amount": 690,
  "merchant": "Drinks Section",
  "invoiceNumber": "83142",
  "description": "Restaurant meal",
  "category": "Travel"
}
```

### 2. `list_invoice_files`
Lists all invoice image files in a directory.

**Parameters:**
- `directory` (optional): Directory path to search (defaults to `tmp/invoices`)

**Returns:**
```json
{
  "directory": "/path/to/directory",
  "count": 5,
  "files": [
    {
      "name": "invoice1.png",
      "path": "/full/path/to/invoice1.png",
      "size": 123456
    }
  ]
}
```

## Usage in Claude Desktop

Once configured, you can use Claude Desktop to:

1. **Extract invoice data:**
   - "Extract data from the invoice at `/path/to/invoice.png`"
   - "Process this receipt: `/tmp/invoices/receipt.jpg`"

2. **List invoices:**
   - "List all invoice files in the tmp/invoices directory"
   - "Show me what invoice files are available"

3. **Batch processing:**
   - "Extract data from all invoices in the tmp/invoices folder"

## Testing the MCP Server

You can test the server directly:

```bash
npm run mcp-server
```

The server communicates via stdio, so it's designed to be used by Claude Desktop, not directly.

## Troubleshooting

1. **Server not appearing in Claude Desktop:**
   - Check that the `cwd` path in the config is absolute and correct
   - Ensure `npm run mcp-server` works when run from the project directory
   - Check Claude Desktop logs for errors

2. **API Key errors:**
   - Verify `CLAUDE_API_KEY` is set correctly
   - Check that the key starts with `sk-ant-`
   - Ensure the key has sufficient permissions

3. **File not found errors:**
   - Use absolute paths for file paths
   - Ensure the file exists and is readable
   - Check file format is supported (PNG, JPEG, WEBP, GIF)

## Notes

- The MCP server processes images using Claude 3.5 Sonnet (or fallback models)
- PDF files are not supported directly - convert to images first
- The server looks for invoice files in `tmp/invoices` by default
- All extracted data follows the same format as the web application







