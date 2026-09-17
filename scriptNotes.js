
// ==========================================
// ИНИЦИАЛИЗАЦИЯ И КОНТРОЛЬ ДОСТУПА
// ==========================================

// Переменную userId НЕ объявляем через const/let, так как она уже есть в scriptCalendar.js
// Просто берем числовое значение для корректных запросов к базе данных
// Безопасно проверяем и подхватываем userId, не перезаписывая саму переменную
let activeUserId = null;

if (typeof userId !== 'undefined' && userId) {
    activeUserId = Number(userId);
} else {
    const savedUserId = localStorage.getItem('userId');
    activeUserId = savedUserId ? Number(savedUserId) : null;
}

// Защита: если пользователя в системе нет — отправляем на вход
if (!activeUserId) {
    window.location.href = 'login.html';
}

// КРИТИЧЕСКИ ВАЖНО: Переназначаем глобальную переменную на наше число,
// если она еще не была создана как константа в системе
if (typeof userId === 'undefined') {
    window.userId = activeUserId;
}

let allUsedTags = new Set(['Работа', 'Личное', 'Учеба', 'Важное']);
let currentActiveFilter = 'Все';
let allFolders = new Set();
let currentFolderFilter = 'Все';
let allLoadedNotes = [];



// ==========================================
// ФУНКЦИИ ВЗАИМОДЕЙСТВИЯ С СЕРВЕРОМ
// ==========================================

async function loadNotes() {
    try {
        // 1. Сначала загружаем папки пользователя с сервера
        const foldersResponse = await fetch(`https://web-organaizer-1.onrender.com/api/folders?userId=${userId}`);
        if (foldersResponse.ok) {
            const foldersArray = await foldersResponse.json();
            allFolders = new Set(foldersArray);
        }

        // 2. Затем загружаем заметки
        const response = await fetch(`https://web-organaizer-1.onrender.com/api/notes?userId=${userId}`);
        if (!response.ok) throw new Error('Ошибка загрузки заметок');

        const notes = await response.json();
        allLoadedNotes = notes.reverse();

        // Собираем динамические теги и папки (если они есть у заметок, но отсутствуют в списке папок)
        // Автоматически собираем уникальные ярлыки и папки, которые уже сохранены в базе
        allLoadedNotes.forEach(note => {
            // Безопасно преобразуем ярлыки в массив, чтобы прочитать каждый из них
            const noteTags = Array.isArray(note.tag) ? note.tag : (note.tag ? [note.tag] : []);
            noteTags.forEach(t => {
                if (t && t.trim() !== '') {
                    allUsedTags.add(t.trim()); // Добавляем каждый ярлык в общий список фильтров
                }
            });

            // Собираем папки (остается без изменений, проверяем закрывающие скобки)
            if (note.folder && note.folder.trim() !== '' && !allFolders.has(note.folder)) {
                allFolders.add(note.folder);
            }
        });

        updateSelectOptions();
        applyFilterAndRender();
    } catch (error) {
        console.error('Ошибка при инициализации данных:', error);
    }
}

// Новая функция сохранения папок на бэкенд
async function saveFoldersToServer() {
    try {
        await fetch('https://web-organaizer-1.onrender.com/api/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                folders: Array.from(allFolders) // Конвертируем Set в обычный массив для JSON
            })
        });
    } catch (error) {
        console.error('Не удалось сохранить структуру папок на сервере:', error);
    }
}

