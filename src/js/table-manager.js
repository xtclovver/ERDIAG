// Менеджер для управления таблицами в ER-диаграмме
class TableManager {
    constructor(app) {
        this.app = app;
        this.tableCounter = 0;
    }

    createTable(x, y, color = '#4A9EFF') {
        this.tableCounter++;
        const tableId = `table_${this.tableCounter}`;
        
        const tableData = {
            id: tableId,
            name: `Таблица${this.tableCounter}`,
            fields: [
                {
                    name: 'id',
                    type: 'INT',
                    isPrimaryKey: true,
                    isAutoIncrement: true,
                    isNotNull: true
                }
            ],
            color: color,
            position: { x, y }
        };

        const tableGroup = this.createTableVisual(tableData);
        this.app.canvas.add(tableGroup);
        this.app.tables.set(tableId, tableData);
        
        return tableData;
    }

    createTableVisual(tableData) {
        const headerHeight = 40;
        const fieldHeight = 25;
        const tableWidth = 200;
        const totalHeight = headerHeight + (tableData.fields.length * fieldHeight);

        // Создаем группу для таблицы
        const tableGroup = new fabric.Group([], {
            left: tableData.position.x,
            top: tableData.position.y,
            selectable: true,
            hasControls: true,
            hasBorders: true,
            tableId: tableData.id,
            type: 'table'
        });

        // Фон таблицы
        const background = new fabric.Rect({
            width: tableWidth,
            height: totalHeight,
            fill: '#2a2a2a',
            stroke: '#3a3a3a',
            strokeWidth: 1,
            rx: 8,
            ry: 8
        });

        // Заголовок таблицы
        const header = new fabric.Rect({
            width: tableWidth,
            height: headerHeight,
            fill: tableData.color,
            rx: 8,
            ry: 8
        });

        // Маска для заголовка (убираем скругление снизу)
        const headerMask = new fabric.Rect({
            width: tableWidth,
            height: headerHeight / 2,
            fill: tableData.color,
            top: headerHeight / 2
        });

        // Иконка таблицы
        const tableIcon = new fabric.Text('🗃️', {
            left: 10,
            top: 10,
            fontSize: 16,
            fill: 'white'
        });

        // Название таблицы
        const tableName = new fabric.Text(tableData.name, {
            left: 35,
            top: 12,
            fontSize: 14,
            fill: 'white',
            fontWeight: 'bold',
            fontFamily: 'Inter, sans-serif'
        });

        // Добавляем элементы заголовка
        tableGroup.addWithUpdate(background);
        tableGroup.addWithUpdate(header);
        tableGroup.addWithUpdate(headerMask);
        tableGroup.addWithUpdate(tableIcon);
        tableGroup.addWithUpdate(tableName);

        // Добавляем поля
        tableData.fields.forEach((field, index) => {
            const fieldY = headerHeight + (index * fieldHeight);
            
            // Фон поля
            const fieldBg = new fabric.Rect({
                width: tableWidth,
                height: fieldHeight,
                fill: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                top: fieldY
            });

            // Иконка ключа для PK/FK
            let keyIcon = '';
            let keyColor = '#888';
            if (field.isPrimaryKey) {
                keyIcon = '🔑';
                keyColor = '#FFC107';
            } else if (field.isForeignKey) {
                keyIcon = '🔗';
                keyColor = '#28A745';
            }

            if (keyIcon) {
                const keyIconText = new fabric.Text(keyIcon, {
                    left: 8,
                    top: fieldY + 4,
                    fontSize: 12,
                    fill: keyColor
                });
                tableGroup.addWithUpdate(keyIconText);
            }

            // Название поля
            const fieldName = new fabric.Text(field.name, {
                left: keyIcon ? 25 : 10,
                top: fieldY + 6,
                fontSize: 12,
                fill: '#e0e0e0',
                fontFamily: 'Inter, sans-serif'
            });

            // Тип поля
            const fieldType = new fabric.Text(field.type, {
                left: tableWidth - 10,
                top: fieldY + 6,
                fontSize: 11,
                fill: '#4A9EFF',
                fontFamily: 'Inter, sans-serif',
                originX: 'right'
            });

            tableGroup.addWithUpdate(fieldBg);
            tableGroup.addWithUpdate(fieldName);
            tableGroup.addWithUpdate(fieldType);

            // Дополнительные ограничения
            const constraints = [];
            if (field.isNotNull) constraints.push('NOT NULL');
            if (field.isUnique) constraints.push('UNIQUE');
            if (field.isAutoIncrement) constraints.push('AUTO_INCREMENT');

            if (constraints.length > 0) {
                const constraintText = new fabric.Text(constraints.join(', '), {
                    left: 10,
                    top: fieldY + 18,
                    fontSize: 9,
                    fill: '#888',
                    fontFamily: 'Inter, sans-serif'
                });
                tableGroup.addWithUpdate(constraintText);
            }
        });

        // Обработчики событий
        tableGroup.on('mousedown', (e) => {
            if (e.e.detail === 2) { // Двойной клик
                this.editTable(tableData.id);
            }
        });

        return tableGroup;
    }

