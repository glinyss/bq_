// --- НАСТРОЙКИ GITHUB (ОБЯЗАТЕЛЬНО ЗАПОЛНИ!) ---
const GITHUB_USER = "glinyss";
const GITHUB_REPO = "bq_";  
const FILE_PATH = "QuestDatabase.json"; 

let db = null;
let currentLineId = null;
let currentLineKey = null;
let questMap = {};

// Canvas Transform State
var translateX = 0, translateY = 0, scale = 1;

// --- 1. ЗАГРУЗКА БАЗЫ ИЗ GITHUB ---
async function loadDataFromGitHub() {
    try {
        // Запрос к файлу напрямую (добавляем ?t= timestamp чтобы сбросить кэш браузера)
        const url = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/${FILE_PATH}?t=${Date.now()}`;
        const res = await fetch(url);
        
        if (res.ok) {
            db = await res.json();
            console.log("✅ База успешно загружена из GitHub!");
            processDatabase();
        } else {
            console.warn("Файл базы не найден на GitHub. Загрузите локальный файл для инициализации.");
        }
    } catch (err) {
        console.error("Ошибка скачивания базы:", err);
    }
}

// Запускаем загрузку при открытии страницы
loadDataFromGitHub();

// Ручная загрузка файла с компьютера (оставил на всякий случай)
document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                db = JSON.parse(e.target.result);
                console.log("Database Loaded locally");
                processDatabase();
                alert("Локальный файл загружен! Нажмите Save to GitHub, чтобы отправить его в облако.");
            } catch(err) {
                alert("Error parsing JSON: " + err.message);
            }
        };
        reader.readAsText(file);
    }
});

function processDatabase() {
    questMap = {};
    if(db['questDatabase:9']) {
        iterateBQArray(db['questDatabase:9'], (q) => {
            const qID = q['questID:3'];
            questMap[qID] = q;
        });
    }
    initSidebar();
    
    // Проверяем, есть ли админские права (токен)
    if (localStorage.getItem('gh_token')) {
        enableAdminMode();
    }
}

// --- 2. АВТОРИЗАЦИЯ И РЕЖИМ АДМИНА ---
window.addEventListener('load', () => {
    const btnLogin = document.getElementById('btnLogin');
    const userStatus = document.getElementById('userStatus');
    
    // Если токен уже есть, сразу включаем админку
    if (localStorage.getItem('gh_token')) {
        enableAdminMode();
    }

    if (btnLogin) {
        btnLogin.onclick = () => {
            const inputToken = prompt("Введите GitHub Personal Access Token\\n(Оставьте пустым, чтобы выйти из админки):");
            if (inputToken) {
                localStorage.setItem('gh_token', inputToken);
                enableAdminMode();
                alert("Токен сохранен! Режим редактирования включен.");
            } else if (inputToken === "") {
                // Если передали пустую строку — удаляем токен (выход)
                localStorage.removeItem('gh_token');
                location.reload(); 
            }
        };
    }
});

function enableAdminMode() {
    const userStatus = document.getElementById('userStatus');
    const btnLogin = document.getElementById('btnLogin');
    const saveBtn = document.getElementById('btnSave');
    
    if (userStatus) userStatus.style.display = 'inline';
    if (btnLogin) btnLogin.style.display = 'none';
    if (saveBtn) saveBtn.textContent = "Save to GitHub";
    
    document.getElementById('btnAddQuest').style.display = 'inline-block';
    document.getElementById('btnLinkQuests').style.display = 'inline-block';
    document.getElementById('btnAddQuestLine').style.display = 'inline-block';
}

// --- 3. СОХРАНЕНИЕ НА GITHUB ---
document.getElementById('btnSave').addEventListener('click', async () => {
    if(!db) return alert("База пуста! Нечего сохранять.");
    
    const token = localStorage.getItem('gh_token');
    
    // Если мы гость — просто качаем JSON на комп
    if (!token) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
        const dt = new Date();
        const ts = `${dt.getFullYear()}_${dt.getMonth()+1}_${dt.getDate()}`;
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `QuestDatabase_${ts}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        return;
    }

    // Если мы админ — шлем через GitHub API
    const apiUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
    const saveBtn = document.getElementById('btnSave');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = "Saving...";
    saveBtn.disabled = true;
    
    try {
        console.log("Получаем SHA старого файла...");
        let sha = "";
        const getRes = await fetch(apiUrl, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (getRes.ok) {
            const currentData = await getRes.json();
            sha = currentData.sha; // Без SHA GitHub не даст перезаписать файл
        }

        console.log("Отправляем обновленную базу...");
        // Конвертируем JSON в Base64 с поддержкой кириллицы
        const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(db, null, 2))));

        const putRes = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: "Update Quests Database via Web Editor",
                content: contentBase64,
                sha: sha || undefined
            })
        });

        if (putRes.ok) {
            alert("✅ Успешно сохранено на GitHub!");
        } else {
            const errData = await putRes.json();
            alert("❌ Ошибка сохранения GitHub: " + errData.message);
        }
    } catch (err) {
        alert("Ошибка сети при сохранении: " + err.message);
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
});


