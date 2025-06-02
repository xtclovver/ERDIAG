// Менеджер для работы с файлами и базой данных
class FileManager {
    constructor(app) {
        this.app = app;
        this.currentFilePath = null;
        this.currentDiagramId = null;
        this.autoSaveInterval = null;
        
        this.startAutoSave();
    }

    // Сохранение в базу данных
    async saveToDB(options = {}) {
        try {
            const diagramData = this.app.getDiagramData();
            const { ipcRenderer } = require('electron');
            
            const saveOptions = {
                id: this.currentDiagramId,
                name: options.name || 'Новая диаграмма',
                description: options.description || '',
                tags: options.tags || [],
                thumbnail: await this.generateThumbnail(),
                ...options
            };

            const result = await ipcRenderer.invoke('save-diagram-to-db', diagramData, saveOptions);
            
            if (result.success) {
                this.currentDiagramId = result.id;
                this.app.isDirty = false;
                this.app.showNotification('Диаграмма сохранена в базу данных', 'success');
                this.updateWindowTitle();
                return result;
            }
        } catch (error) {
            console.error('Ошибка при сохранении в БД:', error);
            this.app.showNotification('Ошибка при сохранении в базу данных', 'error');
            throw error;
        }
    }

    // Загрузка из базы данных
    async loadFromDB(diagramId) {
        try {
            const { ipcRenderer } = require('electron');
            const diagram = await ipcRenderer.invoke('load-diagram-from-db', diagramId);
            
            if (diagram) {
                // Проверяем, есть ли несохраненные изменения
                if (this.app.isDirty) {
                    const result = confirm('У вас есть несохраненные изменения. Продолжить загрузку?');
                    if (!result) return;
                }

                // Очищаем текущую диаграмму
                this.app.canvas.clear();
                this.app.tables.clear();
                this.app.relations.clear();

                // Загружаем новые данные
                this.app.loadDiagramData(diagram.data);
                this.currentDiagramId = diagram.id;
                this.currentFilePath = null;
                
                this.app.showNotification('Диаграмма загружена из базы данных', 'success');
                this.updateWindowTitle(diagram.name);
                return diagram;
            }
        } catch (error) {
            console.error('Ошибка при загрузке из БД:', error);
            this.app.showNotification('Ошибка при загрузке из базы данных', 'error');
            throw error;
        }
    }

    // Получение всех диаграмм
    async getAllDiagrams() {
        try {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('get-all-diagrams');
        } catch (error) {
            console.error('Ошибка при получении диаграмм:', error);
            throw error;
        }
    }

    // Удаление диаграммы
    async deleteDiagram(diagramId) {
        try {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('delete-diagram', diagramId);
            
            if (result.success) {
                this.app.showNotification('Диаграмма удалена', 'success');
                
                // Если удаляем текущую диаграмму, создаем новую
                if (this.currentDiagramId === diagramId) {
                    this.newDiagram();
                }
            }
            return result;
        } catch (error) {
            console.error('Ошибка при удалении диаграммы:', error);
            this.app.showNotification('Ошибка при удалении диаграммы', 'error');
            throw error;
        }
    }

    // Поиск диаграмм
    async searchDiagrams(query, options = {}) {
        try {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('search-diagrams', query, options);
        } catch (error) {
            console.error('Ошибка при поиске диаграмм:', error);
            throw error;
        }
    }

