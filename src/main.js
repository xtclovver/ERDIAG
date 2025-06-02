const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const DatabaseManager = require('./js/database-manager');

let mainWindow;
let dbManager;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle: 'hiddenInset',
    title: 'ER Diagram Editor'
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Открыть DevTools в режиме разработки
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Создание меню приложения
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Новая диаграмма',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('new-diagram');
          }
        },
        {
          label: 'Открыть из базы...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('show-diagram-library');
          }
        },
        {
          label: 'Импорт файла...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'ER Диаграммы', extensions: ['erdiag'] },
                { name: 'JSON файлы', extensions: ['json'] }
              ]
            });

            if (!result.canceled && result.filePaths.length > 0) {
              try {
                const data = fs.readFileSync(result.filePaths[0], 'utf8');
                mainWindow.webContents.send('import-diagram', JSON.parse(data));
              } catch (error) {
                dialog.showErrorBox('Ошибка', 'Не удалось открыть файл: ' + error.message);
              }
            }
          }
        },
        {
          label: 'Сохранить',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('save-diagram');
          }
        },
        {
          label: 'Сохранить как...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow.webContents.send('save-diagram-as');
          }
        },
        { type: 'separator' },
        {
          label: 'Экспорт в PNG',
          click: () => {
            mainWindow.webContents.send('export-png');
          }
        },
        {
          label: 'Экспорт в файл...',
          click: () => {
            mainWindow.webContents.send('export-to-file');
          }
        },
        { type: 'separator' },
        {
          label: 'Библиотека диаграмм',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            mainWindow.webContents.send('show-diagram-library');
          }
        },
        { type: 'separator' },
        {
          label: 'Выход',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Правка',
      submenu: [
        {
          label: 'Отменить',
          accelerator: 'CmdOrCtrl+Z',
          click: () => {
            mainWindow.webContents.send('undo');
          }
        },
        {
          label: 'Повторить',
          accelerator: 'CmdOrCtrl+Y',
          click: () => {
            mainWindow.webContents.send('redo');
          }
        },
        { type: 'separator' },
        {
          label: 'Копировать',
          accelerator: 'CmdOrCtrl+C',
          click: () => {
            mainWindow.webContents.send('copy');
          }
        },
        {
          label: 'Вставить',
          accelerator: 'CmdOrCtrl+V',
          click: () => {
            mainWindow.webContents.send('paste');
          }
        },
        {
          label: 'Удалить',
          accelerator: 'Delete',
          click: () => {
            mainWindow.webContents.send('delete');
          }
        }
      ]
    },
    {
      label: 'Вид',
      submenu: [
        {
          label: 'Увеличить',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            mainWindow.webContents.send('zoom-in');
          }
        },
        {
          label: 'Уменьшить',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            mainWindow.webContents.send('zoom-out');
          }
        },
        {
          label: 'Сбросить масштаб',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            mainWindow.webContents.send('zoom-reset');
          }
        },
        { type: 'separator' },
        {
          label: 'Показать сетку',
          type: 'checkbox',
          checked: true,
          click: (menuItem) => {
            mainWindow.webContents.send('toggle-grid', menuItem.checked);
          }
        }
      ]
    },
    {
      label: 'Инструменты',
      submenu: [
        {
          label: 'Добавить таблицу',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            mainWindow.webContents.send('add-table');
          }
        },
        {
          label: 'Добавить связь',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.webContents.send('add-relation');
          }
        },
        { type: 'separator' },
        {
          label: 'Шаблоны',
          click: () => {
            mainWindow.webContents.send('show-templates');
          }
        }
      ]
    },
    {
      label: 'Справка',
      submenu: [
        {
          label: 'О программе',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'О программе',
              message: 'ER Diagram Editor',
              detail: 'Редактор ER-диаграмм для проектирования баз данных\nВерсия 1.0.0'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC обработчики для работы с базой данных
function setupIpcHandlers() {
  // Сохранение диаграммы
  ipcMain.handle('save-diagram-to-db', async (event, diagramData, options) => {
    try {
      const result = await dbManager.saveDiagram(diagramData, options);
      return result;
    } catch (error) {
      console.error('Ошибка сохранения диаграммы:', error);
      throw error;
    }
  });

  // Загрузка диаграммы
  ipcMain.handle('load-diagram-from-db', async (event, id) => {
    try {
      const diagram = await dbManager.loadDiagram(id);
      return diagram;
    } catch (error) {
      console.error('Ошибка загрузки диаграммы:', error);
      throw error;
    }
  });

  // Получение всех диаграмм
  ipcMain.handle('get-all-diagrams', async () => {
    try {
      const diagrams = await dbManager.getAllDiagrams();
      return diagrams;
    } catch (error) {
      console.error('Ошибка получения диаграмм:', error);
      throw error;
    }
  });

  // Удаление диаграммы
  ipcMain.handle('delete-diagram', async (event, id) => {
    try {
      const result = await dbManager.deleteDiagram(id);
      return result;
    } catch (error) {
      console.error('Ошибка удаления диаграммы:', error);
      throw error;
    }
  });

  // Поиск диаграмм
  ipcMain.handle('search-diagrams', async (event, query, options) => {
    try {
      const results = await dbManager.searchDiagrams(query, options);
      return results;
    } catch (error) {
      console.error('Ошибка поиска диаграмм:', error);
      throw error;
    }
  });

  // Работа с историей
  ipcMain.handle('get-diagram-history', async (event, diagramId, limit) => {
    try {
      const history = await dbManager.getDiagramHistory(diagramId, limit);
      return history;
    } catch (error) {
      console.error('Ошибка получения истории:', error);
      throw error;
    }
  });

  // Работа с шаблонами
  ipcMain.handle('save-template', async (event, templateData, options) => {
    try {
      const result = await dbManager.saveTemplate(templateData, options);
      return result;
    } catch (error) {
      console.error('Ошибка сохранения шаблона:', error);
      throw error;
    }
  });

  ipcMain.handle('get-templates', async (event, category) => {
    try {
      const templates = await dbManager.getTemplates(category);
      return templates;
    } catch (error) {
      console.error('Ошибка получения шаблонов:', error);
      throw error;
    }
  });

  // Работа с настройками
  ipcMain.handle('set-setting', async (event, key, value) => {
    try {
      await dbManager.setSetting(key, value);
      return { success: true };
    } catch (error) {
      console.error('Ошибка сохранения настройки:', error);
      throw error;
    }
  });

  ipcMain.handle('get-setting', async (event, key, defaultValue) => {
    try {
      const value = await dbManager.getSetting(key, defaultValue);
      return value;
    } catch (error) {
      console.error('Ошибка получения настройки:', error);
      return defaultValue;
    }
  });

  ipcMain.handle('get-all-settings', async () => {
    try {
      const settings = await dbManager.getAllSettings();
      return settings;
    } catch (error) {
      console.error('Ошибка получения настроек:', error);
      return {};
    }
  });

  // Экспорт/импорт
  ipcMain.handle('export-diagram', async (event, id, includeHistory) => {
    try {
      const exportData = await dbManager.exportDiagram(id, includeHistory);
      return exportData;
    } catch (error) {
      console.error('Ошибка экспорта диаграммы:', error);
      throw error;
    }
  });

  ipcMain.handle('import-diagram', async (event, importData, options) => {
    try {
      const result = await dbManager.importDiagram(importData, options);
      return result;
    } catch (error) {
      console.error('Ошибка импорта диаграммы:', error);
      throw error;
    }
  });

  // Статистика и обслуживание
  ipcMain.handle('get-db-stats', async () => {
    try {
      const stats = await dbManager.getStats();
      return stats;
    } catch (error) {
      console.error('Ошибка получения статистики:', error);
      return null;
    }
  });

  ipcMain.handle('backup-database', async (event, backupPath) => {
    try {
      const result = await dbManager.backup(backupPath);
      return result;
    } catch (error) {
      console.error('Ошибка создания резервной копии:', error);
      throw error;
    }
  });

  // Диалоги для сохранения/загрузки файлов
  ipcMain.handle('show-save-dialog', async (event, options) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, options);
      return result;
    } catch (error) {
      console.error('Ошибка диалога сохранения:', error);
      throw error;
    }
  });

  ipcMain.handle('show-open-dialog', async (event, options) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, options);
      return result;
    } catch (error) {
      console.error('Ошибка диалога открытия:', error);
      throw error;
    }
  });
}

app.whenReady().then(() => {
  // Инициализируем базу данных
  try {
    dbManager = new DatabaseManager();
    console.log('База данных инициализирована');
  } catch (error) {
    console.error('Ошибка инициализации базы данных:', error);
    dialog.showErrorBox('Ошибка', 'Не удалось инициализировать базу данных: ' + error.message);
  }

  // Настраиваем IPC обработчики
  setupIpcHandlers();

  // Создаем окно
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Закрываем базу данных
  if (dbManager) {
    dbManager.close();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Закрываем базу данных перед выходом
  if (dbManager) {
    dbManager.close();
  }
}); 