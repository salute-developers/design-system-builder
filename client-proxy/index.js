const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3003;

// Storage directory
const STORAGE_DIR = path.join(__dirname, 'storage');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Ensure storage directory exists
fs.ensureDirSync(STORAGE_DIR);

// Helper function to get file path for a design system
const getFilePath = (name, version) => {
    const fileName = `${name}@${version}.json`;
    return path.join(STORAGE_DIR, fileName);
};

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Client proxy server is running' });
});

// Save design system
app.post('/api/design-systems', async (req, res) => {
    try {
        const { name, version, themeData, componentsData } = req.body;

        if (!name || !version) {
            return res.status(400).json({ 
                error: 'Name and version are required' 
            });
        }

        const data = {
            themeData,
            componentsData,
            savedAt: new Date().toISOString()
        };

        const filePath = getFilePath(name, version);
        await fs.writeJson(filePath, data, { spaces: 2 });

        console.log(`Saved design system: ${name}@${version}`);
        res.json({ 
            success: true, 
            message: `Design system ${name}@${version} saved successfully` 
        });

    } catch (error) {
        console.error('Error saving design system:', error);
        res.status(500).json({ 
            error: 'Failed to save design system',
            details: error.message 
        });
    }
});

// Load specific design system
app.get('/api/design-systems/:name/:version', async (req, res) => {
    try {
        const { name, version } = req.params;
        const filePath = getFilePath(name, version);

        if (!await fs.pathExists(filePath)) {
            return res.status(404).json({ 
                error: 'Design system not found' 
            });
        }

        const data = await fs.readJson(filePath);
        
        console.log(`Loaded design system: ${name}@${version}`);
        res.json({
            themeData: data.themeData,
            componentsData: data.componentsData
        });

    } catch (error) {
        console.error('Error loading design system:', error);
        res.status(500).json({ 
            error: 'Failed to load design system',
            details: error.message 
        });
    }
});

// List all design systems
app.get('/api/design-systems', async (req, res) => {
    try {
        const files = await fs.readdir(STORAGE_DIR);
        const designSystems = files
            .filter(file => file.endsWith('.json'))
            .map(file => {
                const nameVersion = file.replace('.json', '');
                const [name, version] = nameVersion.split('@');
                return [name, version];
            })
            .filter(([name, version]) => name && version);

        if (designSystems.length === 0) {
            return res.json(undefined);
        }

        console.log(`Listed ${designSystems.length} design systems`);
        res.json(designSystems);

    } catch (error) {
        console.error('Error listing design systems:', error);
        res.status(500).json({ 
            error: 'Failed to list design systems',
            details: error.message 
        });
    }
});

// Delete design system
app.delete('/api/design-systems/:name/:version', async (req, res) => {
    try {
        const { name, version } = req.params;
        const filePath = getFilePath(name, version);

        if (!await fs.pathExists(filePath)) {
            return res.status(404).json({ 
                error: 'Design system not found' 
            });
        }

        await fs.remove(filePath);
        
        console.log(`Deleted design system: ${name}@${version}`);
        res.json({ 
            success: true, 
            message: `Design system ${name}@${version} deleted successfully` 
        });

    } catch (error) {
        console.error('Error deleting design system:', error);
        res.status(500).json({ 
            error: 'Failed to delete design system',
            details: error.message 
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        details: err.message 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Endpoint not found',
        path: req.path 
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Client proxy server running on port ${PORT}`);
    console.log(`📁 Storage directory: ${STORAGE_DIR}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});