async function deleteNoteFromServer(noteId) {
    try {
        const response = await fetch(`https://web-organaizer-1.onrender.com/api/notes/${noteId}?userId=${userId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            allLoadedNotes = allLoadedNotes.filter(note => (note._id || note.id) !== noteId);
            applyFilterAndRender();
            return true;
        }

        const errData = await response.json();
        alert(errData.error || 'Ошибка при удалении заметки');
        return false;
    } catch (error) {
        console.error(error);
        return false;
    }
}


// ==========================================
// ОБРАБОТЧИКИ ФОРМ И КНОПОК
// ==========================================

// ==========================================
// ОБРАБОТЧИКИ ФОРМ И КНОПОК
// ==========================================

// Добавление новой папки вручную
document.getElementById('addNewFolderBtn')?.addEventListener('click', async () => {
    const name = prompt('Название новой папки:');
    if (name && name.trim() !== '') {
        const trimmed = name.trim();
        allFolders.add(trimmed);

        await saveFoldersToServer();
        updateSelectOptions();
        applyFilterAndRender();
    }
});

// Кнопка добавления нового ярлыка (если она есть на странице)
document.getElementById('addNewTagBtn')?.addEventListener('click', () => {
    const newTagName = prompt('Введите название нового ярлыка:');
    if (!newTagName) return;

    const trimmed = newTagName.trim();
    if (trimmed === '') return;

    allUsedTags.add(trimmed);

    // Проверяем, есть ли селект для тегов на текущей странице, прежде чем подставлять значение
    const tagSelect = document.getElementById('noteTag');
    if (tagSelect) tagSelect.value = trimmed;

    updateSelectOptions();
    applyFilterAndRender();
});

// УНИВЕРСАЛЬНЫЙ обработчик формы отправки заметки (Папки + Множественные Ярлыки)
document.getElementById('noteForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const titleInput = document.getElementById('noteTitle');
    const contentInput = document.getElementById('noteContent');
    const folderInput = document.getElementById('noteFolder');
    const messageDiv = document.getElementById('message');

    if (!titleInput || !contentInput) return;

    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    const folder = folderInput ? folderInput.value : '';

    // --- НОВЫЙ СБОР МНОЖЕСТВЕННЫХ ЯРЛЫКОВ ---
    // Находим только ТЕ чекбоксы, на которых пользователь поставил галочку
    const checkedBoxes = document.querySelectorAll('input[name="note_tags"]:checked');
    const tagsArray = Array.from(checkedBoxes).map(cb => cb.value);

    try {
        const response = await fetch('https://web-organaizer-1.onrender.com/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Отправляем массив тегов tagsArray вместо одиночной строки в поле tag
            body: JSON.stringify({ title, content, tag: tagsArray, folder, userId: userId })
        });

        if (response.ok) {
            const savedNote = await response.json();

            if (messageDiv) {
                messageDiv.style.color = 'green';
                messageDiv.textContent = 'Заметка успешно сохранена!';
            }

            // Добавляем свежую заметку в начало нашего локального массива заметок
            allLoadedNotes.unshift(savedNote);

            // Если среди выбранных тегов были новые, добавляем их в общий список
            tagsArray.forEach(t => { if (t) allUsedTags.add(t); });
            if (folder) allFolders.add(folder);

            // Автоматически закрываем окно на notes.html после сохранения заметки
            const noteModal = document.getElementById('noteModal');
            if (noteModal) {
                noteModal.style.display = 'none';
            }


            // Сбрасываем текст в текстовых полях формы
            document.getElementById('noteForm').reset();

            // КРИТИЧЕСКИ ВАЖНО: Снимаем галочки со всех чекбоксов после успешного сохранения
            checkedBoxes.forEach(cb => { cb.checked = false; });

            // Перерисовываем список заметок и селекты на экране МГНОВЕННО без перезагрузки
            updateSelectOptions();
            applyFilterAndRender();

        } else {
            const errData = await response.json();
            if (messageDiv) {
                messageDiv.style.color = 'red';
                messageDiv.textContent = errData.error || 'Ошибка сохранения';
            }
        }
    } catch (error) {
        console.error('Ошибка при сохранении заметки:', error);
    }
});



// Кнопка добавления ярлыка (из вашего исходного кода)
document.getElementById('addNewTagBtn')?.addEventListener('click', () => {
    const newTagName = prompt('Введите название нового ярлыка:');
    if (!newTagName) return;

    const trimmed = newTagName.trim();
    if (trimmed === '') return;

    allUsedTags.add(trimmed);
    appendTagToSelectIfMissing(trimmed);
    document.getElementById('noteTag').value = trimmed;

    renderTagsFilters();
});

// НОВАЯ кнопка ручного добавления папки
document.getElementById('addNewFolderBtn')?.addEventListener('click', async () => {
    const name = prompt('Название новой папки:');
    if (name && name.trim() !== '') {
        const trimmed = name.trim();
        allFolders.add(trimmed);

        // Синхронизируем с сервером
        await saveFoldersToServer();

        updateSelectOptions();
        applyFilterAndRender();
    }
});


// ==========================================
// РЕНДЕРИНГ И ИНТЕРФЕЙС
// ==========================================

function applyFilterAndRender() {
    const container = document.getElementById('notes-list');
    if (!container) return;

    container.innerHTML = "";

    const titleElement = document.getElementById('current-view-title');
    if (titleElement) {
        titleElement.textContent = `📁 Папка: ${currentFolderFilter} | 🏷️ Ярлык: ${currentActiveFilter}`;
    }

    // ДВОЙНАЯ ФИЛЬТРАЦИЯ
    const filteredNotes = allLoadedNotes.filter(note => {
        // 1. Проверяем папку
        const noteFolder = note.folder || "";
        const matchesFolder = (currentFolderFilter === 'Все' || noteFolder === currentFolderFilter);

        // 2. Проверяем ярлыки: преобразуем в массив, даже если в БД лежит старая строка
        const noteTags = Array.isArray(note.tag) ? note.tag : (note.tag ? [note.tag] : []);
        const matchesTag = (currentActiveFilter === 'Все' || noteTags.includes(currentActiveFilter));

        return matchesFolder && matchesTag;
    });

    if (filteredNotes.length === 0) {
        container.innerHTML = "<p style='color: #666; font-style: italic;'>Нет заметок, соответствующих выбранным фильтрам.</p>";
    } else {
        filteredNotes.forEach(note => displayNote(note));
    }

    renderFoldersFilters();
    renderTagsFilters();
}




function displayNote(note) {
    const container = document.getElementById('notes-list');
    if (!container) return;

    const noteElement = document.createElement('div');
    noteElement.className = 'note-item';
    const noteId = note._id || note.id;
    noteElement.dataset.id = noteId;

    const contentWrapper = document.createElement('div');
    contentWrapper.style.flexGrow = '1';

    const h4 = document.createElement('h4');
    h4.style.margin = '0 0 5px 0';
    h4.textContent = note.title || 'Без названия';

    const p = document.createElement('p');
    p.className = 'note-text';
    p.textContent = note.content || '';

    contentWrapper.appendChild(h4);
    contentWrapper.appendChild(p);

    // --- НОВЫЙ БЛОК ОТРИСОВКИ МНОЖЕСТВЕННЫХ ЯРЛЫКОВ ---
    // Переводим теги конкретной заметки в массив для безопасного перебора
    const noteTags = Array.isArray(note.tag) ? note.tag : (note.tag ? [note.tag] : []);

    if (noteTags.length > 0) {
        // Создаем контейнер, чтобы ярлыки встали в один горизонтальный ряд
        const tagsWrapper = document.createElement('div');
        tagsWrapper.style.display = 'flex';
        tagsWrapper.style.flexWrap = 'wrap';
        tagsWrapper.style.gap = '4px';
        tagsWrapper.style.marginTop = '8px';

        noteTags.forEach(tag => {
            const tagSpan = document.createElement('span');
            // Применяем ваши стили из CSS (tag-work, tag-personal и т.д.)
            tagSpan.className = `note-tag tag-${getTagNameEng(tag)}`;
            tagSpan.textContent = `🏷️ ${tag}`;
            tagsWrapper.appendChild(tagSpan);
        });

        contentWrapper.appendChild(tagsWrapper);
    }
    // --------------------------------------------------

    noteElement.appendChild(contentWrapper);

    // Кнопка удаления заметки
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-note-btn';
    deleteBtn.innerHTML = '✖';
    deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Вы уверены, что хотите удалить эту заметку?')) {
            const res = await fetch(`https://web-organaizer-1.onrender.com/api/notes/${noteId}?userId=${userId}`, { method: 'DELETE' });
            if (res.ok) {
                allLoadedNotes = allLoadedNotes.filter(n => (n._id || n.id) !== noteId);
                applyFilterAndRender();
            }
        }
    });

    noteElement.appendChild(deleteBtn);
    container.appendChild(noteElement);
}


