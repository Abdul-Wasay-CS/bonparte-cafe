const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// ==================== API ENDPOINTS ====================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Cafe API is running' });
});

// Get all data files
app.get('/api/data', async (req, res) => {
    try {
        const files = ['menu', 'specials', 'events', 'contact'];
        const data = {};
        
        for (const file of files) {
            const filepath = path.join(DATA_DIR, `${file}.json`);
            try {
                const content = await fs.readFile(filepath, 'utf8');
                data[file] = JSON.parse(content);
            } catch (error) {
                console.error(`Error reading ${file}.json:`, error);
                data[file] = null;
            }
        }
        
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error getting all data:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to load data' 
        });
    }
});

// Get specific data file
app.get('/api/data/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        if (!filename.match(/^[a-zA-Z0-9_-]+\.json$/)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid filename' 
            });
        }
        
        const filepath = path.join(DATA_DIR, filename);
        const content = await fs.readFile(filepath, 'utf8');
        const data = JSON.parse(content);
        
        res.json({ success: true, data });
    } catch (error) {
        console.error(`Error reading ${req.params.filename}:`, error);
        
        if (error.code === 'ENOENT') {
            res.status(404).json({ 
                success: false, 
                error: 'File not found' 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: 'Failed to read file' 
            });
        }
    }
});

// Save data to specific file
app.post('/api/data/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        if (!filename.match(/^[a-zA-Z0-9_-]+\.json$/)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid filename' 
            });
        }
        
        const data = req.body;
        if (!data) {
            return res.status(400).json({ 
                success: false, 
                error: 'No data provided' 
            });
        }
        
        const filepath = path.join(DATA_DIR, filename);
        
        // Validate data structure based on filename
        const validationError = validateData(filename, data);
        if (validationError) {
            return res.status(400).json({ 
                success: false, 
                error: validationError 
            });
        }
        
        // Write to file with pretty formatting
        await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');
        
        console.log(`Successfully saved ${filename}`);
        
        res.json({ 
            success: true, 
            message: 'Data saved successfully',
            filename: filename,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error(`Error saving ${req.params.filename}:`, error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to save data' 
        });
    }
});

// Update specific item in data
app.put('/api/data/:filename/:id', async (req, res) => {
    try {
        const filename = req.params.filename;
        const id = parseInt(req.params.id);
        const updateData = req.body;
        
        if (!filename.match(/^[a-zA-Z0-9_-]+\.json$/)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid filename' 
            });
        }
        
        const filepath = path.join(DATA_DIR, filename);
        const content = await fs.readFile(filepath, 'utf8');
        const data = JSON.parse(content);
        
        // Determine data structure based on filename
        let items;
        if (filename === 'menu.json') {
            items = data.items;
        } else if (filename === 'specials.json') {
            items = data.specials;
        } else if (filename === 'events.json') {
            items = data.events;
        } else {
            return res.status(400).json({ 
                success: false, 
                error: 'Cannot update this file type' 
            });
        }
        
        // Find and update item
        const itemIndex = items.findIndex(item => item.id === id);
        if (itemIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                error: 'Item not found' 
            });
        }
        
        // Merge updates with existing item
        items[itemIndex] = { ...items[itemIndex], ...updateData };
        
        // Save updated data
        await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');
        
        res.json({ 
            success: true, 
            message: 'Item updated successfully',
            item: items[itemIndex]
        });
    } catch (error) {
        console.error(`Error updating item in ${req.params.filename}:`, error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update item' 
        });
    }
});