// --- 4. ОРИГИНАЛЬНАЯ ЛОГИКА РЕДАКТОРА (Добавление, Ветки, Поиск) ---

document.getElementById('btnAddQuest').addEventListener('click', () => {
    if(!db || currentLineKey === null) return alert("Select a quest line first!");
    
    // Find Max ID
    let maxID = -1;
    if(db['questDatabase:9']) {
        iterateBQArray(db['questDatabase:9'], (q) => {
            if(q['questID:3'] > maxID) maxID = q['questID:3'];
        });
    }
    const newID = maxID + 1;
    
    // 1. Add to questDatabase:9
    const newQuest = {
        "questID:3": newID,
        "preRequisites:11": [],
        "properties:10": {
            "betterquesting:10": {
                "name:8": "New Quest " + newID,
                "desc:8": "No Description"
            }
        },
        "tasks:9": {},
        "rewards:9": {}
    };
    
    let dbKey = 0;
    while(db['questDatabase:9'][`${dbKey}:10`]) dbKey++;
    db['questDatabase:9'][`${dbKey}:10`] = newQuest;
    questMap[newID] = newQuest; // Update map
    
    // 2. Add to current line
    const currentLine = db['questLines:9'][currentLineKey];
    if(!currentLine['quests:9']) currentLine['quests:9'] = {};
    let lineKey = 0;
    while(currentLine['quests:9'][`${lineKey}:10`]) lineKey++;
    currentLine['quests:9'][`${lineKey}:10`] = {
        "x:3": 0,
        "y:3": 0,
        "id:3": newID,
        "size:3": 24
    };
    
    renderQuests(currentLine);
    selectQuest(newQuest);
});

document.getElementById('btnAddQuestLine').addEventListener('click', () => {
    if(!db) return;
    let maxLineID = -1;
    if(db['questLines:9']) {
        iterateBQArray(db['questLines:9'], (l) => {
            if(l['lineID:3'] > maxLineID) maxLineID = l['lineID:3'];
        });
    }
    const newLineID = maxLineID + 1;
    
    const newLine = {
        "lineID:3": newLineID,
        "properties:10": {
            "betterquesting:10": {
                "name:8": "New Quest Line " + newLineID,
                "bg_image:8": "",
                "bg_size:3": 256
            }
        },
        "quests:9": {}
    };
    
    let lKey = 0;
    while(db['questLines:9'][`${lKey}:10`]) lKey++;
    db['questLines:9'][`${lKey}:10`] = newLine;
    
    initSidebar();
});

// Linking Mode State
let linkMode = false;
let parentQuestID = null;

const btnLink = document.getElementById('btnLinkQuests');
btnLink.addEventListener('click', () => {
    linkMode = !linkMode;
    parentQuestID = null;
    btnLink.textContent = linkMode ? 'Link Mode: ON' : 'Link Mode: OFF';
    btnLink.style.background = linkMode ? 'var(--accent)' : '#334155';
    if(linkMode) {
        alert("Link Mode Active: Click PARENT quest, then CHILD quest to create a dependency.");
    }
});

function initSidebar() {
    const linesList = document.getElementById('questLinesList');
    linesList.innerHTML = '';
    
    let questLines = db['questLines:9'];
    if (!questLines) return; // alert("No quest lines found in the JSON."); убрал алерт для пустой базы
    
    let firstId = null;
    iterateBQArray(questLines, (lineObj, index, rawKey) => {
        let nameObj = lineObj['properties:10']?.['betterquesting:10'];
        let name = "Unknown Line";
        if(nameObj && nameObj['name:8']) {
            name = nameObj['name:8'];
            // Remove styling codes like §5
            name = name.replace(/§./g, '');
        }
        
        const lineID = lineObj['lineID:3'];
        if(firstId === null) firstId = lineID;
        
        const li = document.createElement('li');
        li.textContent = name;
        li.dataset.lineId = lineID;
        li.onclick = () => {
             document.querySelectorAll('#questLinesList li').forEach(el => el.classList.remove('active'));
             li.classList.add('active');
             selectQuestLine(lineID, rawKey, lineObj);
        };
        linesList.appendChild(li);
    });
}

