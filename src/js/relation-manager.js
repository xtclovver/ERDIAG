// Менеджер для управления связями между таблицами
class RelationManager {
    constructor(app) {
        this.app = app;
        this.relationCounter = 0;
        this.isCreatingRelation = false;
        this.tempRelation = null;
        this.sourceTable = null;
    }

    startCreatingRelation() {
        this.isCreatingRelation = true;
        this.app.canvas.defaultCursor = 'crosshair';
        this.app.showNotification('Выберите первую таблицу для создания связи', 'info');
        
        // Добавляем обработчик клика на таблицы
        this.app.canvas.on('mouse:down', this.onTableClick.bind(this));
    }

    onTableClick(e) {
        if (!this.isCreatingRelation) return;

        const target = e.target;
        if (target && target.type === 'table') {
            if (!this.sourceTable) {
                // Выбираем первую таблицу
                this.sourceTable = target;
                this.highlightTable(target, '#4A9EFF');
                this.app.showNotification('Теперь выберите вторую таблицу', 'info');
            } else if (target !== this.sourceTable) {
                // Выбираем вторую таблицу и создаем связь
                this.createRelation(this.sourceTable.tableId, target.tableId);
                this.finishCreatingRelation();
            }
        } else if (!target) {
            // Клик по пустому месту - отменяем создание связи
            this.cancelCreatingRelation();
        }
    }

    createRelation(fromTableId, toTableId, relationType = 'one-to-many') {
        this.relationCounter++;
        const relationId = `relation_${this.relationCounter}`;

        const relationData = {
            id: relationId,
            fromTable: fromTableId,
            toTable: toTableId,
            type: relationType,
            fromCardinality: relationType === 'one-to-many' ? '1' : 'M',
            toCardinality: relationType === 'one-to-many' ? 'M' : '1',
            name: `Связь ${this.relationCounter}`,
            color: '#888'
        };

        // Создаем визуализацию связи
        const relationVisual = this.createRelationVisual(relationData);
        if (relationVisual) {
            this.app.canvas.add(relationVisual);
            this.app.relations.set(relationId, relationData);
            this.app.markDirty();
            this.app.updateStats();
        }

        return relationData;
    }

    createRelationVisual(relationData) {
        const fromPoints = this.app.tableManager.getTableConnectionPoints(relationData.fromTable);
        const toPoints = this.app.tableManager.getTableConnectionPoints(relationData.toTable);

        if (!fromPoints || !toPoints) return null;

        // Определяем лучшие точки подключения
        const connection = this.findBestConnection(fromPoints, toPoints);
        
        // Создаем линию связи
        const line = new fabric.Line([
            connection.from.x, connection.from.y,
            connection.to.x, connection.to.y
        ], {
            stroke: relationData.color,
            strokeWidth: 2,
            selectable: true,
            relationId: relationData.id,
            type: 'relation'
        });

        // Добавляем стрелки и кардинальности
        this.addRelationDecorations(line, connection, relationData);

        // Обработчик двойного клика для редактирования
        line.on('mousedown', (e) => {
            if (e.e.detail === 2) {
                this.editRelation(relationData.id);
            }
        });

        return line;
    }

    findBestConnection(fromPoints, toPoints) {
        let minDistance = Infinity;
        let bestConnection = null;

        // Проверяем все возможные комбинации точек подключения
        Object.keys(fromPoints).forEach(fromSide => {
            Object.keys(toPoints).forEach(toSide => {
                const distance = this.calculateDistance(
                    fromPoints[fromSide],
                    toPoints[toSide]
                );

                if (distance < minDistance) {
                    minDistance = distance;
                    bestConnection = {
                        from: fromPoints[fromSide],
                        to: toPoints[toSide],
                        fromSide,
                        toSide
                    };
                }
            });
        });

        return bestConnection;
    }

    calculateDistance(point1, point2) {
        return Math.sqrt(
            Math.pow(point2.x - point1.x, 2) + 
            Math.pow(point2.y - point1.y, 2)
        );
    }