// Delete specific item
app.delete('/api/data/:filename/:id', async (req, res) => {
    try {
        const filename = req.params.filename;
        const id = parseInt(req.params.id);
        
        if (!filename.match(/^[a-zA-Z0-9_-]+\.json$/)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid filename' 
            });
        }
        
        const filepath = path.join(DATA_DIR, filename);
        const content = await fs.readFile(filepath, 'utf8');
        const data = JSON.parse(content);
        
        // Determine data structure based on filename
        let items, itemsKey;
        if (filename === 'menu.json') {
            itemsKey = 'items';
            items = data.items;
        } else if (filename === 'specials.json') {
            itemsKey = 'specials';
            items = data.specials;
        } else if (filename === 'events.json') {
            itemsKey = 'events';
            items = data.events;
        } else {
            return res.status(400).json({ 
                success: false, 
                error: 'Cannot delete from this file type' 
            });
        }
        
        // Find and remove item
        const itemIndex = items.findIndex(item => item.id === id);
        if (itemIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                error: 'Item not found' 
            });
        }
        
        const deletedItem = items[itemIndex];
        items.splice(itemIndex, 1);
        
        // Update the data object
        data[itemsKey] = items;
        
        // Save updated data
        await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');
        
        res.json({ 
            success: true, 
            message: 'Item deleted successfully',
            deletedItem: deletedItem
        });
    } catch (error) {
        console.error(`Error deleting item from ${req.params.filename}:`, error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete item' 
        });
    }
});

// Backup data
app.post('/api/backup', async (req, res) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(__dirname, 'backups', timestamp);
        
        await fs.mkdir(backupDir, { recursive: true });
        
        const files = await fs.readdir(DATA_DIR);
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                const source = path.join(DATA_DIR, file);
                const dest = path.join(backupDir, file);
                await fs.copyFile(source, dest);
            }
        }
        
        res.json({ 
            success: true, 
            message: 'Backup created successfully',
            backupPath: backupDir
        });
    } catch (error) {
        console.error('Error creating backup:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create backup' 
        });
    }
});

// ==================== HELPER FUNCTIONS ====================

function validateData(filename, data) {
    switch(filename) {
        case 'menu.json':
            if (!data.categories || !Array.isArray(data.categories)) {
                return 'Menu data must have a categories array';
            }
            if (!data.items || !Array.isArray(data.items)) {
                return 'Menu data must have an items array';
            }
            // Validate each item
            for (const item of data.items) {
                if (!item.id || !item.name || !item.category || !item.price || !item.description || !item.image) {
                    return 'Each menu item must have id, name, category, price, description, and image';
                }
            }
            break;
            
        case 'specials.json':
            if (!data.specials || !Array.isArray(data.specials)) {
                return 'Specials data must have a specials array';
            }
            // Validate each special
            for (const special of data.specials) {
                if (!special.id || !special.day || !special.name || !special.items || !special.price || !special.discount || !special.description) {
                    return 'Each special must have id, day, name, items, price, discount, and description';
                }
            }
            break;
            
        case 'events.json':
            if (!data.events || !Array.isArray(data.events)) {
                return 'Events data must have an events array';
            }
            // Validate each event
            for (const event of data.events) {
                if (!event.id || !event.name || !event.date || !event.description || !event.image || !event.tag) {
                    return 'Each event must have id, name, date, description, image, and tag';
                }
            }
            break;
            
        case 'contact.json':
            if (!data.address || !data.phone || !data.email || !data.workingHours || !data.socialMedia) {
                return 'Contact data must have address, phone, email, workingHours, and socialMedia';
            }
            if (!data.workingHours.weekdays || !data.workingHours.weekends) {
                return 'Contact data must have weekdays and weekends in workingHours';
            }
            if (!data.socialMedia.facebook || !data.socialMedia.instagram || !data.socialMedia.twitter || !data.socialMedia.tripadvisor) {
                return 'Contact data must have all social media links';
            }
            break;
            
        default:
            return null; // No validation for unknown files
    }
    
    return null; // Validation passed
}

// ==================== ERROR HANDLING ====================

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'API endpoint not found' 
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
    });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 The Bonparte Cafe Server`);
    console.log(`=========================================`);
    console.log(`📁 Frontend: http://localhost:${PORT}`);
    console.log(`⚙️  Admin Panel: http://localhost:${PORT}/admin.html`);
    console.log(`📊 API: http://localhost:${PORT}/api/health`);
    console.log(`📁 Data directory: ${DATA_DIR}`);
    console.log(`=========================================`);
    console.log(`Server started successfully! 🎉`);
    console.log(`Press Ctrl+C to stop the server`);
    console.log(`=========================================`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Server shutting down...');
    process.exit(0);
});