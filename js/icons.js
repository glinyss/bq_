let iconMap = {}; 

function parseItemPanelCSV(text) {
    const lines = text.split(/\r?\n/);
    iconMap = {};
    let count = 0;

    for(let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if(!line) continue;

        const cols = line.split(',');
        if(cols.length >= 5) {
            const itemID = cols[0].trim();   // minecraft:gold_ore
            const meta = cols[2].trim();     // 0
            const displayName = cols[4].trim(); // Золотая руда
            
            if(displayName) {
                // Сохраняем под ключом "ID:Meta"
                iconMap[`${itemID}:${meta}`] = displayName;
                count++;
            }
        }
    }
    console.log(`✅ База иконок загружена: ${count} предметов.`);
}

function loadItemPanelCSV() {
    fetch('itempanel.csv')
    .then(r => {
        if (!r.ok) throw new Error("CSV не найден");
        return r.arrayBuffer();
    })
    .then(buffer => {
        const text = new TextDecoder('windows-1251').decode(buffer);
        parseItemPanelCSV(text);
    })
    .catch(err => console.error("Ошибка загрузки CSV:", err));
}

loadItemPanelCSV();
