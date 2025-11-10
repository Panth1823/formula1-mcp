# Installing Formula 1 MCP Server in Claude Desktop

## Quick Setup Guide

### Step 1: Locate Your Config File

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```
Full path: `C:\Users\panth\AppData\Roaming\Claude\claude_desktop_config.json`

**Mac:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

### Step 2: Edit the Config File

Open the file in a text editor (create it if it doesn't exist) and add:

```json
{
  "mcpServers": {
    "formula1": {
      "command": "node",
      "args": [
        "C:\\Users\\panth\\OneDrive\\Desktop\\formula1-mcp\\build\\index.js"
      ],
      "env": {}
    }
  }
}
```

**Important:** If you already have other MCP servers configured, just add the `formula1` section inside the existing `mcpServers` object.

### Step 3: Restart Claude Desktop

1. Completely close Claude Desktop
2. Reopen it
3. The Formula 1 MCP server should now be available

### Step 4: Test It

In Claude Desktop, try asking:
- "Get the 2024 F1 driver standings"
- "Show me the 2025 race calendar"
- "Get weather data for session key 9159"

You should see Claude using the Formula 1 MCP tools!

---

## Troubleshooting

### Issue: Server Not Showing Up

**Check:**
1. Config file path is correct
2. JSON syntax is valid (no trailing commas)
3. Path to `build/index.js` is correct
4. Claude Desktop was fully restarted

### Issue: Server Errors

**Check:**
1. Run `npm run build` to ensure latest build
2. Check Claude Desktop logs at:
   - Windows: `%APPDATA%\Claude\logs`
   - Mac: `~/Library/Logs/Claude`

### Issue: Path with Spaces

If your path has spaces, use double backslashes:
```json
"C:\\Program Files\\formula1-mcp\\build\\index.js"
```

---

## Viewing MCP Server Status

In Claude Desktop:
1. Look for the 🔌 icon in the bottom-left
2. Click it to see connected MCP servers
3. "formula1" should appear in the list

---

## Alternative: Manual Testing

You can test the server directly without Claude Desktop:

```bash
cd C:\Users\panth\OneDrive\Desktop\formula1-mcp
node build/index.js
```

Then manually send JSON-RPC requests to test functionality.
