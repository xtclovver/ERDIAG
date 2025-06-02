// Менеджер пользовательского интерфейса
class UIManager {
    constructor(app) {
        this.app = app;
        this.propertiesPanel = document.getElementById('propertiesPanel');
        this.contextMenu = document.getElementById('contextMenu');
        this.notifications = [];
        
        this.initEventListeners();
    }

    initEventListeners() {
        // Обработчики для панели свойств
        const propertyInputs = this.propertiesPanel.querySelectorAll('input, select, textarea');
        propertyInputs.forEach(input => {
            input.addEventListener('change', (e) => this.onPropertyChange(e));
            input.addEventListener('input', (e) => this.onPropertyInput(e));
        });

        // Обработчики для кнопок в панели свойств
        const deleteBtn = document.getElementById('deleteObjectBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteSelectedObject());
        }

        const duplicateBtn = document.getElementById('duplicateObjectBtn');
        if (duplicateBtn) {
            duplicateBtn.addEventListener('click', () => this.duplicateSelectedObject());
        }
    }

    updatePropertiesPanel(selectedObject) {
        if (!selectedObject) {
            this.hidePropertiesPanel();
            return;
        }

        this.showPropertiesPanel();
        
        const content = this.propertiesPanel.querySelector('.properties-content');
        content.innerHTML = '';

        if (selectedObject.type === 'table') {
            this.renderTableProperties(selectedObject, content);
        } else if (selectedObject.type === 'relation') {
            this.renderRelationProperties(selectedObject, content);
        }
    }

    renderTableProperties(table, container) {
        const html = `
            <div class="property-group">
                <h3>Свойства таблицы</h3>
                
                <div class="property-item">
                    <label for="tableName">Название таблицы:</label>
                    <input type="text" id="tableName" value="${table.tableName || ''}" 
                           placeholder="Введите название таблицы">
                </div>

                <div class="property-item">
                    <label for="tableColor">Цвет:</label>
                    <div class="color-picker">
                        <input type="color" id="tableColor" value="${table.fill || '#4A9EFF'}">
                        <div class="color-presets">
                            <div class="color-preset" data-color="#4A9EFF" style="background: #4A9EFF"></div>
                            <div class="color-preset" data-color="#FF6B6B" style="background: #FF6B6B"></div>
                            <div class="color-preset" data-color="#4ECDC4" style="background: #4ECDC4"></div>
                            <div class="color-preset" data-color="#45B7D1" style="background: #45B7D1"></div>
                            <div class="color-preset" data-color="#96CEB4" style="background: #96CEB4"></div>
                            <div class="color-preset" data-color="#FFEAA7" style="background: #FFEAA7"></div>
                            <div class="color-preset" data-color="#DDA0DD" style="background: #DDA0DD"></div>
                            <div class="color-preset" data-color="#98D8C8" style="background: #98D8C8"></div>
                        </div>
                    </div>
                </div>

                <div class="property-item">
                    <label for="tableComment">Комментарий:</label>
                    <textarea id="tableComment" placeholder="Описание таблицы" rows="3">${table.comment || ''}</textarea>
                </div>
            </div>

            <div class="property-group">
                <h3>Поля таблицы</h3>
                <div id="fieldsContainer">
                    ${this.renderTableFields(table)}
                </div>
                <button type="button" class="btn btn-secondary" id="addFieldBtn">
                    <i class="icon-plus"></i> Добавить поле
                </button>
            </div>

            <div class="property-actions">
                <button type="button" class="btn btn-danger" id="deleteObjectBtn">
                    <i class="icon-trash"></i> Удалить таблицу
                </button>
                <button type="button" class="btn btn-secondary" id="duplicateObjectBtn">
                    <i class="icon-copy"></i> Дублировать
                </button>
            </div>
        `;

        container.innerHTML = html;
        this.bindTablePropertyEvents(table);
    }

