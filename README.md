# The Bonparte Cafe Website

A modern café website with an admin panel. Add menu items, update daily specials, and manage events — all through a simple interface.

## What You Need

- **Node.js** (version 14 or newer)  
  Download from [nodejs.org](https://nodejs.org/) if you don't have it.

## How to Run It

1. **Download** the project files to a folder on your computer
2. **Open terminal/command prompt** in that folder
3. **Install the backend**:
   ```bash
   cd backend
   npm install
   ```
4. **Start the server**:
   ```bash
   npm start
   ```
5. **Open your browser** to:
   - Main website: http://localhost:3000
   - Admin panel: http://localhost:3000/admin.html

That's it! The café website is now running locally on your computer.

## Quick Tips

- **To stop the server**: Press `Ctrl+C` in the terminal
- **For auto-restart during changes**: Use `npm run dev` instead of `npm start`
- **Admin password**: There isn't one yet (add one for production)
- **Data location**: All data saves to `backend/data/` as JSON files

Need help? Check the console for error messages.