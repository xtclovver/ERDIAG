// Менеджер для работы с файлами
class FileManager {
    constructor(app) {
        this.app = app;
        this.currentFilePath = null;
    }

    async saveAs() {
        try {
            const diagramData = this.app.getDiagramData();
            const { ipcRenderer } = require('electron');
            
            const result = await ipcRenderer.invoke('save-diagram-dialog', diagramData);
            
            if (result.success) {
                this.currentFilePath = result.filePath;
                this.app.currentFilePath = result.filePath;
                this.app.isDirty = false;
                this.app.showNotification('Диаграмма сохранена успешно', 'success');
                this.updateWindowTitle();
            } else if (!result.canceled) {
                this.app.showNotification('Ошибка при сохранении: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Ошибка при сохранении:', error);
            this.app.showNotification('Ошибка при сохранении файла', 'error');
        }
    }

    async save(filePath = null) {
        if (!filePath && !this.currentFilePath) {
            return this.saveAs();
        }

        try {
            const diagramData = this.app.getDiagramData();
            const { ipcRenderer } = require('electron');
            
            // Если путь не указан, используем текущий
            const targetPath = filePath || this.currentFilePath;
            
            // Сохраняем напрямую в файл
            const fs = require('fs');
            fs.writeFileSync(targetPath, JSON.stringify(diagramData, null, 2));
            
            this.currentFilePath = targetPath;
            this.app.currentFilePath = targetPath;
            this.app.isDirty = false;
            this.app.showNotification('Диаграмма сохранена', 'success');
            this.updateWindowTitle();
        } catch (error) {
            console.error('Ошибка при сохранении:', error);
            this.app.showNotification('Ошибка при сохранении файла', 'error');
        }
    }

    load(data) {
        try {
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
            this.app.loadDiagramData(data);
            
            this.app.showNotification('Диаграмма загружена успешно', 'success');
            this.updateWindowTitle();
        } catch (error) {
            console.error('Ошибка при загрузке:', error);
            this.app.showNotification('Ошибка при загрузке файла', 'error');
        }
    }

    async exportPNG() {
        try {
            // Создаем временный canvas для экспорта
            const originalBackground = this.app.canvas.backgroundColor;
            this.app.canvas.backgroundColor = '#ffffff';
            
            // Получаем данные изображения
            const dataURL = this.app.canvas.toDataURL({
                format: 'png',
                quality: 1,
                multiplier: 2 // Увеличиваем разрешение для лучшего качества
            });

            // Восстанавливаем оригинальный фон
            this.app.canvas.backgroundColor = originalBackground;
            this.app.canvas.renderAll();

            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('export-png-dialog', dataURL);

            if (result.success) {
                this.app.showNotification('Диаграмма экспортирована в PNG', 'success');
            } else if (!result.canceled) {
                this.app.showNotification('Ошибка при экспорте: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('Ошибка при экспорте:', error);
            this.app.showNotification('Ошибка при экспорте в PNG', 'error');
        }
    }

    async exportSVG() {
        try {
            const svgData = this.app.canvas.toSVG();
            const blob = new Blob([svgData], { type: 'image/svg+xml' });
            
            // Создаем ссылку для скачивания
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'diagram.svg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.app.showNotification('Диаграмма экспортирована в SVG', 'success');
        } catch (error) {
            console.error('Ошибка при экспорте в SVG:', error);
            this.app.showNotification('Ошибка при экспорте в SVG', 'error');
        }
    }

    async exportSQL() {
        try {
            const sqlCode = this.generateSQL();
            
            // Создаем blob с SQL кодом
            const blob = new Blob([sqlCode], { type: 'text/sql' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'database_schema.sql';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.app.showNotification('SQL схема экспортирована', 'success');
        } catch (error) {
            console.error('Ошибка при экспорте SQL:', error);
            this.app.showNotification('Ошибка при экспорте SQL', 'error');
        }
    }

    generateSQL() {
        let sql = '-- Сгенерированная SQL схема\n';
        sql += '-- Создано: ' + new Date().toLocaleString() + '\n\n';

        // Создаем таблицы
        this.app.tables.forEach((table, tableId) => {
            sql += `-- Таблица: ${table.name}\n`;
            sql += `CREATE TABLE ${this.sanitizeTableName(table.name)} (\n`;
            
            const fieldDefinitions = table.fields.map(field => {
                let definition = `    ${this.sanitizeFieldName(field.name)} ${field.type}`;
                
                if (field.isNotNull) {
                    definition += ' NOT NULL';
                }
                
                if (field.isAutoIncrement) {
                    definition += ' AUTO_INCREMENT';
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
        });

        // Добавляем внешние ключи на основе связей
        this.app.relations.forEach((relation, relationId) => {
            const fromTable = this.app.tables.get(relation.fromTable);
            const toTable = this.app.tables.get(relation.toTable);
            
            if (fromTable && toTable) {
                sql += `-- Связь: ${relation.name}\n`;
                sql += `ALTER TABLE ${this.sanitizeTableName(fromTable.name)}\n`;
                sql += `ADD CONSTRAINT FK_${relation.id}\n`;
                sql += `FOREIGN KEY (${this.sanitizeFieldName(toTable.name.toLowerCase() + '_id')})\n`;
                sql += `REFERENCES ${this.sanitizeTableName(toTable.name)}(id);\n\n`;
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

    updateWindowTitle() {
        const { remote } = require('electron');
        const window = remote.getCurrentWindow();
        
        let title = 'ER Diagram Editor';
        if (this.currentFilePath) {
            const path = require('path');
            const fileName = path.basename(this.currentFilePath);
            title = `${fileName} - ER Diagram Editor`;
        }
        
        if (this.app.isDirty) {
            title = '• ' + title;
        }
        
        window.setTitle(title);
    }

    // Автосохранение
    startAutoSave() {
        setInterval(() => {
            if (this.app.isDirty && this.currentFilePath) {
                this.createBackup();
            }
        }, 300000); // Каждые 5 минут
    }

    createBackup() {
        try {
            if (!this.currentFilePath) return;
            
            const path = require('path');
            const fs = require('fs');
            
            const backupPath = this.currentFilePath.replace(
                path.extname(this.currentFilePath),
                '.backup' + path.extname(this.currentFilePath)
            );
            
            const diagramData = this.app.getDiagramData();
            fs.writeFileSync(backupPath, JSON.stringify(diagramData, null, 2));
            
            console.log('Создана резервная копия:', backupPath);
        } catch (error) {
            console.error('Ошибка при создании резервной копии:', error);
        }
    }

    // Импорт из различных форматов
    async importFromJSON(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            this.load(data);
        } catch (error) {
            this.app.showNotification('Ошибка при импорте JSON', 'error');
        }
    }

    // Экспорт в различные форматы
    async exportToJSON() {
        try {
            const diagramData = this.app.getDiagramData();
            const jsonString = JSON.stringify(diagramData, null, 2);
            
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'diagram.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.app.showNotification('Диаграмма экспортирована в JSON', 'success');
        } catch (error) {
            this.app.showNotification('Ошибка при экспорте JSON', 'error');
        }
    }

    // Получение информации о файле
    getFileInfo() {
        if (!this.currentFilePath) return null;
        
        const fs = require('fs');
        const path = require('path');
        
        try {
            const stats = fs.statSync(this.currentFilePath);
            return {
                path: this.currentFilePath,
                name: path.basename(this.currentFilePath),
                size: stats.size,
                modified: stats.mtime,
                created: stats.birthtime
            };
        } catch (error) {
            return null;
        }
    }

    // Проверка на изменения файла
    checkFileChanges() {
        if (!this.currentFilePath) return;
        
        const fileInfo = this.getFileInfo();
        if (fileInfo && this.lastModified && fileInfo.modified > this.lastModified) {
            const result = confirm('Файл был изменен другой программой. Перезагрузить?');
            if (result) {
                this.reloadFile();
            }
        }
    }

    async reloadFile() {
        if (!this.currentFilePath) return;
        
        try {
            const fs = require('fs');
            const data = fs.readFileSync(this.currentFilePath, 'utf8');
            const parsedData = JSON.parse(data);
            this.load(parsedData);
        } catch (error) {
            this.app.showNotification('Ошибка при перезагрузке файла', 'error');
        }
    }

    // Очистка временных файлов
    cleanupTempFiles() {
        // Удаляем старые резервные копии
        if (this.currentFilePath) {
            const path = require('path');
            const fs = require('fs');
            
            try {
                const backupPath = this.currentFilePath.replace(
                    path.extname(this.currentFilePath),
                    '.backup' + path.extname(this.currentFilePath)
                );
                
                if (fs.existsSync(backupPath)) {
                    const stats = fs.statSync(backupPath);
                    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                    
                    if (stats.mtime < dayAgo) {
                        fs.unlinkSync(backupPath);
                        console.log('Удалена старая резервная копия');
                    }
                }
            } catch (error) {
                console.error('Ошибка при очистке временных файлов:', error);
            }
        }
    }
} 