    renderTableFields(table) {
        if (!table.fields || table.fields.length === 0) {
            return '<div class="no-fields">Нет полей. Добавьте первое поле.</div>';
        }

        return table.fields.map((field, index) => `
            <div class="field-item" data-field-index="${index}">
                <div class="field-header">
                    <div class="field-info">
                        <span class="field-name">${field.name}</span>
                        <span class="field-type">${field.type}</span>
                        ${field.isPrimaryKey ? '<span class="field-badge primary">PK</span>' : ''}
                        ${field.isForeignKey ? '<span class="field-badge foreign">FK</span>' : ''}
                        ${field.isNotNull ? '<span class="field-badge not-null">NOT NULL</span>' : ''}
                    </div>
                    <div class="field-actions">
                        <button type="button" class="btn-icon edit-field" data-field-index="${index}">
                            <i class="icon-edit"></i>
                        </button>
                        <button type="button" class="btn-icon delete-field" data-field-index="${index}">
                            <i class="icon-trash"></i>
                        </button>
                    </div>
                </div>
                ${field.comment ? `<div class="field-comment">${field.comment}</div>` : ''}
            </div>
        `).join('');
    }

    renderRelationProperties(relation, container) {
        const html = `
            <div class="property-group">
                <h3>Свойства связи</h3>
                
                <div class="property-item">
                    <label for="relationName">Название связи:</label>
                    <input type="text" id="relationName" value="${relation.relationName || ''}" 
                           placeholder="Введите название связи">
                </div>

                <div class="property-item">
                    <label for="relationType">Тип связи:</label>
                    <select id="relationType">
                        <option value="one-to-one" ${relation.relationType === 'one-to-one' ? 'selected' : ''}>Один к одному (1:1)</option>
                        <option value="one-to-many" ${relation.relationType === 'one-to-many' ? 'selected' : ''}>Один ко многим (1:M)</option>
                        <option value="many-to-many" ${relation.relationType === 'many-to-many' ? 'selected' : ''}>Многие ко многим (M:M)</option>
                    </select>
                </div>

                <div class="property-item">
                    <label for="relationColor">Цвет линии:</label>
                    <input type="color" id="relationColor" value="${relation.stroke || '#4A9EFF'}">
                </div>

                <div class="property-item">
                    <label for="relationComment">Комментарий:</label>
                    <textarea id="relationComment" placeholder="Описание связи" rows="3">${relation.comment || ''}</textarea>
                </div>
            </div>

            <div class="property-actions">
                <button type="button" class="btn btn-danger" id="deleteObjectBtn">
                    <i class="icon-trash"></i> Удалить связь
                </button>
            </div>
        `;

        container.innerHTML = html;
        this.bindRelationPropertyEvents(relation);
    }