    // Экспорт в файл
    async exportToFile() {
        try {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('show-save-dialog', {
                filters: [
                    { name: 'ER Диаграммы', extensions: ['erdiag'] },
                    { name: 'JSON файлы', extensions: ['json'] }
                ],
                defaultPath: 'diagram.erdiag'
            });

            if (!result.canceled) {
                const diagramData = this.app.getDiagramData();
                const exportData = {
                    version: '1.0',
                    exportedAt: new Date().toISOString(),
                    diagram: {
                        name: 'Экспортированная диаграмма',
                        data: diagramData
                    }
                };

                const fs = require('fs');
                fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2));
                
                this.app.showNotification('Диаграмма экспортирована в файл', 'success');
                return { success: true, filePath: result.filePath };
            }
        } catch (error) {
            console.error('Ошибка при экспорте в файл:', error);
            this.app.showNotification('Ошибка при экспорте в файл', 'error');
            throw error;
        }
    }

    // Импорт из файла
    async importFromFile(fileData) {
        try {
            const { ipcRenderer } = require('electron');
            
            // Проверяем формат данных
            let importData;
            if (fileData.version && fileData.diagram) {
                // Новый формат с метаданными
                importData = fileData;
            } else {
                // Старый формат - просто данные диаграммы
                importData = {
                    version: '1.0',
                    diagram: {
                        name: 'Импортированная диаграмма',
                        data: fileData
                    }
                };
            }

            const result = await ipcRenderer.invoke('import-diagram', importData, { generateNewId: true });
            
            if (result.success) {
                this.app.showNotification('Диаграмма импортирована в базу данных', 'success');
                return result;
            }
        } catch (error) {
            console.error('Ошибка при импорте из файла:', error);
            this.app.showNotification('Ошибка при импорте из файла', 'error');
            throw error;
        }
    }

    // Создание новой диаграммы
    newDiagram() {
        // Проверяем, есть ли несохраненные изменения
        if (this.app.isDirty) {
            const result = confirm('У вас есть несохраненные изменения. Создать новую диаграмму?');
            if (!result) return;
        }

        // Очищаем текущую диаграмму
        this.app.canvas.clear();
        this.app.tables.clear();
        this.app.relations.clear();
        
        this.currentDiagramId = null;
        this.currentFilePath = null;
        this.app.isDirty = false;
        
        this.updateWindowTitle();
        this.app.showNotification('Создана новая диаграмма', 'info');
    }

    // Генерация миниатюры
    async generateThumbnail() {
        try {
            const originalBackground = this.app.canvas.backgroundColor;
            this.app.canvas.backgroundColor = '#ffffff';
            
            const dataURL = this.app.canvas.toDataURL({
                format: 'png',
                quality: 0.8,
                multiplier: 0.5,
                width: 300,
                height: 200
            });

            this.app.canvas.backgroundColor = originalBackground;
            this.app.canvas.renderAll();
            
            return dataURL;
        } catch (error) {
            console.error('Ошибка при создании миниатюры:', error);
            return null;
        }
    }

    // Экспорт в PNG
    async exportPNG() {
        try {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('show-save-dialog', {
                filters: [{ name: 'PNG изображения', extensions: ['png'] }],
                defaultPath: 'diagram.png'
            });

            if (!result.canceled) {
                const originalBackground = this.app.canvas.backgroundColor;
                this.app.canvas.backgroundColor = '#ffffff';
                
                const dataURL = this.app.canvas.toDataURL({
                    format: 'png',
                    quality: 1,
                    multiplier: 2
                });

                this.app.canvas.backgroundColor = originalBackground;
                this.app.canvas.renderAll();

                const base64Data = dataURL.replace(/^data:image\/png;base64,/, '');
                const fs = require('fs');
                fs.writeFileSync(result.filePath, base64Data, 'base64');
                
                this.app.showNotification('Диаграмма экспортирована в PNG', 'success');
                return { success: true, filePath: result.filePath };
            }
        } catch (error) {
            console.error('Ошибка при экспорте в PNG:', error);
            this.app.showNotification('Ошибка при экспорте в PNG', 'error');
            throw error;
        }
    }

    // Экспорт в SVG
    async exportSVG() {
        try {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('show-save-dialog', {
                filters: [{ name: 'SVG изображения', extensions: ['svg'] }],
                defaultPath: 'diagram.svg'
            });

            if (!result.canceled) {
                const svgData = this.app.canvas.toSVG();
                const fs = require('fs');
                fs.writeFileSync(result.filePath, svgData);
                
                this.app.showNotification('Диаграмма экспортирована в SVG', 'success');
                return { success: true, filePath: result.filePath };
            }
        } catch (error) {
            console.error('Ошибка при экспорте в SVG:', error);
            this.app.showNotification('Ошибка при экспорте в SVG', 'error');
            throw error;
        }
    }

    // Экспорт в SQL
    async exportSQL() {
        try {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('show-save-dialog', {
                filters: [{ name: 'SQL файлы', extensions: ['sql'] }],
                defaultPath: 'database_schema.sql'
            });

            if (!result.canceled) {
                const sqlCode = this.generateSQL();
                const fs = require('fs');
                fs.writeFileSync(result.filePath, sqlCode);
                
                this.app.showNotification('SQL схема экспортирована', 'success');
                return { success: true, filePath: result.filePath };
            }
        } catch (error) {
            console.error('Ошибка при экспорте SQL:', error);
            this.app.showNotification('Ошибка при экспорте SQL', 'error');
            throw error;
        }
    }

    // Генерация SQL кода
    generateSQL() {
        let sql = '-- Сгенерированная SQL схема\n';
        sql += '-- Создано: ' + new Date().toLocaleString() + '\n\n';

        // Создаем таблицы
        this.app.tables.forEach((table, tableId) => {
            if (!table.fields || table.fields.length === 0) return;

            sql += `-- Таблица: ${table.tableName || 'Unnamed'}\n`;
            sql += `CREATE TABLE ${this.sanitizeTableName(table.tableName || 'unnamed_table')} (\n`;
            
            const fieldDefinitions = table.fields.map(field => {
                let definition = `    ${this.sanitizeFieldName(field.name)} ${field.type}`;
                
                if (field.isNotNull) {
                    definition += ' NOT NULL';
                }
                
                if (field.defaultValue) {
                    definition += ` DEFAULT '${field.defaultValue}'`;
                }
                
                if (field.isUnique) {
                    definition += ' UNIQUE';
                }
                
                return definition;
            });

            sql += fieldDefinitions.join(',\n');

            // Добавляем первичные ключи
            const primaryKeys = table.fields.filter(field => field.isPrimaryKey);
            if (primaryKeys.length > 0) {
                const pkFields = primaryKeys.map(field => this.sanitizeFieldName(field.name));
                sql += `,\n    PRIMARY KEY (${pkFields.join(', ')})`;
            }

            sql += '\n);\n\n';

            // Добавляем комментарий к таблице
            if (table.comment) {
                sql += `COMMENT ON TABLE ${this.sanitizeTableName(table.tableName)} IS '${table.comment}';\n\n`;
            }
        });

        // Добавляем внешние ключи на основе связей
        this.app.relations.forEach((relation, relationId) => {
            if (relation.fromTable && relation.toTable) {
                const fromTable = this.app.tables.get(relation.fromTable);
                const toTable = this.app.tables.get(relation.toTable);
                
                if (fromTable && toTable) {
                    sql += `-- Связь: ${relation.relationName || 'Unnamed relation'}\n`;
                    sql += `ALTER TABLE ${this.sanitizeTableName(fromTable.tableName)}\n`;
                    sql += `ADD CONSTRAINT fk_${fromTable.tableName}_${toTable.tableName}\n`;
                    sql += `FOREIGN KEY (id) REFERENCES ${this.sanitizeTableName(toTable.tableName)}(id);\n\n`;
                }
            }
        });

        return sql;
    }

    sanitizeTableName(name) {
        return name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    }

    sanitizeFieldName(name) {
        return name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    }

    updateWindowTitle(diagramName = null) {
        const { ipcRenderer } = require('electron');
        let title = 'ER Diagram Editor';
        
        if (diagramName) {
            title = `${diagramName} - ${title}`;
        } else if (this.currentDiagramId) {
            title = `Диаграмма - ${title}`;
        } else {
            title = `Новая диаграмма - ${title}`;
        }
        
        if (this.app.isDirty) {
            title = '• ' + title;
        }
        
        document.title = title;
    }

    // Автосохранение
    startAutoSave() {
        // Автосохранение каждые 5 минут
        this.autoSaveInterval = setInterval(() => {
            if (this.app.isDirty && this.currentDiagramId) {
                this.saveToDB({ saveHistory: false });
            }
        }, 5 * 60 * 1000);
    }

    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }

    // Получение истории диаграммы
    async getDiagramHistory(diagramId, limit = 20) {
        try {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('get-diagram-history', diagramId, limit);
        } catch (error) {
            console.error('Ошибка при получении истории:', error);
            throw error;
        }
    }

    // Работа с шаблонами
    async saveAsTemplate(templateData, options = {}) {
        try {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('save-template', templateData, options);
        } catch (error) {
            console.error('Ошибка при сохранении шаблона:', error);
            throw error;
        }
    }

    async getTemplates(category = null) {
        try {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('get-templates', category);
        } catch (error) {
            console.error('Ошибка при получении шаблонов:', error);
            throw error;
        }
    }

    // Статистика базы данных
    async getDBStats() {
        try {
            const { ipcRenderer } = require('electron');
            return await ipcRenderer.invoke('get-db-stats');
        } catch (error) {
            console.error('Ошибка при получении статистики:', error);
            throw error;
        }
    }

    // Резервное копирование
    async backupDatabase() {
        try {
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('show-save-dialog', {
                filters: [{ name: 'База данных', extensions: ['db'] }],
                defaultPath: `er-diagrams-backup-${new Date().toISOString().split('T')[0]}.db`
            });

            if (!result.canceled) {
                await ipcRenderer.invoke('backup-database', result.filePath);
                this.app.showNotification('Резервная копия создана', 'success');
                return { success: true, filePath: result.filePath };
            }
        } catch (error) {
            console.error('Ошибка при создании резервной копии:', error);
            this.app.showNotification('Ошибка при создании резервной копии', 'error');
            throw error;
        }
    }

    // Очистка при закрытии
    cleanup() {
        this.stopAutoSave();
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileManager;
} 