function getTagNameEng(tag) {
    const map = { 'Работа': 'work', 'Личное': 'personal', 'Учеба': 'study', 'Важное': 'important' };
    return map[tag] || 'default';
}


// 1. Рендеринг фильтров ярлыков (ваш исходный код + фикс)
function renderTagsFilters() {
    const container = document.getElementById('tagsFilterContainer');
    if (!container) return;

    container.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = `filter-tag-btn ${currentActiveFilter === 'Все' ? 'active' : ''}`;
    allBtn.textContent = '🌍 Все ярлыки';
    allBtn.addEventListener('click', () => {
        currentActiveFilter = 'Все';
        applyFilterAndRender();
    });
    container.appendChild(allBtn);

    allUsedTags.forEach(tag => {
        if (!tag) return;
        const btn = document.createElement('button');
        btn.className = `filter-tag-btn ${currentActiveFilter === tag ? 'active' : ''}`;
        btn.textContent = `🏷️ ${tag}`;
        btn.addEventListener('click', () => {
            currentActiveFilter = tag;
            applyFilterAndRender();
        });
        container.appendChild(btn);
    });
}

// 2. Рендеринг фильтров папок с контекстным управлением (ЛКМ — открыть, ПКМ — изменить)
function renderFoldersFilters() {
    const container = document.getElementById('foldersFilterContainer');
    if (!container) return;

    container.innerHTML = '';

    // Кнопка "Все папки"
    const allBtn = document.createElement('button');
    allBtn.className = `filter-tag-btn ${currentFolderFilter === 'Все' ? 'active' : ''}`;
    allBtn.textContent = '📁 Все папки';
    allBtn.addEventListener('click', () => {
        currentFolderFilter = 'Все';
        applyFilterAndRender();
    });
    container.appendChild(allBtn);

    // Рендеринг пользовательских папок
    allFolders.forEach(folder => {
        if (!folder) return;
        const btn = document.createElement('button');
        btn.className = `filter-tag-btn ${currentFolderFilter === folder ? 'active' : ''}`;
        btn.textContent = `📁 ${folder}`;
        btn.title = "ЛКМ — открыть папки, ПКМ — настроить";

        // Обычный клик (ЛКМ) — Фильтрация заметок
        btn.addEventListener('click', () => {
            currentFolderFilter = folder;
            applyFilterAndRender();
        });

        // Правый клик (ПКМ) — Меню управления папкой (Переименовать / Удалить)
        btn.oncontextmenu = async (e) => {
            e.preventDefault(); // Блокируем стандартное браузерное меню

            const action = prompt(`Управление папкой "${folder}":\n1 — Переименовать папку\n2 — Полностью удалить папку\n\nВведите цифру действия:`);

            if (action === '1') {
                // ПЕРЕИМЕНОВАНИЕ
                const newName = prompt(`Введите новое название для папки "${folder}":`, folder);
                if (newName && newName.trim() !== '' && newName.trim() !== folder) {
                    const trimmed = newName.trim();

                    // Обновляем папку у локальных заметок
                    allLoadedNotes.forEach(note => {
                        if (note.folder === folder) note.folder = trimmed;
                    });

                    allFolders.delete(folder);
                    allFolders.add(trimmed);

                    if (currentFolderFilter === folder) currentFolderFilter = trimmed;

                    // Синхронизация с сервером
                    await saveFoldersToServer();
                    updateSelectOptions();
                    applyFilterAndRender();
                }
            } else if (action === '2') {
                // УДАЛЕНИЕ
                if (confirm(`Вы уверены, что хотите удалить папку "${folder}"?\nЗаметки внутри неё сохранятся и переместятся в корень ("Без папки").`)) {

                    // Сбрасываем привязку папки у заметок
                    allLoadedNotes.forEach(note => {
                        if (note.folder === folder) note.folder = '';
                    });

                    allFolders.delete(folder);
                    if (currentFolderFilter === folder) currentFolderFilter = 'Все';

                    // Синхронизация с сервером
                    await saveFoldersToServer();
                    updateSelectOptions();
                    applyFilterAndRender();
                }
            }
        };

        container.appendChild(btn);
    });
}



