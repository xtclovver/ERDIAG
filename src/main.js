const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

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
          label: 'Открыть...',
          accelerator: 'CmdOrCtrl+O',
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
                mainWindow.webContents.send('load-diagram', JSON.parse(data));
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
              message: 'ER Diagram Editor v1.0.0',
              detail: 'Редактор ER-диаграмм для проектирования баз данных\n\nСоздано с помощью Electron'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC обработчики для сохранения и экспорта
ipcMain.handle('save-diagram-dialog', async (event, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'ER Диаграммы', extensions: ['erdiag'] },
      { name: 'JSON файлы', extensions: ['json'] }
    ],
    defaultPath: 'diagram.erdiag'
  });

  if (!result.canceled) {
    try {
      fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
      return { success: true, filePath: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, canceled: true };
});

ipcMain.handle('export-png-dialog', async (event, dataURL) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'PNG изображения', extensions: ['png'] }
    ],
    defaultPath: 'diagram.png'
  });

  if (!result.canceled) {
    try {
      const base64Data = dataURL.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(result.filePath, base64Data, 'base64');
      return { success: true, filePath: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, canceled: true };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}); 