# 🚀 Glama Deployment Guide for Formula 1 MCP Server

This guide will walk you through deploying your Formula 1 MCP server to Glama.

## Prerequisites

1. **GitHub Account** - Your code should be in a GitHub repository
2. **Glama Account** - Sign up at [glama.ai](https://glama.ai)
3. **Node.js 18+** - Required for building (already configured)

## Step 1: Prepare Your Repository

### 1.1 Ensure Your Code is Committed

Make sure all your changes are committed and pushed to GitHub:

```bash
git add .
git commit -m "Prepare for Glama deployment"
git push origin main
```

### 1.2 Verify Project Structure

Your project should have:
- ✅ `package.json` with proper dependencies
- ✅ `Dockerfile` (already present)
- ✅ `tsconfig.json` (already present)
- ✅ `src/index.ts` as the main entry point
- ✅ `build/` directory excluded from git (in `.gitignore`)

## Step 2: Deploy to Glama

### Option A: GitHub Integration (Recommended)

1. **Log in to Glama**
   - Go to [glama.ai](https://glama.ai)
   - Sign up or log in with your GitHub account

2. **Create New MCP Server**
   - Click "Add Server" or "Deploy Server"
   - Select "Deploy from GitHub"

3. **Connect Your Repository**
   - Authorize Glama to access your GitHub repositories
   - Select your `formula1-mcp` repository
   - Choose the branch (usually `main` or `master`)

4. **Configure Build Settings**
   Glama should auto-detect your setup, but verify:
   - **Build Command**: `npm run build`
   - **Start Command**: `node build/index.js`
   - **Node Version**: 20 (or latest LTS)
   - **Working Directory**: `/` (root)

5. **Environment Variables** (if needed)
   - `F1_SESSION_ID`: Optional - Specific F1 session ID
   - `CACHE_ENABLED`: Optional - Set to `true` or `false` (default: `true`)

6. **Deploy**
   - Click "Deploy" and wait for the build to complete
   - Monitor the logs for any errors

### Option B: Docker Deployment

If Glama supports Docker deployment:

1. **Verify Dockerfile**
   Your Dockerfile is already configured correctly:
   ```dockerfile
   FROM node:20-slim
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build
   CMD ["node", "build/index.js"]
   ```

2. **Deploy via Docker**
   - In Glama, select "Deploy from Docker"
   - Provide your Docker image or repository
   - Glama will build and deploy from your Dockerfile

## Step 3: Verify Deployment

### 3.1 Check Server Status

Once deployed, verify:
- ✅ Server shows as "Running" in Glama dashboard
- ✅ No errors in the logs
- ✅ Health check passes

### 3.2 Test Your Server

Use Glama's testing interface to:
1. List available tools
2. Test individual tools (e.g., `getLiveTimingData`)
3. Verify responses are correct

### 3.3 Monitor Logs

- Check Glama's log viewer for:
  - Server startup messages
  - Tool execution logs
  - Any errors or warnings

## Step 4: Configure Access

### 4.1 Get Your Server URL/Endpoint

Glama will provide:
- **Server Endpoint**: Unique URL for your MCP server
- **API Key**: For authentication (if required)

### 4.2 Update MCP Clients

Update your MCP client configuration to use Glama:

```json
{
  "mcpServers": {
    "formula1": {
      "url": "https://your-server-id.glama.ai/mcp",
      "apiKey": "your-api-key-here"
    }
  }
}
```

Or if Glama uses a different connection method, follow their specific instructions.

## Troubleshooting

### Build Fails

**Issue**: Build fails during deployment
**Solution**:
- Check that all dependencies are in `package.json`
- Verify `npm run build` works locally
- Check Glama build logs for specific errors

### Server Won't Start

**Issue**: Server deploys but won't start
**Solution**:
- Verify `build/index.js` exists after build
- Check that the start command is correct
- Review server logs in Glama dashboard

### Tools Not Available

**Issue**: Tools don't appear or fail to execute
**Solution**:
- Verify server initialized correctly (check logs)
- Ensure MCP SDK version is compatible
- Test tools individually in Glama's interface

### Connection Issues

**Issue**: Can't connect to deployed server
**Solution**:
- Verify server is running (check status)
- Check firewall/network settings
- Verify endpoint URL is correct
- Check API key/authentication

## Best Practices

1. **Use Environment Variables**
   - Store sensitive data in Glama's environment variable settings
   - Don't commit secrets to GitHub

2. **Monitor Performance**
   - Use Glama's monitoring tools
   - Set up alerts for errors
   - Track usage metrics

3. **Version Control**
   - Tag releases in GitHub
   - Use semantic versioning
   - Document changes in commit messages

4. **Testing**
   - Test locally before deploying
   - Use Glama's testing interface
   - Monitor logs after deployment

## Support

- **Glama Documentation**: Check Glama's official docs
- **GitHub Issues**: Report issues in your repo
- **MCP Community**: Join MCP Discord/forums

## Next Steps

After successful deployment:

1. ✅ Share your server URL with users
2. ✅ Update README with Glama deployment info
3. ✅ Monitor usage and performance
4. ✅ Iterate based on feedback

---

**Ready to deploy?** Make sure your code is pushed to GitHub, then head to [glama.ai](https://glama.ai) to get started! 🏎️💨

