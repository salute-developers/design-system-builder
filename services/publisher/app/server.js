const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { exec, spawn } = require('child_process');

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
        console.log('Публикация файла:', absolutePath);

        // Публикуем пакет
        const result = await publishNpmPackage(absolutePath, npmToken);

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

// Улучшенная функция публикации
async function publishNpmPackage(tgzPath, npmToken) {
    return new Promise((resolve, reject) => {
        // Создаем временный .npmrc в той же директории что и tgz файл
        const npmrcPath = path.join(path.dirname(tgzPath), '.npmrc');
        const npmrcContent = `//registry.npmjs.org/:_authToken=${npmToken}
registry=https://registry.npmjs.org/
always-auth=true
`;

        fs.writeFileSync(npmrcPath, npmrcContent);

        console.log('Публикация пакета:', tgzPath);
        console.log('Временный .npmrc создан:', npmrcPath);

        // Используем абсолютный путь к файлу и явно указываем что это файл
        const publishCommand = `npm publish "${tgzPath}" --userconfig "${npmrcPath}"`;

        console.log('Выполняется команда:', publishCommand);

        const npmProcess = spawn('npm', [
            'publish',
            `"${tgzPath}"`,
            '--userconfig',
            `"${npmrcPath}"`
        ], {
            stdio: 'pipe',
            shell: true, // Важно для работы с путями в Windows
            cwd: path.dirname(tgzPath) // Рабочая директория там же где и файл
        });

        let stdout = '';
        let stderr = '';

        npmProcess.stdout.on('data', (data) => {
            const output = data.toString();
            stdout += output;
            console.log('npm stdout:', output);
        });

        npmProcess.stderr.on('data', (data) => {
            const output = data.toString();
            stderr += output;
            console.error('npm stderr:', output);
        });

        npmProcess.on('close', (code) => {
            // Всегда удаляем временный .npmrc
            if (fs.existsSync(npmrcPath)) {
                fs.removeSync(npmrcPath);
            }

            if (code === 0) {
                const packageInfo = parseNpmPublishOutput(stdout);
                resolve({
                    packageName: packageInfo.name,
                    version: packageInfo.version,
                    stdout: stdout
                });
            } else {
                const errorMessage = analyzeNpmError(stderr || stdout, tgzPath);
                reject(new Error(errorMessage));
            }
        });

        npmProcess.on('error', (error) => {
            if (fs.existsSync(npmrcPath)) {
                fs.removeSync(npmrcPath);
            }
            reject(new Error(`Ошибка запуска npm: ${error.message}`));
        });

        // Таймаут на случай зависания
        setTimeout(() => {
            if (npmProcess.exitCode === null) {
                npmProcess.kill();
                reject(new Error('Таймаут публикации (60 секунд)'));
            }
        }, 60000);
    });
}

// Анализ ошибок npm
function analyzeNpmError(errorOutput, filePath) {
    if (errorOutput.includes('code 128') && errorOutput.includes('git')) {
        return `npm ошибочно интерпретирует файл как git URL. Проблема с путем: ${filePath}\nУбедитесь что файл имеет правильное расширение .tgz и доступен для чтения.`;
    }

    if (errorOutput.includes('EPUBLISHCONFLICT')) {
        return 'Версия пакета уже существует. Увеличьте версию в package.json.';
    }

    if (errorOutput.includes('E403')) {
        if (errorOutput.includes('forbidden') || errorOutput.includes('public')) {
            return 'Доступ запрещен. Возможно пакет с таким именем уже существует или у токена нет прав на публикацию.';
        }
        return 'Доступ запрещен. Проверьте NPM токен.';
    }

    if (errorOutput.includes('E404')) {
        return 'Registry недоступен или пакет не найден.';
    }

    if (errorOutput.includes('Invalid package')) {
        return 'Невалидный package.json в архиве. Проверьте структуру пакета.';
    }

    if (errorOutput.includes('incorrect header check')) {
        return 'Файл поврежден или имеет неверный формат. Убедитесь что это валидный .tgz архив.';
    }

    return `Ошибка публикации: ${errorOutput.substring(0, 300)}`;
}

function parseNpmPublishOutput(output) {
    const patterns = [
        /\+ (.+?)@(.+?)$/m,
        /published (.+?)@(.+?) to registry/,
        /successfully published (.+?)@(.+?)$/,
        /√ Package (.+?)@(.+?) published/
    ];

    for (const pattern of patterns) {
        const match = output.match(pattern);
        if (match) {
            return {
                name: match[1],
                version: match[2]
            };
        }
    }

    // Пытаемся извлечь из имени файла
    const fileName = path.basename(output.includes('file:') ? output.split('file:')[1] : '');
    if (fileName) {
        const nameMatch = fileName.match(/(.+?)-(\d+\.\d+\.\d+)\.tgz/);
        if (nameMatch) {
            return {
                name: nameMatch[1],
                version: nameMatch[2]
            };
        }
    }

    return {
        name: 'unknown-package',
        version: '1.0.0'
    };
}

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

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Uploads directory: ${path.resolve('./uploads')}`);
});
