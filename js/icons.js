let iconMap = {}; // "minecraft:stone:0" -> "Камень"

document.getElementById('iconFileInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const buffer = e.target.result;
            const text = new TextDecoder('windows-1251').decode(buffer);
            parseItemPanelCSV(text);
        };
        reader.readAsArrayBuffer(file);
    }
});

function parseItemPanelCSV(text) {
    const lines = text.split(/\r?\n/);
    iconMap = {};
    for(let i=1; i<lines.length; i++) {
        const cols = lines[i].split(',');
        if(cols.length >= 5) {
            const itemName = cols[0];
            const itemID = cols[1];
            const meta = cols[2];
            const displayName = cols.slice(4).join(',').replace('\r', '').trim();
            if(!displayName) continue;
            
            iconMap[`${itemName}:${meta}`] = displayName;
            iconMap[`${itemID}:${meta}`] = displayName;
        }
    }
    console.log("Loaded icon mapping. Total keys:", Object.keys(iconMap).length);
    if(typeof db !== 'undefined' && db && typeof currentLineId !== 'undefined' && currentLineId !== null) {
        renderQuests(db['questLines:9'][currentLineKey]);
    }
    alert("База предметов (itempanel.csv) успешно загружена! Иконки подключены.");
}

// Call on load
loadItemPanelCSV();

function loadItemPanelCSV() {
    // Путь 'itempanel.csv' сработает, так как файл лежит в корне рядом с index.html
    fetch('itempanel.csv')
    .then(r => {
        if (!r.ok) throw new Error("Файл itempanel.csv не найден на сервере");
        return r.arrayBuffer();
    })
    .then(buffer => {
        const text = new TextDecoder('windows-1251').decode(buffer);
        parseItemPanelCSV(text);
        console.log("✅ База предметов успешно загружена автоматически");
    })
    .catch(err => {
        console.warn("⚠️ Автозагрузка не удалась (это нормально при локальном запуске без сервера):", err.message);
    });
}