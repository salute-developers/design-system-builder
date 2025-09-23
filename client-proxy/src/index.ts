import createApp from './app';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3003;

// Create app instance
const app = createApp();

app.listen(PORT, () => {
    console.log(`🚀 Client proxy server running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});
