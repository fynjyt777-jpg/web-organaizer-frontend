const grid = document.getElementById('calendar-grid');
const title = document.getElementById('month-year-title');
const prevBtn = document.getElementById('prev-month');
const nextBtn = document.getElementById('next-month');


// Получаем ID авторизованного пользователя из localStorage
const userId = localStorage.getItem('userId');

// Защита: если пользователь не залогинен, перенаправляем на страницу входа
if (!userId) {
    window.location.href = 'login.html'; // Укажите имя вашего HTML-файла для входа
}

// Получаем имя пользователя из localStorage
const currentUsername = localStorage.getItem('username');

// Находим элемент на странице и подставляем имя пользователя
const usernameDisplay = document.getElementById('current-username');
if (usernameDisplay && currentUsername) {
    usernameDisplay.textContent = currentUsername;
}

// Настраиваем кнопку «Выйти», если она есть на странице
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (confirm('Вы действительно хотите выйти из аккаунта?')) {
            // Полностью очищаем данные авторизации из браузера
            localStorage.removeItem('userId');
            localStorage.removeItem('username');

            // Перенаправляем на страницу входа
            window.location.href = 'login.html';
        }
    });
}

let currentDate = new Date();

const monthNames = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

// ГЛОБАЛЬНЫЙ ОБРАБОТЧИК (Делегирование событий)
// Он слушает изменения во ВСЕХ textarea внутри сетки календаря
grid.addEventListener('change', async (event) => {
    // Проверяем, что событие произошло именно внутри текстового поля дня
    if (event.target && event.target.classList.contains('day-textarea')) {
        const textarea = event.target;
        const storageKey = textarea.dataset.key; // Достаем уникальный ключ дня
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        console.log(`📡 Отправляем на сервер: ${storageKey} -> ${textarea.value}`);

        try {
            const response = await fetch('https://web-organaizer-1.onrender.com/api/calendar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    key: storageKey,
                    text: textarea.value,
                    year: year,
                    month: month,
                    userId: userId // Передаем ID пользователя для привязки данных
                })
            });

            if (response.ok) {
                console.log('✅ Успешно сохранено на сервере!');
            } else {
                console.error('❌ Сервер вернул ошибку при сохранении');
            }
        } catch (error) {
            console.error("❌ Сетевая ошибка сохранения задачи:", error);
        }
    }
});

async function renderCalendar() {
    grid.innerHTML = "";

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    title.textContent = `${monthNames[month]} ${year}`;

    let monthlyTasks = {};
    try {
        // Передаем userId в query-параметрах, чтобы сервер знал, чей календарь читать
        const response = await fetch(`https://web-organaizer-1.onrender.com/api/calendar?year=${year}&month=${month}&userId=${userId}`);
        if (response.ok) {
            monthlyTasks = await response.json();
        }
    } catch (error) {
        console.error("Ошибка при загрузке календаря:", error);
    }

    const firstDay = new Date(year, month, 1);
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const totalDays = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < startDayOfWeek; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.classList.add('empty-cell');
        grid.appendChild(emptyCell);
    }

    for (let day = 1; day <= totalDays; day++) {
        const cell = document.createElement('div');
        cell.classList.add('day-cell');

        const dayNumber = document.createElement('div');
        dayNumber.classList.add('day-number');
        dayNumber.textContent = day;
        cell.appendChild(dayNumber);

        const textarea = document.createElement('textarea');
        textarea.classList.add('day-textarea');
        textarea.placeholder = "Новая задача...";

        const storageKey = `tasks-${year}-${month}-${day}`;

        // Вшиваем ключ прямо в HTML-тег элемента (через data-атрибут)
        textarea.dataset.key = storageKey;
        textarea.value = monthlyTasks[storageKey] || "";

        cell.appendChild(textarea);
        grid.appendChild(cell);
    }
}

prevBtn.addEventListener('click', async () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    await renderCalendar();
});

nextBtn.addEventListener('click', async () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    await renderCalendar();
});

// Запуск первой отрисовки при загрузке страницы
renderCalendar();
