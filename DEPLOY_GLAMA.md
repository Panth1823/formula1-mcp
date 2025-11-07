# 🚀 Quick Start: Deploy to Glama

## Prerequisites Checklist

- [ ] Code is committed and pushed to GitHub
- [ ] `npm run build` works locally
- [ ] `npm start` runs the server successfully
- [ ] You have a Glama account (sign up at [glama.ai](https://glama.ai))

## Quick Deployment Steps

### 1. Push to GitHub
```bash
git add .
git commit -m "Ready for Glama deployment"
git push origin main
```

### 2. Deploy on Glama

1. Go to [glama.ai](https://glama.ai) and log in
2. Click **"Add Server"** or **"Deploy"**
3. Select **"Deploy from GitHub"**
4. Authorize Glama to access your GitHub
5. Select repository: `formula1-mcp`
6. Branch: `main` (or your default branch)

### 3. Configure Build Settings

Glama should auto-detect, but verify:

- **Build Command**: `npm run build`
- **Start Command**: `npm start` or `node build/index.js`
- **Node Version**: `20` (LTS)
- **Working Directory**: `/` (root)

### 4. Environment Variables (Optional)

Add if needed:
- `F1_SESSION_ID`: Specific F1 session ID
- `CACHE_ENABLED`: `true` or `false` (default: `true`)

### 5. Deploy & Test

1. Click **"Deploy"**
2. Wait for build to complete
3. Check logs for errors
4. Test your server in Glama's interface

## Verify Deployment

✅ Server status shows "Running"  
✅ No errors in logs  
✅ Tools are listed correctly  
✅ Can execute test tool calls  

## Troubleshooting

**Build fails?**
- Check logs for specific errors
- Verify `npm run build` works locally
- Ensure all dependencies are in `package.json`

**Server won't start?**
- Check that `build/index.js` exists
- Verify start command is correct
- Review server logs

**Need help?**
- Check full guide: `GLAMA_DEPLOYMENT.md`
- Review Glama documentation
- Check server logs in Glama dashboard

---

**Ready?** Push your code and deploy! 🏎️💨

