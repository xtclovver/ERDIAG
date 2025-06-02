// Менеджер базы данных для хранения диаграмм
const Database = require('better-sqlite3');
const CryptoJS = require('crypto-js');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.encryptionKey = null;
        this.isInitialized = false;
        
        this.init();
    }

    init() {
        try {
            // Определяем путь к базе данных
            const userDataPath = app.getPath('userData');
            const dbPath = path.join(userDataPath, 'er-diagrams.db');
            
            // Создаем директорию если не существует
            if (!fs.existsSync(userDataPath)) {
                fs.mkdirSync(userDataPath, { recursive: true });
            }

            // Инициализируем базу данных
            this.db = new Database(dbPath);
            this.db.pragma('journal_mode = WAL');
            
            // Создаем таблицы
            this.createTables();
            
            // Генерируем или загружаем ключ шифрования
            this.initEncryption();
            
            this.isInitialized = true;
            console.log('База данных инициализирована:', dbPath);
            
        } catch (error) {
            console.error('Ошибка инициализации базы данных:', error);
            throw error;
        }
    }

    createTables() {
        // Таблица для хранения диаграмм
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS diagrams (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                data TEXT NOT NULL,
                thumbnail TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                tags TEXT,
                is_encrypted INTEGER DEFAULT 1
            )
        `);

        // Таблица для хранения настроек приложения
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Таблица для хранения истории изменений
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS diagram_history (
                id TEXT PRIMARY KEY,
                diagram_id TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                description TEXT,
                FOREIGN KEY (diagram_id) REFERENCES diagrams (id) ON DELETE CASCADE
            )
        `);

        // Таблица для хранения шаблонов
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                data TEXT NOT NULL,
                category TEXT DEFAULT 'custom',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_system INTEGER DEFAULT 0
            )
        `);

        // Индексы для оптимизации
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_diagrams_updated_at ON diagrams(updated_at);
            CREATE INDEX IF NOT EXISTS idx_diagram_history_diagram_id ON diagram_history(diagram_id);
            CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
        `);
    }

    initEncryption() {
        // Проверяем, есть ли сохраненный ключ
        const savedKey = this.getSetting('encryption_key');
        
        if (savedKey) {
            this.encryptionKey = savedKey;
        } else {
            // Генерируем новый ключ
            this.encryptionKey = CryptoJS.lib.WordArray.random(256/8).toString();
            this.setSetting('encryption_key', this.encryptionKey);
        }
    }

    encrypt(data) {
        if (!this.encryptionKey) {
            throw new Error('Ключ шифрования не инициализирован');
        }
        
        const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), this.encryptionKey).toString();
        return encrypted;
    }

    decrypt(encryptedData) {
        if (!this.encryptionKey) {
            throw new Error('Ключ шифрования не инициализирован');
        }
        
        try {
            const decrypted = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
            const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
            return JSON.parse(decryptedString);
        } catch (error) {
            console.error('Ошибка расшифровки данных:', error);
            throw new Error('Не удалось расшифровать данные');
        }
    }

    // Методы для работы с диаграммами
    saveDiagram(diagramData, options = {}) {
        const {
            id = uuidv4(),
            name = 'Новая диаграмма',
            description = '',
            tags = [],
            thumbnail = null,
            saveHistory = true
        } = options;

        try {
            // Шифруем данные диаграммы
            const encryptedData = this.encrypt(diagramData);
            
            // Подготавливаем SQL запрос
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO diagrams 
                (id, name, description, data, thumbnail, tags, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);

            // Выполняем запрос
            const result = stmt.run(
                id,
                name,
                description,
                encryptedData,
                thumbnail,
                JSON.stringify(tags)
            );

            // Сохраняем в историю если нужно
            if (saveHistory) {
                this.saveToHistory(id, diagramData, 'Автосохранение');
            }

            console.log('Диаграмма сохранена:', id);
            return { id, success: true };

        } catch (error) {
            console.error('Ошибка сохранения диаграммы:', error);
            throw error;
        }
    }

    loadDiagram(id) {
        try {
            const stmt = this.db.prepare('SELECT * FROM diagrams WHERE id = ?');
            const row = stmt.get(id);

            if (!row) {
                throw new Error('Диаграмма не найдена');
            }

            // Расшифровываем данные
            const diagramData = this.decrypt(row.data);

            return {
                id: row.id,
                name: row.name,
                description: row.description,
                data: diagramData,
                thumbnail: row.thumbnail,
                tags: JSON.parse(row.tags || '[]'),
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };

        } catch (error) {
            console.error('Ошибка загрузки диаграммы:', error);
            throw error;
        }
    }

    getAllDiagrams() {
        try {
            const stmt = this.db.prepare(`
                SELECT id, name, description, thumbnail, tags, created_at, updated_at
                FROM diagrams 
                ORDER BY updated_at DESC
            `);
            
            const rows = stmt.all();
            
            return rows.map(row => ({
                id: row.id,
                name: row.name,
                description: row.description,
                thumbnail: row.thumbnail,
                tags: JSON.parse(row.tags || '[]'),
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }));

        } catch (error) {
            console.error('Ошибка получения списка диаграмм:', error);
            throw error;
        }
    }

    deleteDiagram(id) {
        try {
            const stmt = this.db.prepare('DELETE FROM diagrams WHERE id = ?');
            const result = stmt.run(id);

            if (result.changes === 0) {
                throw new Error('Диаграмма не найдена');
            }

            console.log('Диаграмма удалена:', id);
            return { success: true };

        } catch (error) {
            console.error('Ошибка удаления диаграммы:', error);
            throw error;
        }
    }

    searchDiagrams(query, options = {}) {
        const { tags = [], limit = 50 } = options;
        
        try {
            let sql = `
                SELECT id, name, description, thumbnail, tags, created_at, updated_at
                FROM diagrams 
                WHERE (name LIKE ? OR description LIKE ?)
            `;
            
            const params = [`%${query}%`, `%${query}%`];

            if (tags.length > 0) {
                const tagConditions = tags.map(() => 'tags LIKE ?').join(' AND ');
                sql += ` AND (${tagConditions})`;
                tags.forEach(tag => params.push(`%"${tag}"%`));
            }

            sql += ' ORDER BY updated_at DESC LIMIT ?';
            params.push(limit);

            const stmt = this.db.prepare(sql);
            const rows = stmt.all(...params);

            return rows.map(row => ({
                id: row.id,
                name: row.name,
                description: row.description,
                thumbnail: row.thumbnail,
                tags: JSON.parse(row.tags || '[]'),
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }));

        } catch (error) {
            console.error('Ошибка поиска диаграмм:', error);
            throw error;
        }
    }

    // Методы для работы с историей
    saveToHistory(diagramId, data, description = '') {
        try {
            const encryptedData = this.encrypt(data);
            
            const stmt = this.db.prepare(`
                INSERT INTO diagram_history (id, diagram_id, data, description)
                VALUES (?, ?, ?, ?)
            `);

            stmt.run(uuidv4(), diagramId, encryptedData, description);

            // Ограничиваем количество записей в истории (последние 50)
            const cleanupStmt = this.db.prepare(`
                DELETE FROM diagram_history 
                WHERE diagram_id = ? AND id NOT IN (
                    SELECT id FROM diagram_history 
                    WHERE diagram_id = ? 
                    ORDER BY created_at DESC 
                    LIMIT 50
                )
            `);
            
            cleanupStmt.run(diagramId, diagramId);

        } catch (error) {
            console.error('Ошибка сохранения в историю:', error);
        }
    }

    getDiagramHistory(diagramId, limit = 20) {
        try {
            const stmt = this.db.prepare(`
                SELECT id, data, created_at, description
                FROM diagram_history 
                WHERE diagram_id = ?
                ORDER BY created_at DESC
                LIMIT ?
            `);

            const rows = stmt.all(diagramId, limit);

            return rows.map(row => ({
                id: row.id,
                data: this.decrypt(row.data),
                createdAt: row.created_at,
                description: row.description
            }));

        } catch (error) {
            console.error('Ошибка получения истории:', error);
            throw error;
        }
    }

    // Методы для работы с шаблонами
    saveTemplate(templateData, options = {}) {
        const {
            id = uuidv4(),
            name = 'Новый шаблон',
            description = '',
            category = 'custom',
            isSystem = false
        } = options;

        try {
            const encryptedData = this.encrypt(templateData);
            
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO templates 
                (id, name, description, data, category, is_system)
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            stmt.run(id, name, description, encryptedData, category, isSystem ? 1 : 0);

            return { id, success: true };

        } catch (error) {
            console.error('Ошибка сохранения шаблона:', error);
            throw error;
        }
    }

    getTemplates(category = null) {
        try {
            let sql = 'SELECT * FROM templates';
            const params = [];

            if (category) {
                sql += ' WHERE category = ?';
                params.push(category);
            }

            sql += ' ORDER BY is_system DESC, name ASC';

            const stmt = this.db.prepare(sql);
            const rows = stmt.all(...params);

            return rows.map(row => ({
                id: row.id,
                name: row.name,
                description: row.description,
                data: this.decrypt(row.data),
                category: row.category,
                isSystem: row.is_system === 1,
                createdAt: row.created_at
            }));

        } catch (error) {
            console.error('Ошибка получения шаблонов:', error);
            throw error;
        }
    }

    // Методы для работы с настройками
    setSetting(key, value) {
        try {
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO settings (key, value, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            `);

            stmt.run(key, JSON.stringify(value));

        } catch (error) {
            console.error('Ошибка сохранения настройки:', error);
            throw error;
        }
    }

    getSetting(key, defaultValue = null) {
        try {
            const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
            const row = stmt.get(key);

            if (!row) {
                return defaultValue;
            }

            return JSON.parse(row.value);

        } catch (error) {
            console.error('Ошибка получения настройки:', error);
            return defaultValue;
        }
    }

    getAllSettings() {
        try {
            const stmt = this.db.prepare('SELECT key, value FROM settings');
            const rows = stmt.all();

            const settings = {};
            rows.forEach(row => {
                settings[row.key] = JSON.parse(row.value);
            });

            return settings;

        } catch (error) {
            console.error('Ошибка получения настроек:', error);
            return {};
        }
    }

    // Методы для экспорта/импорта
    exportDiagram(id, includeHistory = false) {
        try {
            const diagram = this.loadDiagram(id);
            const exportData = {
                diagram,
                exportedAt: new Date().toISOString(),
                version: '1.0'
            };

            if (includeHistory) {
                exportData.history = this.getDiagramHistory(id);
            }

            return exportData;

        } catch (error) {
            console.error('Ошибка экспорта диаграммы:', error);
            throw error;
        }
    }

    importDiagram(importData, options = {}) {
        const { generateNewId = true } = options;

        try {
            const diagram = importData.diagram;
            const id = generateNewId ? uuidv4() : diagram.id;

            // Сохраняем диаграмму
            this.saveDiagram(diagram.data, {
                id,
                name: diagram.name + (generateNewId ? ' (импорт)' : ''),
                description: diagram.description,
                tags: diagram.tags,
                thumbnail: diagram.thumbnail,
                saveHistory: false
            });

            // Импортируем историю если есть
            if (importData.history && importData.history.length > 0) {
                importData.history.forEach(historyItem => {
                    this.saveToHistory(id, historyItem.data, historyItem.description);
                });
            }

            return { id, success: true };

        } catch (error) {
            console.error('Ошибка импорта диаграммы:', error);
            throw error;
        }
    }

    // Методы для обслуживания базы данных
    vacuum() {
        try {
            this.db.exec('VACUUM');
            console.log('База данных оптимизирована');
        } catch (error) {
            console.error('Ошибка оптимизации базы данных:', error);
        }
    }

    backup(backupPath) {
        try {
            this.db.backup(backupPath);
            console.log('Резервная копия создана:', backupPath);
            return { success: true };
        } catch (error) {
            console.error('Ошибка создания резервной копии:', error);
            throw error;
        }
    }

    getStats() {
        try {
            const diagramCount = this.db.prepare('SELECT COUNT(*) as count FROM diagrams').get().count;
            const templateCount = this.db.prepare('SELECT COUNT(*) as count FROM templates').get().count;
            const historyCount = this.db.prepare('SELECT COUNT(*) as count FROM diagram_history').get().count;
            
            const dbSize = fs.statSync(this.db.name).size;

            return {
                diagrams: diagramCount,
                templates: templateCount,
                historyRecords: historyCount,
                databaseSize: dbSize
            };

        } catch (error) {
            console.error('Ошибка получения статистики:', error);
            return null;
        }
    }

    close() {
        if (this.db) {
            this.db.close();
            this.isInitialized = false;
            console.log('База данных закрыта');
        }
    }
}

module.exports = DatabaseManager; 