function selectQuestLine(id, rawKey, lineObj) {
    currentLineId = id;
    currentLineKey = rawKey;
    renderQuests(lineObj);
    
    if (typeof openLineProperties === 'function') {
        openLineProperties(lineObj);
    }

    if (lineObj['quests:9']) {
        let firstQuest = null;
        
        iterateBQArray(lineObj['quests:9'], (qp) => {
            if (!firstQuest) firstQuest = qp;
        });

        const canvasContainer = document.getElementById('canvasContainer');
        if (firstQuest && canvasContainer) {
            const cw = canvasContainer.clientWidth;
            const ch = canvasContainer.clientHeight;
            
            translateX = (cw / 2) - (firstQuest['x:3'] * scale);
            translateY = (ch / 2) - (firstQuest['y:3'] * scale);
            
            if (typeof updateTransform === 'function') {
                updateTransform();
            }
        } else if (canvasContainer) {
            translateX = 0;
            translateY = 0;
            if (typeof updateTransform === 'function') {
                updateTransform();
            }
        }
    }
}

// Quest Search Logic
const questSearch = document.getElementById('questSearch');
const questSearchResults = document.getElementById('questSearchResults');

let globalSearchTimeout = null;
questSearch.addEventListener('input', (e) => {
    if(globalSearchTimeout) clearTimeout(globalSearchTimeout);
    globalSearchTimeout = setTimeout(() => {
        const query = e.target.value.toLowerCase();
        questSearchResults.innerHTML = '';
        
        if(!query || !db) {
            questSearchResults.style.display = 'none';
            return;
        }
        
        questSearchResults.style.display = 'flex';
        renderGlobalSearchResults(query);
    }, 200);
});

function renderGlobalSearchResults(query) {
    let count = 0;
    
    const dbQuests = db['questDatabase:9'];
    if(dbQuests) {
        iterateBQArray(dbQuests, (q) => {
            const qID = q['questID:3'];
            const props = q['properties:10']?.['betterquesting:10'];
            const qName = (props?.['name:8'] || `Quest #${qID}`).replace(/§./g, '');
            const qDesc = (props?.['desc:8'] || '').replace(/§./g, '');
            
            if (qName.toLowerCase().includes(query) || String(qID).includes(query) || qDesc.toLowerCase().includes(query)) {
                if(count > 50) return; // limit
                count++;
                
                const sRow = document.createElement('div');
                sRow.className = 'search-item';
                sRow.innerHTML = `<div><strong>${qName}</strong> <span style="opacity:0.5">(ID: ${qID})</span></div>`;
                
                sRow.onmousedown = () => { // mousedown ignores focus loss
                    // Find which quest line contains this quest
                    let targetLineKey = null;
                    let targetLineObj = null;
                    let targetPos = null;
                    let qPosObj = null;
                    
                    if(db['questLines:9']) {
                        iterateBQArray(db['questLines:9'], (lineObj, idx, lKey) => {
                            if(lineObj['quests:9']) {
                                iterateBQArray(lineObj['quests:9'], (qp) => {
                                    if(qp['id:3'] === qID) {
                                        targetLineKey = lKey;
                                        targetLineObj = lineObj;
                                        qPosObj = qp;
                                    }
                                });
                            }
                        });
                    }
                    
                    if(targetLineKey && targetLineObj && qPosObj) {
                        selectQuestLine(targetLineObj['lineID:3'], targetLineKey, targetLineObj);
                        
                        // Center canvas on quest
                        const canvasContainer = document.getElementById('canvasContainer');
                        const cw = canvasContainer.clientWidth;
                        const ch = canvasContainer.clientHeight;
                        translateX = (cw / 2) - (qPosObj['x:3'] * scale);
                        translateY = (ch / 2) - (qPosObj['y:3'] * scale);
                        updateTransform(); // global function in renderer
                        
                        // Select it
                        selectQuest(q);
                    } else {
                        alert("Квест не добавлен ни в одну ветку! (Скрытый)");
                        openProperties(q); // Still open properties
                    }
                    
                    questSearchResults.style.display = 'none';
                    questSearch.value = '';
                };
                
                questSearchResults.appendChild(sRow);
            }
        });
    }
}

questSearch.addEventListener('blur', () => { setTimeout(() => questSearchResults.style.display = 'none', 100); });
questSearch.addEventListener('focus', () => { if(questSearch.value) questSearchResults.style.display = 'flex'; });

document.getElementById('btnLogin').onclick = () => {
    const token = prompt("Введите GitHub Token:");
    if (token) {
        localStorage.setItem('gh_token', token);
        alert("Авторизован!");
    }
};
