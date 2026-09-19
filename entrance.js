const authForm = document.getElementById('authForm');
const formTitle = document.getElementById('form-title');
const submitBtn = document.getElementById('submitBtn');
const switchMode = document.getElementById('switchMode');
const toggleText = document.getElementById('toggleText');

// По умолчанию режим "login" (Вход)
let isLoginMode = true;

// Переключение между Входом и Регистрацией
// Проверяем, есть ли кнопка переключения на странице, прежде чем вешать событие
if (switchMode) {
    switchMode.addEventListener('click', function handleSwitch() {
        isLoginMode = !isLoginMode;

        if (isLoginMode) {
            formTitle.textContent = "Войти в аккаунт";
            submitBtn.textContent = "Войти";
            toggleText.innerHTML = 'Ещё нет аккаунта? <span id="switchMode">Зарегистрироваться</span>';
        } else {
            formTitle.textContent = "Регистрация";
            submitBtn.textContent = "Создать аккаунт";
            toggleText.innerHTML = 'Уже есть аккаунт? <span id="switchMode">Войти</span>';
        }

        // Переназначаем событие клика на динамически созданный span
        const newSwitchBtn = document.getElementById('switchMode');
        if (newSwitchBtn) {
            newSwitchBtn.addEventListener('click', handleSwitch);
        }
    });
}
// Отправка формы на сервер
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const usernameInput = document.getElementById('username').value;
    const passwordInput = document.getElementById('password').value;

    // Определяем эндпоинт в зависимости от режима
    const endpoint = isLoginMode ? '/api/login' : '/api/register';

    try {
        const response = await fetch(`http://localhost:5000${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameInput, password: passwordInput })
        });

        const data = await response.json();

        if (!response.ok) {
            // Если сервер вернул ошибку (например, 400)
            alert(data.error || "Что-то пошло не так");
            return;
        }

        if (isLoginMode) {
            // ЕСЛИ ЭТО ВХОД: сохраняем данные и идем в органайзер
            alert(`Привет, ${data.user.username}!`);
            localStorage.setItem('userId', data.user.id);
            localStorage.setItem('username', data.user.username);

            window.location.href = 'index.html'; // Ваша главная страница с календарем
        } else {
            // ЕСЛИ ЭТО РЕГИСТРАЦИЯ: переключаем на вход
            alert("Регистрация успешна! Теперь войдите в аккаунт.");
            switchMode.click();
        }

    } catch (error) {
        console.error("Ошибка сети:", error);
        alert("Не удалось подключиться к серверу. Убедитесь, что бэкенд запущен.");
    }
});
