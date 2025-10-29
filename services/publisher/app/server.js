const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const publisher = require('./publisher.js');

const app = express();
const PORT = process.env.PORT || 3007;

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = './uploads';
        fs.ensureDirSync(uploadDir);
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Убеждаемся что имя файла безопасное и имеет правильное расширение
        const originalName = path.parse(file.originalname).name;
        const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '-');
        cb(null, `${safeName}-${Date.now()}.tgz`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.tgz' || ext === '.tar.gz') {
            cb(null, true);
        } else {
            cb(new Error('Только .tgz или .tar.gz файлы разрешены'));
        }
    },
    limits: {
        fileSize: 100 * 1024 * 1024
    }
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// HTML форма
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '', './index.html'));
});

// Маршрут для загрузки и публикации
app.post('/upload', upload.single('package'), async (req, res) => {
    let filePath = null;

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }

        filePath = req.file.path;
        const npmToken = req.body.npmToken;

        if (!npmToken) {
            throw new Error('NPM токен не предоставлен');
        }

        // Проверяем что файл существует и доступен
        if (!fs.existsSync(filePath)) {
            throw new Error('Загруженный файл не найден');
        }

        // Получаем абсолютный путь к файлу
        const absolutePath = path.resolve(filePath);

        // Публикуем пакет
        const result = await publisher.publish(absolutePath, npmToken);

        res.json({
            success: true,
            message: 'Пакет успешно опубликован в npm',
            package: result.packageName,
            version: result.version,
            npmUrl: `https://www.npmjs.com/package/${result.packageName}`
        });

    } catch (error) {
        console.error('Ошибка публикации:', error);

        res.status(500).json({
            error: 'Ошибка при публикации пакета',
            details: error.message,
            suggestion: 'Убедитесь что файл является валидным npm пакетом .tgz'
        });
    } finally {
        // Очищаем временные файлы
        if (filePath) {
            await fs.remove(filePath).catch(console.error);
        }
    }
});

// Маршрут для проверки файла
app.post('/validate', upload.single('package'), async (req, res) => {
    let filePath = null;

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }

        filePath = req.file.path;

        const stats = fs.statSync(filePath);
        const fileInfo = {
            filename: req.file.originalname,
            storedName: path.basename(filePath),
            size: stats.size,
            sizeHuman: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
            absolutePath: path.resolve(filePath),
            exists: true,
            isFile: stats.isFile()
        };

        // Проверяем расширение
        const ext = path.extname(filePath).toLowerCase();
        fileInfo.extension = ext;
        fileInfo.isTgz = ext === '.tgz' || filePath.toLowerCase().endsWith('.tar.gz');

        res.json({
            success: true,
            fileInfo: fileInfo,
            suggestions: fileInfo.isTgz ? [] : ['Рекомендуется использовать расширение .tgz']
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (filePath) {
            await fs.remove(filePath).catch(console.error);
        }
    }
});

const timeStart = new Date().toLocaleString();

app.get('/health', async (req, res) => {
    res.status(200).json({
        status: 'ok',
        startedAt: timeStart,
    });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Uploads directory: ${path.resolve('./uploads')}`);
});
