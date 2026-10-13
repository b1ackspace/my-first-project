document.addEventListener('DOMContentLoaded', () => {
    console.log("Инициализация карты с анимацией движения...");

    const map = L.map('map').setView([55.030204, 82.920430], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // Хранилище для маркеров, которые СЕЙЧАС ОТРЕСОВАНЫ на карте
    // Ключом будет id автобуса, а значением - сам объект маркера Leaflet
    const activeMarkers = {}; 
    
    // Хранилище для всех сырых данных с сервера
    let allTransportData = [];

    // Функция создания кастомной иконки транспорта
    function createTransportIcon(type, route) {
        let emoji = '🚌';
        let colorClass = 'bus-bg';

        if (type === 'Троллейбус') { emoji = '🚎'; colorClass = 'trolley-bg'; }
        else if (type === 'Трамвай') { emoji = '🚋'; colorClass = 'tram-bg'; }
        else if (type === 'Маршрутка') { emoji = '🚐'; colorClass = 'minibus-bg'; }

        return L.divIcon({
            html: `
                <div class="transport-marker ${colorClass}">
                    <span class="emoji">${emoji}</span>
                    <span class="route-num">${route}</span>
                </div>
            `,
            className: 'custom-marker-container',
            iconSize: L.point(36, 36),     // Размеры кружка установлены напрямую
            iconAnchor: L.point(18, 18)    // Центрирование установлено напрямую
        });
    }

    // Функция отрисовки и фильтрации с поддержкой плавной анимации
    function renderFilteredTransport() {
        // Смотрим, какие чекбоксы сейчас активны
        const activeTypes = Array.from(document.querySelectorAll('#filterPanel input:checked'))
                                 .map(input => input.value);

        // Перебираем все данные, пришедшие с Java-сервера
        allTransportData.forEach(item => {
            const isVisible = activeTypes.includes(item.type);

            // Если этот тип транспорта выбран в фильтрах
            if (isVisible) {
                // ПРОВЕРКА: Если такой автобус УЖЕ ЕСТЬ на карте, мы его ПЛАВНО ДВИГАЕМ
                if (activeMarkers[item.id]) {
                    const marker = activeMarkers[item.id];
                    
                    // .slideTo([широта, долгота], время_анимации_в_миллисекундах)
                    // Двигаем маркер ровно 15000 мс (15 секунд), пока не придут новые координаты
                    marker.slideTo([item.lat, item.lng], 15000);
                    
                    // Обновляем текст во всплывающем окошке (вдруг скорость изменилась)
                    marker.setPopupContent(`<b>${item.type} №${item.route}</b><br>${item.desc}`);
                } 
                // Если этого автобуса еще нет на карте — создаем его с нуля
                else {
                    const customIcon = createTransportIcon(item.type, item.route);
                    const marker = L.marker([item.lat, item.lng], { icon: customIcon }).addTo(map);
                    
                    marker.bindPopup(`<b>${item.type} №${item.route}</b><br>${item.desc}`);
                    
                    // Сохраняем маркер в наше хранилище по его ID
                    activeMarkers[item.id] = marker;
                }
            } 
            // Если пользователь выключил этот тип транспорта в фильтрах
            else {
                // Если маркер был на карте — удаляем его
                if (activeMarkers[item.id]) {
                    map.removeLayer(activeMarkers[item.id]);
                    delete activeMarkers[item.id]; // Стираем из памяти
                }
            }
        });
    }

    // Функция загрузки данных с Java-сервера
    async function loadTransportData() {
        try {
            const response = await fetch('http://localhost:8080/api/buses');
            if (!response.ok) throw new Error('Ошибка сети');
            
            allTransportData = await response.json();

            // Запускаем умную отрисовку с анимацией
            renderFilteredTransport();

        } catch (error) {
            console.error("Ошибка обновления данных из Java:", error);
        }
    }

    // Настройка кликов по кнопкам фильтра
    document.querySelectorAll('#filterPanel input').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            // При изменении фильтра сразу перерисовываем карту
            renderFilteredTransport();
        });
    });

    // Первый запуск
    loadTransportData();

    // Запрашиваем новые координаты у Java каждые 15 секунд
    setInterval(loadTransportData, 15000);
});