    addRelationDecorations(line, connection, relationData) {
        // Добавляем стрелку на конце линии
        const angle = Math.atan2(
            connection.to.y - connection.from.y,
            connection.to.x - connection.from.x
        );

        // Стрелка
        const arrowLength = 10;
        const arrowAngle = Math.PI / 6;

        const arrowX1 = connection.to.x - arrowLength * Math.cos(angle - arrowAngle);
        const arrowY1 = connection.to.y - arrowLength * Math.sin(angle - arrowAngle);
        const arrowX2 = connection.to.x - arrowLength * Math.cos(angle + arrowAngle);
        const arrowY2 = connection.to.y - arrowLength * Math.sin(angle + arrowAngle);

        const arrow1 = new fabric.Line([connection.to.x, connection.to.y, arrowX1, arrowY1], {
            stroke: relationData.color,
            strokeWidth: 2,
            selectable: false
        });

        const arrow2 = new fabric.Line([connection.to.x, connection.to.y, arrowX2, arrowY2], {
            stroke: relationData.color,
            strokeWidth: 2,
            selectable: false
        });

        // Группируем линию и стрелки
        const relationGroup = new fabric.Group([line, arrow1, arrow2], {
            selectable: true,
            relationId: relationData.id,
            type: 'relation'
        });

        return relationGroup;
    }

    updateRelationVisual(relationId) {
        const relationData = this.app.relations.get(relationId);
        if (!relationData) return;

        // Удаляем старую визуализацию
        const oldRelation = this.app.canvas.getObjects().find(obj => obj.relationId === relationId);
        if (oldRelation) {
            this.app.canvas.remove(oldRelation);
        }

        // Создаем новую визуализацию
        const newRelation = this.createRelationVisual(relationData);
        if (newRelation) {
            this.app.canvas.add(newRelation);
            this.app.canvas.renderAll();
        }
    }

    updateAllRelations() {
        // Обновляем все связи (например, после перемещения таблиц)
        this.app.relations.forEach((relationData, relationId) => {
            this.updateRelationVisual(relationId);
        });
    }

    editRelation(relationId) {
        const relationData = this.app.relations.get(relationId);
        if (!relationData) return;

        this.showEditRelationModal(relationData);
    }

