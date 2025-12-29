# Installation Instructions

## Fixing npm Permission Issues

If you're seeing npm permission errors, try these solutions:

### Solution 1: Fix npm Cache Permissions (Recommended)

```bash
# Fix npm cache permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Then install dependencies
npm install
```

### Solution 2: Use npm with --force (Quick Fix)

```bash
npm install --force
```

### Solution 3: Clear npm cache and reinstall

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

### Solution 4: Use a Node Version Manager (Best Long-term Solution)

If you have permission issues often, consider using nvm (Node Version Manager):

```bash
# Install nvm (if not already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal or run:
source ~/.bashrc  # or ~/.zshrc

# Install Node.js via nvm (this avoids permission issues)
nvm install 18
nvm use 18

# Now npm install should work without permissions issues
npm install
```

## Installing Dependencies

Once permissions are fixed, install the dependencies:

```bash
cd /Users/Pranav_1/darwinbox-reimbursements
npm install
```

This will install:
- `ioredis` - For Redis connection (new dependency)
- All other existing dependencies

## Verify Installation

After installation, verify:

```bash
# Check if ioredis is installed
npm list ioredis

# Should show: ioredis@5.3.2 (or similar version)
```

## What's Already Done

✅ `package.json` has been updated with `ioredis` dependency
✅ All code files are ready
✅ You just need to run `npm install` (after fixing permissions)

## Next Steps

After `npm install` completes successfully:

1. Continue with GETTING_STARTED.md
2. Setup your accounts (Upstash, Telegram, etc.)
3. Deploy to Vercel
4. Setup VPS and services