    bindTablePropertyEvents(table) {
        // Название таблицы
        const nameInput = document.getElementById('tableName');
        nameInput.addEventListener('input', (e) => {
            table.tableName = e.target.value;
            this.app.tableManager.updateTableDisplay(table);
            this.app.markDirty();
        });

        // Цвет таблицы
        const colorInput = document.getElementById('tableColor');
        colorInput.addEventListener('change', (e) => {
            table.set('fill', e.target.value);
            this.app.canvas.renderAll();
            this.app.markDirty();
        });

        // Цветовые пресеты
        document.querySelectorAll('.color-preset').forEach(preset => {
            preset.addEventListener('click', (e) => {
                const color = e.target.dataset.color;
                colorInput.value = color;
                table.set('fill', color);
                this.app.canvas.renderAll();
                this.app.markDirty();
            });
        });

        // Комментарий
        const commentInput = document.getElementById('tableComment');
        commentInput.addEventListener('input', (e) => {
            table.comment = e.target.value;
            this.app.markDirty();
        });

        // Добавление поля
        const addFieldBtn = document.getElementById('addFieldBtn');
        addFieldBtn.addEventListener('click', () => {
            this.showFieldModal(table);
        });

        // Редактирование и удаление полей
        document.querySelectorAll('.edit-field').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fieldIndex = parseInt(e.target.closest('.edit-field').dataset.fieldIndex);
                this.showFieldModal(table, fieldIndex);
            });
        });

        document.querySelectorAll('.delete-field').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fieldIndex = parseInt(e.target.closest('.delete-field').dataset.fieldIndex);
                this.deleteField(table, fieldIndex);
            });
        });
    }

    bindRelationPropertyEvents(relation) {
        // Название связи
        const nameInput = document.getElementById('relationName');
        nameInput.addEventListener('input', (e) => {
            relation.relationName = e.target.value;
            this.app.markDirty();
        });

        // Тип связи
        const typeSelect = document.getElementById('relationType');
        typeSelect.addEventListener('change', (e) => {
            relation.relationType = e.target.value;
            this.app.relationManager.updateRelationDisplay(relation);
            this.app.markDirty();
        });

        // Цвет связи
        const colorInput = document.getElementById('relationColor');
        colorInput.addEventListener('change', (e) => {
            relation.set('stroke', e.target.value);
            this.app.canvas.renderAll();
            this.app.markDirty();
        });

        // Комментарий
        const commentInput = document.getElementById('relationComment');
        commentInput.addEventListener('input', (e) => {
            relation.comment = e.target.value;
            this.app.markDirty();
        });
    }

    showFieldModal(table, fieldIndex = null) {
        const modal = document.getElementById('fieldModal');
        const form = modal.querySelector('form');
        
        // Заполняем форму
        if (fieldIndex !== null && table.fields[fieldIndex]) {
            const field = table.fields[fieldIndex];
            form.fieldName.value = field.name || '';
            form.fieldType.value = field.type || 'VARCHAR(255)';
            form.fieldComment.value = field.comment || '';
            form.isPrimaryKey.checked = field.isPrimaryKey || false;
            form.isForeignKey.checked = field.isForeignKey || false;
            form.isNotNull.checked = field.isNotNull || false;
            form.isUnique.checked = field.isUnique || false;
            form.defaultValue.value = field.defaultValue || '';
        } else {
            form.reset();
        }

        // Показываем модальное окно
        modal.style.display = 'flex';

        // Обработчик сохранения
        const saveHandler = (e) => {
            e.preventDefault();
            this.saveField(table, fieldIndex, form);
            modal.style.display = 'none';
            form.removeEventListener('submit', saveHandler);
        };

        form.addEventListener('submit', saveHandler);
    }

    saveField(table, fieldIndex, form) {
        const fieldData = {
            name: form.fieldName.value,
            type: form.fieldType.value,
            comment: form.fieldComment.value,
            isPrimaryKey: form.isPrimaryKey.checked,
            isForeignKey: form.isForeignKey.checked,
            isNotNull: form.isNotNull.checked,
            isUnique: form.isUnique.checked,
            defaultValue: form.defaultValue.value
        };

        if (!table.fields) {
            table.fields = [];
        }

        if (fieldIndex !== null) {
            table.fields[fieldIndex] = fieldData;
        } else {
            table.fields.push(fieldData);
        }

        this.app.tableManager.updateTableDisplay(table);
        this.updatePropertiesPanel(table);
        this.app.markDirty();
    }

    deleteField(table, fieldIndex) {
        if (confirm('Вы уверены, что хотите удалить это поле?')) {
            table.fields.splice(fieldIndex, 1);
            this.app.tableManager.updateTableDisplay(table);
            this.updatePropertiesPanel(table);
            this.app.markDirty();
        }
    }

    deleteSelectedObject() {
        if (this.app.selectedObject) {
            if (confirm('Вы уверены, что хотите удалить выбранный объект?')) {
                this.app.canvas.remove(this.app.selectedObject);
                this.app.selectedObject = null;
                this.hidePropertiesPanel();
                this.app.markDirty();
            }
        }
    }

    duplicateSelectedObject() {
        if (this.app.selectedObject && this.app.selectedObject.type === 'table') {
            const table = this.app.selectedObject;
            const newTable = this.app.tableManager.createTable(
                table.left + 50,
                table.top + 50,
                table.tableName + '_copy',
                table.fill
            );
            
            // Копируем поля
            if (table.fields) {
                newTable.fields = JSON.parse(JSON.stringify(table.fields));
                this.app.tableManager.updateTableDisplay(newTable);
            }
            
            this.app.markDirty();
        }
    }

    showPropertiesPanel() {
        this.propertiesPanel.classList.add('visible');
    }

    hidePropertiesPanel() {
        this.propertiesPanel.classList.remove('visible');
    }

    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        document.body.appendChild(notification);

        // Анимация появления
        setTimeout(() => notification.classList.add('show'), 100);

        // Автоматическое скрытие
        const hideNotification = () => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        };

        if (duration > 0) {
            setTimeout(hideNotification, duration);
        }

        // Кнопка закрытия
        notification.querySelector('.notification-close').addEventListener('click', hideNotification);

        return notification;
    }

    onPropertyChange(e) {
        // Обработка изменений свойств
        this.app.markDirty();
    }

    onPropertyInput(e) {
        // Обработка ввода в поля свойств
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
} 