    showEditRelationModal(relationData) {
        const modal = document.createElement('div');
        modal.className = 'modal open';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Редактировать связь</h3>
                    <button class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Название связи:</label>
                        <input type="text" id="relationName" value="${relationData.name}">
                    </div>
                    <div class="form-group">
                        <label>Тип связи:</label>
                        <select id="relationType">
                            <option value="one-to-one" ${relationData.type === 'one-to-one' ? 'selected' : ''}>Один к одному (1:1)</option>
                            <option value="one-to-many" ${relationData.type === 'one-to-many' ? 'selected' : ''}>Один ко многим (1:M)</option>
                            <option value="many-to-many" ${relationData.type === 'many-to-many' ? 'selected' : ''}>Многие ко многим (M:M)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Цвет связи:</label>
                        <div class="color-palette">
                            <div class="color-option ${relationData.color === '#888' ? 'active' : ''}" data-color="#888" style="background-color: #888;"></div>
                            <div class="color-option ${relationData.color === '#4A9EFF' ? 'active' : ''}" data-color="#4A9EFF" style="background-color: #4A9EFF;"></div>
                            <div class="color-option ${relationData.color === '#FF6B6B' ? 'active' : ''}" data-color="#FF6B6B" style="background-color: #FF6B6B;"></div>
                            <div class="color-option ${relationData.color === '#4ECDC4' ? 'active' : ''}" data-color="#4ECDC4" style="background-color: #4ECDC4;"></div>
                            <div class="color-option ${relationData.color === '#96CEB4' ? 'active' : ''}" data-color="#96CEB4" style="background-color: #96CEB4;"></div>
                            <div class="color-option ${relationData.color === '#FFEAA7' ? 'active' : ''}" data-color="#FFEAA7" style="background-color: #FFEAA7;"></div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Информация о связи:</label>
                        <p>От: ${this.getTableName(relationData.fromTable)}</p>
                        <p>К: ${this.getTableName(relationData.toTable)}</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-danger" id="deleteRelationBtn">Удалить</button>
                    <button class="btn btn-secondary modal-close">Отмена</button>
                    <button class="btn btn-primary" id="saveRelationBtn">Сохранить</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Обработчики событий
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.remove();
        });

        // Выбор цвета
        modal.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', (e) => {
                modal.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        modal.querySelector('#saveRelationBtn').addEventListener('click', () => {
            this.saveRelationChanges(relationData, modal);
        });

        modal.querySelector('#deleteRelationBtn').addEventListener('click', () => {
            if (confirm('Удалить эту связь?')) {
                this.deleteRelation(relationData.id);
                modal.remove();
            }
        });
    }

    saveRelationChanges(relationData, modal) {
        const newName = modal.querySelector('#relationName').value;
        const newType = modal.querySelector('#relationType').value;
        const newColor = modal.querySelector('.color-option.active').dataset.color;

        relationData.name = newName.trim() || relationData.name;
        relationData.type = newType;
        relationData.color = newColor;

        // Обновляем кардинальности в зависимости от типа
        switch (newType) {
            case 'one-to-one':
                relationData.fromCardinality = '1';
                relationData.toCardinality = '1';
                break;
            case 'one-to-many':
                relationData.fromCardinality = '1';
                relationData.toCardinality = 'M';
                break;
            case 'many-to-many':
                relationData.fromCardinality = 'M';
                relationData.toCardinality = 'M';
                break;
        }

        this.updateRelationVisual(relationData.id);
        this.app.markDirty();
        modal.remove();
    }

    deleteRelation(relationId) {
        const relationData = this.app.relations.get(relationId);
        if (!relationData) return;

        // Удаляем визуализацию
        const relationObj = this.app.canvas.getObjects().find(obj => obj.relationId === relationId);
        if (relationObj) {
            this.app.canvas.remove(relationObj);
        }

        // Удаляем данные
        this.app.relations.delete(relationId);
        this.app.markDirty();
        this.app.updateStats();
    }

    getTableName(tableId) {
        const table = this.app.tables.get(tableId);
        return table ? table.name : 'Неизвестная таблица';
    }

    highlightTable(tableObj, color) {
        // Подсвечиваем таблицу при создании связи
        tableObj.set({
            stroke: color,
            strokeWidth: 3
        });
        this.app.canvas.renderAll();
    }

    removeTableHighlight(tableObj) {
        tableObj.set({
            stroke: '#3a3a3a',
            strokeWidth: 1
        });
        this.app.canvas.renderAll();
    }

    finishCreatingRelation() {
        this.isCreatingRelation = false;
        this.sourceTable = null;
        this.app.canvas.defaultCursor = 'default';
        this.app.canvas.off('mouse:down', this.onTableClick);
        
        // Убираем подсветку со всех таблиц
        this.app.canvas.getObjects().forEach(obj => {
            if (obj.type === 'table') {
                this.removeTableHighlight(obj);
            }
        });

        this.app.setTool('select');
        this.app.showNotification('Связь создана успешно', 'success');
    }

    cancelCreatingRelation() {
        this.isCreatingRelation = false;
        this.sourceTable = null;
        this.app.canvas.defaultCursor = 'default';
        this.app.canvas.off('mouse:down', this.onTableClick);
        
        // Убираем подсветку со всех таблиц
        this.app.canvas.getObjects().forEach(obj => {
            if (obj.type === 'table') {
                this.removeTableHighlight(obj);
            }
        });

        this.app.setTool('select');
        this.app.showNotification('Создание связи отменено', 'info');
    }

    // Автоматическое обновление связей при перемещении таблиц
    onTableMoved(tableId) {
        // Находим все связи, связанные с этой таблицей
        this.app.relations.forEach((relationData, relationId) => {
            if (relationData.fromTable === tableId || relationData.toTable === tableId) {
                this.updateRelationVisual(relationId);
            }
        });
    }

    // Получение всех связей для таблицы
    getTableRelations(tableId) {
        const relations = [];
        this.app.relations.forEach((relationData, relationId) => {
            if (relationData.fromTable === tableId || relationData.toTable === tableId) {
                relations.push(relationData);
            }
        });
        return relations;
    }

    // Проверка возможности создания связи
    canCreateRelation(fromTableId, toTableId) {
        // Проверяем, что таблицы существуют
        if (!this.app.tables.has(fromTableId) || !this.app.tables.has(toTableId)) {
            return false;
        }

        // Проверяем, что связь между этими таблицами еще не существует
        for (let [relationId, relationData] of this.app.relations) {
            if ((relationData.fromTable === fromTableId && relationData.toTable === toTableId) ||
                (relationData.fromTable === toTableId && relationData.toTable === fromTableId)) {
                return false;
            }
        }

        return true;
    }

    // Получение статистики связей
    getRelationStats() {
        const stats = {
            total: this.app.relations.size,
            oneToOne: 0,
            oneToMany: 0,
            manyToMany: 0
        };

        this.app.relations.forEach(relation => {
            switch (relation.type) {
                case 'one-to-one':
                    stats.oneToOne++;
                    break;
                case 'one-to-many':
                    stats.oneToMany++;
                    break;
                case 'many-to-many':
                    stats.manyToMany++;
                    break;
            }
        });

        return stats;
    }
} 