    updateTableVisual(tableId) {
        const tableData = this.app.tables.get(tableId);
        if (!tableData) return;

        // Находим и удаляем старую визуализацию
        const oldTable = this.app.canvas.getObjects().find(obj => obj.tableId === tableId);
        if (oldTable) {
            this.app.canvas.remove(oldTable);
        }

        // Создаем новую визуализацию
        const newTable = this.createTableVisual(tableData);
        this.app.canvas.add(newTable);
        this.app.canvas.renderAll();
    }

    editTable(tableId) {
        const tableData = this.app.tables.get(tableId);
        if (!tableData) return;

        // Показываем модальное окно редактирования
        this.showEditTableModal(tableData);
    }

    showEditTableModal(tableData) {
        // Создаем модальное окно для редактирования таблицы
        const modal = document.createElement('div');
        modal.className = 'modal open';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Редактировать таблицу</h3>
                    <button class="modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Название таблицы:</label>
                        <input type="text" id="editTableName" value="${tableData.name}">
                    </div>
                    <div class="form-group">
                        <label>Поля:</label>
                        <div class="fields-container">
                            <table class="fields-table">
                                <thead>
                                    <tr>
                                        <th>Название</th>
                                        <th>Тип</th>
                                        <th>Ключ</th>
                                        <th>Действия</th>
                                    </tr>
                                </thead>
                                <tbody id="fieldsTableBody">
                                    ${this.renderFieldsTable(tableData.fields)}
                                </tbody>
                            </table>
                        </div>
                        <button class="btn btn-primary" id="addFieldBtn" style="margin-top: 10px;">
                            <i class="fas fa-plus"></i> Добавить поле
                        </button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-close">Отмена</button>
                    <button class="btn btn-primary" id="saveTableBtn">Сохранить</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Обработчики событий
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.remove();
        });

        modal.querySelector('#addFieldBtn').addEventListener('click', () => {
            this.showAddFieldModal(tableData);
        });

        modal.querySelector('#saveTableBtn').addEventListener('click', () => {
            this.saveTableChanges(tableData, modal);
        });

        // Обработчики для кнопок действий полей
        modal.querySelectorAll('.field-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const fieldIndex = parseInt(e.target.dataset.index);
                
                if (action === 'edit') {
                    this.editField(tableData, fieldIndex);
                } else if (action === 'delete') {
                    this.deleteField(tableData, fieldIndex);
                    this.updateFieldsTable(modal, tableData.fields);
                }
            });
        });
    }

    renderFieldsTable(fields) {
        return fields.map((field, index) => `
            <tr>
                <td>
                    ${field.isPrimaryKey ? '<span class="field-constraint pk">PK</span>' : ''}
                    ${field.isForeignKey ? '<span class="field-constraint fk">FK</span>' : ''}
                    ${field.name}
                </td>
                <td class="field-type">${field.type}</td>
                <td>
                    <div class="field-constraints">
                        ${field.isNotNull ? '<span class="field-constraint">NOT NULL</span>' : ''}
                        ${field.isUnique ? '<span class="field-constraint">UNIQUE</span>' : ''}
                        ${field.isAutoIncrement ? '<span class="field-constraint">AUTO</span>' : ''}
                    </div>
                </td>
                <td>
                    <div class="field-actions">
                        <button class="field-action-btn" data-action="edit" data-index="${index}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="field-action-btn delete" data-action="delete" data-index="${index}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    updateFieldsTable(modal, fields) {
        const tbody = modal.querySelector('#fieldsTableBody');
        tbody.innerHTML = this.renderFieldsTable(fields);
        
        // Переназначаем обработчики
        modal.querySelectorAll('.field-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const fieldIndex = parseInt(e.target.dataset.index);
                const tableData = this.app.tables.get(modal.tableId);
                
                if (action === 'edit') {
                    this.editField(tableData, fieldIndex);
                } else if (action === 'delete') {
                    this.deleteField(tableData, fieldIndex);
                    this.updateFieldsTable(modal, tableData.fields);
                }
            });
        });
    }

    showAddFieldModal(tableData) {
        this.app.showModal('fieldModal');
        
        // Очищаем форму
        document.getElementById('fieldName').value = '';
        document.getElementById('fieldType').value = 'INT';
        document.getElementById('isPrimaryKey').checked = false;
        document.getElementById('isForeignKey').checked = false;
        document.getElementById('isAutoIncrement').checked = false;
        document.getElementById('isUnique').checked = false;
        document.getElementById('isNotNull').checked = false;

        // Обработчик добавления поля
        const addBtn = document.getElementById('addFieldBtn');
        addBtn.onclick = () => {
            const field = {
                name: document.getElementById('fieldName').value,
                type: document.getElementById('fieldType').value,
                isPrimaryKey: document.getElementById('isPrimaryKey').checked,
                isForeignKey: document.getElementById('isForeignKey').checked,
                isAutoIncrement: document.getElementById('isAutoIncrement').checked,
                isUnique: document.getElementById('isUnique').checked,
                isNotNull: document.getElementById('isNotNull').checked
            };

            if (field.name.trim()) {
                tableData.fields.push(field);
                this.app.hideModal('fieldModal');
                this.updateTableVisual(tableData.id);
                this.app.markDirty();
            }
        };
    }

    editField(tableData, fieldIndex) {
        const field = tableData.fields[fieldIndex];
        
        this.app.showModal('fieldModal');
        
        // Заполняем форму данными поля
        document.getElementById('fieldName').value = field.name;
        document.getElementById('fieldType').value = field.type;
        document.getElementById('isPrimaryKey').checked = field.isPrimaryKey || false;
        document.getElementById('isForeignKey').checked = field.isForeignKey || false;
        document.getElementById('isAutoIncrement').checked = field.isAutoIncrement || false;
        document.getElementById('isUnique').checked = field.isUnique || false;
        document.getElementById('isNotNull').checked = field.isNotNull || false;

        // Обработчик сохранения изменений
        const addBtn = document.getElementById('addFieldBtn');
        addBtn.onclick = () => {
            field.name = document.getElementById('fieldName').value;
            field.type = document.getElementById('fieldType').value;
            field.isPrimaryKey = document.getElementById('isPrimaryKey').checked;
            field.isForeignKey = document.getElementById('isForeignKey').checked;
            field.isAutoIncrement = document.getElementById('isAutoIncrement').checked;
            field.isUnique = document.getElementById('isUnique').checked;
            field.isNotNull = document.getElementById('isNotNull').checked;

            if (field.name.trim()) {
                this.app.hideModal('fieldModal');
                this.updateTableVisual(tableData.id);
                this.app.markDirty();
            }
        };
    }

    deleteField(tableData, fieldIndex) {
        if (confirm('Удалить это поле?')) {
            tableData.fields.splice(fieldIndex, 1);
            this.updateTableVisual(tableData.id);
            this.app.markDirty();
        }
    }

    saveTableChanges(tableData, modal) {
        const newName = modal.querySelector('#editTableName').value;
        if (newName.trim()) {
            tableData.name = newName.trim();
            this.updateTableVisual(tableData.id);
            this.app.markDirty();
            modal.remove();
        }
    }

    deleteTable(tableId) {
        const tableData = this.app.tables.get(tableId);
        if (!tableData) return;

        // Удаляем визуализацию
        const tableObj = this.app.canvas.getObjects().find(obj => obj.tableId === tableId);
        if (tableObj) {
            this.app.canvas.remove(tableObj);
        }

        // Удаляем данные
        this.app.tables.delete(tableId);
        
        // Удаляем связанные отношения
        this.app.relations.forEach((relation, relationId) => {
            if (relation.fromTable === tableId || relation.toTable === tableId) {
                this.app.relationManager.deleteRelation(relationId);
            }
        });

        this.app.markDirty();
        this.app.updateStats();
    }

    duplicateTable(tableId) {
        const originalTable = this.app.tables.get(tableId);
        if (!originalTable) return;

        // Создаем копию данных таблицы
        const newTableData = {
            ...originalTable,
            name: originalTable.name + '_copy',
            position: {
                x: originalTable.position.x + 20,
                y: originalTable.position.y + 20
            }
        };

        // Создаем новую таблицу
        const newTable = this.createTable(
            newTableData.position.x,
            newTableData.position.y,
            newTableData.color
        );

        // Копируем поля
        newTable.fields = [...originalTable.fields];
        newTable.name = newTableData.name;

        // Обновляем визуализацию
        this.updateTableVisual(newTable.id);
        this.app.markDirty();
        this.app.updateStats();

        return newTable;
    }

    changeTableColor(tableId, color) {
        const tableData = this.app.tables.get(tableId);
        if (!tableData) return;

        tableData.color = color;
        this.updateTableVisual(tableId);
        this.app.markDirty();
    }

    getTableConnectionPoints(tableId) {
        const tableObj = this.app.canvas.getObjects().find(obj => obj.tableId === tableId);
        if (!tableObj) return null;

        const bounds = tableObj.getBoundingRect();
        return {
            top: { x: bounds.left + bounds.width / 2, y: bounds.top },
            bottom: { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height },
            left: { x: bounds.left, y: bounds.top + bounds.height / 2 },
            right: { x: bounds.left + bounds.width, y: bounds.top + bounds.height / 2 }
        };
    }
} 