// Добавление тегов в селект (из вашего кода)
function appendTagToSelectIfMissing(tagName) {
    const select = document.getElementById('noteTag');
    if (!select) return;
    const exists = Array.from(select.options).some(option => option.value === tagName);
    if (!exists) {
        const newOption = document.createElement('option');
        newOption.value = tagName;
        // ИСПРАВЛЕНО: добавлены обратные кавычки ` `
        newOption.textContent = `🏷️ ${tagName}`;
        select.appendChild(newOption);
    }
}

// НОВОЕ Добавление папок в селект
function appendFolderToSelectIfMissing(folderName) {
    const select = document.getElementById('noteFolder');
    if (!select) return;
    const exists = Array.from(select.options).some(option => option.value === folderName);
    if (!exists) {
        const newOption = document.createElement('option');
        newOption.value = folderName;
        // ИСПРАВЛЕНО: добавлены обратные кавычки ` `
        newOption.textContent = `📁 ${folderName}`;
        select.appendChild(newOption);
    }
}

// Вспомогательная функция обновления чекбоксов (Select) в форме создания заметки
function updateSelectOptions() {
    const folderSelect = document.getElementById('noteFolder');
    const tagsContainer = document.getElementById('noteTagsCheckboxesContainer');

    if (folderSelect) {
        folderSelect.innerHTML = '<option value="">Без папки (Корень)</option>';
        allFolders.forEach(folder => {
            if (folder) folderSelect.innerHTML += `<option value="${folder}">📁 ${folder}</option>`;
        });
    }

    if (tagsContainer) {
        tagsContainer.innerHTML = '';
        allUsedTags.forEach(tag => {
            if (!tag) return;
            // Создаем обертку-лейбл для каждого чекбокса
            const label = document.createElement('label');
            label.style = 'display: flex; align-items: center; gap: 5px; font-size: 13px; cursor: pointer; background: #fff; padding: 4px 8px; border-radius: 4px; border: 1px solid #ddd;';
            label.innerHTML = `<input type="checkbox" name="note_tags" value="${tag}"> 🏷️ ${tag}`;
            tagsContainer.appendChild(label);
        });
    }
}

// ==========================================
// ЛОГИКА УПРАВЛЕНИЯ МОДАЛЬНЫМ ОКНОМ (ДЛЯ NOTES.HTML)
// ==========================================

const modal = document.getElementById('noteModal');
const openModalBtn = document.getElementById('openModalBtn');
const closeModalBtn = document.querySelector('.close-modal');

// Если на странице есть кнопка "+ Создать заметку", настраиваем её клик
if (openModalBtn && modal) {
    openModalBtn.addEventListener('click', () => {
        modal.style.display = 'block'; // Показываем модальное окно
    });
}

// Если на странице есть крестик закрытия внутри модального окна
if (closeModalBtn && modal) {
    closeModalBtn.addEventListener('click', () => {
        modal.style.display = 'none'; // Скрываем модальное окно
    });
}

// Закрытие окна, если пользователь кликнул на темную область вокруг формы
window.addEventListener('click', (e) => {
    if (modal && e.target === modal) {
        modal.style.display = 'none';
    }
});


// Инициализация
    document.addEventListener('DOMContentLoaded', loadNotes);
