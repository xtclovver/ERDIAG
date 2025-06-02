// Основной файл приложения ER Diagram Editor
class ERDiagramApp {
    constructor() {
        this.canvas = null;
        this.currentTool = 'select';
        this.selectedColor = '#4A9EFF';
        this.tables = new Map();
        this.relations = new Map();
        this.selectedObject = null;
        this.isGridVisible = true;
        this.zoom = 1;
        this.currentFilePath = null;
        this.isDirty = false;
        this.history = [];
        this.historyIndex = -1;
        
        this.init();
    }

    init() {
        this.initCanvas();
        this.initEventListeners();
        this.initMenuHandlers();
        this.updateStats();
        
        // Создаем экземпляры менеджеров
        this.tableManager = new TableManager(this);
        this.relationManager = new RelationManager(this);
        this.fileManager = new FileManager(this);
        this.uiManager = new UIManager(this);
        
        console.log('ER Diagram Editor инициализирован');
    }

    initCanvas() {
        const canvasElement = document.getElementById('diagramCanvas');
        const container = canvasElement.parentElement;
        
        // Устанавливаем размеры canvas
        canvasElement.width = container.clientWidth;
        canvasElement.height = container.clientHeight;
        
        // Инициализируем Fabric.js canvas
        this.canvas = new fabric.Canvas('diagramCanvas', {
            backgroundColor: '#1a1a1a',
            selection: true,
            preserveObjectStacking: true
        });

        // Обработчики событий canvas
        this.canvas.on('selection:created', (e) => this.onObjectSelected(e));
        this.canvas.on('selection:updated', (e) => this.onObjectSelected(e));
        this.canvas.on('selection:cleared', () => this.onObjectDeselected());
        this.canvas.on('object:modified', () => this.markDirty());
        this.canvas.on('mouse:down', (e) => this.onCanvasMouseDown(e));
        this.canvas.on('mouse:up', (e) => this.onCanvasMouseUp(e));
        this.canvas.on('mouse:move', (e) => this.onCanvasMouseMove(e));

        // Обработка изменения размера окна
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    initEventListeners() {
        // Инструменты
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setTool(e.currentTarget.dataset.tool);
            });
        });

        // Цветовая палитра
        document.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', (e) => {
                this.setColor(e.currentTarget.dataset.color);
            });
        });

        // Кнопки действий
        document.getElementById('newBtn').addEventListener('click', () => this.newDiagram());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveDiagram());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportDiagram());

        // Кнопки управления
        document.getElementById('zoomInBtn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOutBtn').addEventListener('click', () => this.zoomOut());
        document.getElementById('zoomResetBtn').addEventListener('click', () => this.zoomReset());
        document.getElementById('gridToggle').addEventListener('click', () => this.toggleGrid());

        // Закрытие панели свойств
        document.getElementById('closeProperties').addEventListener('click', () => {
            this.hidePropertiesPanel();
        });

        // Контекстное меню
        document.addEventListener('contextmenu', (e) => this.showContextMenu(e));
        document.addEventListener('click', () => this.hideContextMenu());

        // Модальные окна
        document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.currentTarget.dataset.modal;
                if (modalId) {
                    this.hideModal(modalId);
                }
            });
        });

        // Горячие клавиши
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    initMenuHandlers() {
        const { ipcRenderer } = require('electron');
        
        // Обработчики IPC сообщений от главного процесса
        ipcRenderer.on('new-diagram', () => this.newDiagram());
        ipcRenderer.on('save-diagram', () => this.saveDiagram());
        ipcRenderer.on('save-diagram-as', () => this.saveDiagramAs());
        ipcRenderer.on('load-diagram', (event, data) => this.loadDiagram(data));
        ipcRenderer.on('export-png', () => this.exportPNG());
        ipcRenderer.on('zoom-in', () => this.zoomIn());
        ipcRenderer.on('zoom-out', () => this.zoomOut());
        ipcRenderer.on('zoom-reset', () => this.zoomReset());
        ipcRenderer.on('toggle-grid', (event, visible) => this.setGridVisible(visible));
        ipcRenderer.on('add-table', () => this.addTable());
        ipcRenderer.on('add-relation', () => this.setTool('relation'));
        ipcRenderer.on('undo', () => this.undo());
        ipcRenderer.on('redo', () => this.redo());
        ipcRenderer.on('copy', () => this.copy());
        ipcRenderer.on('paste', () => this.paste());
        ipcRenderer.on('delete', () => this.deleteSelected());
    }

    setTool(tool) {
        this.currentTool = tool;
        
        // Обновляем UI
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });

        // Изменяем курсор
        switch (tool) {
            case 'select':
                this.canvas.defaultCursor = 'default';
                this.canvas.hoverCursor = 'move';
                break;
            case 'table':
                this.canvas.defaultCursor = 'crosshair';
                break;
            case 'relation':
                this.canvas.defaultCursor = 'crosshair';
                break;
        }
    }

    setColor(color) {
        this.selectedColor = color;
        
        // Обновляем UI
        document.querySelectorAll('.color-option').forEach(option => {
            option.classList.toggle('active', option.dataset.color === color);
        });

        // Применяем цвет к выбранному объекту
        if (this.selectedObject && this.selectedObject.type === 'table') {
            this.selectedObject.set('fill', color);
            this.canvas.renderAll();
            this.markDirty();
        }
    }

    onCanvasMouseDown(e) {
        if (!e.target && this.currentTool === 'table') {
            const pointer = this.canvas.getPointer(e.e);
            this.addTableAt(pointer.x, pointer.y);
        }
    }

    onCanvasMouseUp(e) {
        // Обработка завершения действий
    }

    onCanvasMouseMove(e) {
        // Обработка движения мыши
    }

    onObjectSelected(e) {
        this.selectedObject = e.selected[0];
        this.showPropertiesPanel();
    }

    onObjectDeselected() {
        this.selectedObject = null;
        this.hidePropertiesPanel();
    }

    addTable() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        this.addTableAt(centerX, centerY);
    }

    addTableAt(x, y) {
        if (this.tableManager) {
            this.tableManager.createTable(x, y, this.selectedColor);
            this.markDirty();
            this.updateStats();
        }
    }

    newDiagram() {
        if (this.isDirty) {
            const result = confirm('У вас есть несохраненные изменения. Продолжить?');
            if (!result) return;
        }

        this.canvas.clear();
        this.tables.clear();
        this.relations.clear();
        this.selectedObject = null;
        this.currentFilePath = null;
        this.isDirty = false;
        this.history = [];
        this.historyIndex = -1;
        
        this.hidePropertiesPanel();
        this.updateStats();
        this.showNotification('Создана новая диаграмма', 'success');
    }

    saveDiagram() {
        if (this.currentFilePath) {
            this.fileManager.save(this.currentFilePath);
        } else {
            this.saveDiagramAs();
        }
    }

    saveDiagramAs() {
        this.fileManager.saveAs();
    }

    loadDiagram(data) {
        this.fileManager.load(data);
    }

    exportDiagram() {
        this.fileManager.exportPNG();
    }

    exportPNG() {
        this.fileManager.exportPNG();
    }

    zoomIn() {
        this.zoom = Math.min(this.zoom * 1.2, 3);
        this.canvas.setZoom(this.zoom);
        this.updateZoomDisplay();
    }

    zoomOut() {
        this.zoom = Math.max(this.zoom / 1.2, 0.1);
        this.canvas.setZoom(this.zoom);
        this.updateZoomDisplay();
    }

    zoomReset() {
        this.zoom = 1;
        this.canvas.setZoom(this.zoom);
        this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        this.updateZoomDisplay();
    }

    updateZoomDisplay() {
        document.getElementById('zoomLevel').textContent = Math.round(this.zoom * 100) + '%';
    }

    toggleGrid() {
        this.isGridVisible = !this.isGridVisible;
        this.setGridVisible(this.isGridVisible);
    }

    setGridVisible(visible) {
        this.isGridVisible = visible;
        const gridOverlay = document.getElementById('gridOverlay');
        gridOverlay.classList.toggle('hidden', !visible);
        
        const gridBtn = document.getElementById('gridToggle');
        gridBtn.classList.toggle('active', visible);
    }

    showPropertiesPanel() {
        const panel = document.getElementById('propertiesPanel');
        panel.classList.add('open');
        
        if (this.uiManager) {
            this.uiManager.updatePropertiesPanel(this.selectedObject);
        }
    }

    hidePropertiesPanel() {
        const panel = document.getElementById('propertiesPanel');
        panel.classList.remove('open');
    }

    showContextMenu(e) {
        if (this.selectedObject) {
            e.preventDefault();
            const menu = document.getElementById('contextMenu');
            menu.style.left = e.pageX + 'px';
            menu.style.top = e.pageY + 'px';
            menu.classList.add('open');
        }
    }

    hideContextMenu() {
        const menu = document.getElementById('contextMenu');
        menu.classList.remove('open');
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.add('open');
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.remove('open');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type} show`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    updateStats() {
        const tableCount = this.tables.size;
        const relationCount = this.relations.size;
        document.getElementById('diagramStats').textContent = 
            `Таблиц: ${tableCount}, Связей: ${relationCount}`;
    }

    markDirty() {
        this.isDirty = true;
        this.saveState();
    }

    saveState() {
        const state = this.canvas.toJSON();
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(state);
        this.historyIndex++;
        
        // Ограничиваем историю
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.canvas.loadFromJSON(this.history[this.historyIndex], () => {
                this.canvas.renderAll();
            });
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.canvas.loadFromJSON(this.history[this.historyIndex], () => {
                this.canvas.renderAll();
            });
        }
    }

    copy() {
        if (this.selectedObject) {
            this.clipboard = this.selectedObject.toObject();
        }
    }

    paste() {
        if (this.clipboard) {
            fabric.util.enlivenObjects([this.clipboard], (objects) => {
                objects.forEach(obj => {
                    obj.set({
                        left: obj.left + 20,
                        top: obj.top + 20
                    });
                    this.canvas.add(obj);
                });
                this.canvas.renderAll();
                this.markDirty();
            });
        }
    }

    deleteSelected() {
        if (this.selectedObject) {
            this.canvas.remove(this.selectedObject);
            this.selectedObject = null;
            this.hidePropertiesPanel();
            this.markDirty();
            this.updateStats();
        }
    }

    handleKeyDown(e) {
        // Обработка горячих клавиш
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'n':
                    e.preventDefault();
                    this.newDiagram();
                    break;
                case 's':
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.saveDiagramAs();
                    } else {
                        this.saveDiagram();
                    }
                    break;
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                    break;
                case 'c':
                    e.preventDefault();
                    this.copy();
                    break;
                case 'v':
                    e.preventDefault();
                    this.paste();
                    break;
                case 't':
                    e.preventDefault();
                    this.addTable();
                    break;
                case 'r':
                    e.preventDefault();
                    this.setTool('relation');
                    break;
            }
        } else if (e.key === 'Delete') {
            this.deleteSelected();
        } else if (e.key === 'Escape') {
            this.setTool('select');
        }
    }

    resizeCanvas() {
        const container = document.querySelector('.canvas-container');
        this.canvas.setDimensions({
            width: container.clientWidth,
            height: container.clientHeight
        });
    }

    getDiagramData() {
        return {
            version: '1.0.0',
            canvas: this.canvas.toJSON(),
            tables: Array.from(this.tables.entries()),
            relations: Array.from(this.relations.entries()),
            metadata: {
                created: new Date().toISOString(),
                zoom: this.zoom,
                gridVisible: this.isGridVisible
            }
        };
    }

    loadDiagramData(data) {
        this.canvas.loadFromJSON(data.canvas, () => {
            this.tables = new Map(data.tables || []);
            this.relations = new Map(data.relations || []);
            
            if (data.metadata) {
                this.zoom = data.metadata.zoom || 1;
                this.isGridVisible = data.metadata.gridVisible !== false;
                this.canvas.setZoom(this.zoom);
                this.setGridVisible(this.isGridVisible);
                this.updateZoomDisplay();
            }
            
            this.canvas.renderAll();
            this.updateStats();
            this.isDirty = false;
        });
    }
}

// Инициализация приложения при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ERDiagramApp();
}); 