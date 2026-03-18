const canvasContainer = document.getElementById('canvasContainer');
const questCanvas = document.getElementById('questCanvas');
const svgConnections = document.getElementById('connectionsCanvas');
const iconCache = {};
const pendingIcons = {};

let isDraggingCanvas = false;
let startX, startY;

function getOptimizedIcon(displayName, imgUrl, callback) {
    // 1. Если иконка уже сжата и есть в кэше — отдаем мгновенно
    if (iconCache[displayName]) {
        callback(iconCache[displayName]);
        return;
    }
    // 2. Если иконка сейчас в процессе загрузки другим квестом — ждем
    if (pendingIcons[displayName]) {
        pendingIcons[displayName].push(callback);
        return;
    }
    
    pendingIcons[displayName] = [callback];
    
    const img = new Image();
    img.onload = () => {
        try {
            // Создаем скрытый холст для даунскейла (увеличили до 96x96 для больших квестов)
            const canvas = document.createElement('canvas');
            canvas.width = 96;
            canvas.height = 96;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 96, 96);
            
            // Получаем супер-легкую base64 строку вместо тяжелого файла
            const dataUrl = canvas.toDataURL('image/png');
            iconCache[displayName] = dataUrl;
            
            // Раздаем готовую иконку всем квестам, которые её ждали
            pendingIcons[displayName].forEach(cb => cb(dataUrl));
        } catch (e) {
            // Фолбэк на оригинальный URL, если возникнут ошибки CORS
            iconCache[displayName] = imgUrl; 
            pendingIcons[displayName].forEach(cb => cb(imgUrl));
        }
        delete pendingIcons[displayName];
    };
    img.onerror = () => {
        iconCache[displayName] = 'error';
        pendingIcons[displayName].forEach(cb => cb('error'));
        delete pendingIcons[displayName];
    };
    img.src = imgUrl;
}

canvasContainer.addEventListener('mousedown', (e) => {
    if (e.target === canvasContainer || e.target === svgConnections || e.target === questCanvas) {
        isDraggingCanvas = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        canvasContainer.style.cursor = 'grabbing';
    }
});

window.addEventListener('mouseup', () => {
    isDraggingCanvas = false;
    canvasContainer.style.cursor = 'grab';
});

window.addEventListener('mousemove', (e) => {
    if (isDraggingCanvas) {
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        updateTransform();
    }
});

canvasContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomIntensity = 0.1;
    if (e.deltaY < 0) scale *= (1 + zoomIntensity);
    else scale /= (1 + zoomIntensity);
    
    scale = Math.min(Math.max(0.1, scale), 5); // Limit scale
    updateTransform();
});

function updateTransform() {
    // 1. Сдвигаем сам холст
    questCanvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    svgConnections.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;

    // 2. Оптимизация: скрываем квесты, которые не видно на экране (Culling)
    if (!canvasContainer) return;
    
    const cw = canvasContainer.clientWidth;
    const ch = canvasContainer.clientHeight;
    
    // Вычисляем границы видимой области экрана с небольшим запасом (margin)
    const margin = 150; // запас в пикселях, чтобы квесты не появлялись резко
    const viewMinX = (-translateX / scale) - margin;
    const viewMaxX = ((cw - translateX) / scale) + margin;
    const viewMinY = (-translateY / scale) - margin;
    const viewMaxY = ((ch - translateY) / scale) + margin;

    // Пробегаемся по всем отрисованным квестам
    const nodes = questCanvas.children;
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const x = Number(node.dataset.posx);
        const y = Number(node.dataset.posy);
        
        // Если квест внутри видимой зоны — показываем, если нет — полностью скрываем из рендера
        if (x >= viewMinX && x <= viewMaxX && y >= viewMinY && y <= viewMaxY) {
            if (node.style.display === 'none') node.style.display = '';
        } else {
            if (node.style.display !== 'none') node.style.display = 'none';
        }
    }
}

// Rendering Logic
let currentQuests = [];

function renderQuests(lineObj) {
    questCanvas.innerHTML = '';
    svgConnections.innerHTML = '';
    currentQuests = [];
    
    const dbQuests = db['questDatabase:9'];
    if(!dbQuests) return;
    
    const lineQuests = lineObj['quests:9'];
    if(!lineQuests) return;
    
    // Convert to easy access array
    let lqArr = [];
    iterateBQArray(lineQuests, (qPos, idx) => {
        lqArr.push(qPos);
    });

    // Draw Lines for Pre-requirements
    lqArr.forEach(qPos => {
        let qID = qPos['id:3'];
        let fullQuestObj = (typeof questMap !== 'undefined') ? questMap[qID] : null;

        if(!fullQuestObj) return;

        let pres = fullQuestObj['preRequisites:11'];
        if(pres && Array.isArray(pres)) {
            pres.forEach(preID => {
                let prePos = lqArr.find(p => p['id:3'] === preID);
                if(prePos) {
                    // Передаем целиком объекты позиций
                    drawLine(prePos, qPos);
                }
            });
        }
        
        drawQuestNode(qPos, fullQuestObj);
    });
}

function drawLine(pos1, pos2) {
    // 1. Читаем размеры первого квеста (родителя). Если размеров нет, берем 24
    const sizeX1 = pos1['sizeX:3'] !== undefined ? pos1['sizeX:3'] : 24;
    const sizeY1 = pos1['sizeY:3'] !== undefined ? pos1['sizeY:3'] : 24;
    
    // 2. Читаем размеры второго квеста (ребенка)
    const sizeX2 = pos2['sizeX:3'] !== undefined ? pos2['sizeX:3'] : 24;
    const sizeY2 = pos2['sizeY:3'] !== undefined ? pos2['sizeY:3'] : 24;

    // 3. Вычисляем истинные центры (координата левого верхнего угла + половина ширины/высоты)
    const centerX1 = pos1['x:3'] + (sizeX1 / 2);
    const centerY1 = pos1['y:3'] + (sizeY1 / 2);
    const centerX2 = pos2['x:3'] + (sizeX2 / 2);
    const centerY2 = pos2['y:3'] + (sizeY2 / 2);

    // 4. Рисуем линию точно из центра в центр
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', centerX1);
    line.setAttribute('y1', centerY1);
    line.setAttribute('x2', centerX2);
    line.setAttribute('y2', centerY2);
    line.setAttribute('stroke', '#ccc');
    line.setAttribute('stroke-width', 2);
    svgConnections.appendChild(line);
}

function drawQuestNode(pos, questObj) {
    const qID = questObj['questID:3'];
    const node = document.createElement('div');
    node.className = 'quest-node';
    node.dataset.qid = qID;
    if (currentQuestObj && currentQuestObj['questID:3'] === qID) node.classList.add('selected');
    
    // Читаем размеры из базы (по умолчанию 24)
    const sizeX = pos['sizeX:3'] !== undefined ? pos['sizeX:3'] : 24;
    const sizeY = pos['sizeY:3'] !== undefined ? pos['sizeY:3'] : 24;
    
    // --- ПРИМЕНЯЕМ КООРДИНАТЫ И РАЗМЕРЫ К САМОЙ МОДЕЛЬКЕ ---
    node.style.left = pos['x:3'] + 'px';
    node.style.top = pos['y:3'] + 'px';
    node.style.width = sizeX + 'px';
    node.style.height = sizeY + 'px';
    
    // Сохраняем координаты для оптимизации скрытия
    node.dataset.posx = pos['x:3'];
    node.dataset.posy = pos['y:3'];
    
    
    const props = questObj['properties:10']?.['betterquesting:10'];
    const nameStr = props?.['name:8'] || 'Unknown Quest';
    const cleanName = nameStr.replace(/§./g, '');
    
    // Логика зависимостей...
    let depsHTML = "";
    const preReqs = questObj['preRequisites:11'];
    if(preReqs && preReqs.length > 0) {
        depsHTML = "<div class='tooltip-deps'><b>Зависит от:</b><ul>";
        preReqs.forEach(id => {
            const depQ = (typeof questMap !== 'undefined') ? questMap[id] : null;
            const depName = (depQ?.['properties:10']?.['betterquesting:10']?.['name:8'] || `ID ${id}`).replace(/§./g, '');
            depsHTML += `<li>${depName}</li>`;
        });
        depsHTML += "</ul></div>";
    }

    // --- 2. ПРИМЕНЯЕМ РАЗМЕРЫ SIZEX И SIZEY К ИКОНКЕ ---
    // --- ИКОНКА ТЕПЕРЬ ЗАНИМАЕТ 100% ОТ РОДИТЕЛЬСКОЙ НОДЫ ---
    let iconHTML = `<div class="quest-icon target-icon-${qID}" style="width: 100%; height: 100%; background: rgba(255,255,255,0.05); border-radius: 4px;"></div>`;
    let tooltipIconHTML = `<img class="target-tooltip-${qID}" src="" style="width:16px; height:16px; margin-right:5px; vertical-align:middle; display:none;">`;
    
    let displayNameToLoad = null;
    let imgUrlToLoad = null;
    
    const iconBase = props?.['icon:10'];
    if (iconBase) {
        const id = getBQValue(iconBase, 'id');
        const damage = getBQValue(iconBase, 'Damage') || 0;
        const displayName = (typeof iconMap !== 'undefined') ? iconMap[`${id}:${damage}`] : null;
        
        if (displayName) {
            displayNameToLoad = displayName;
            const safeName = displayName.replace(/([?#:])/g, encodeURIComponent);
            imgUrlToLoad = `icons/${safeName}.png`; // Указываем на твою новую папку icons
            iconHTML = `<div class="quest-icon target-icon-${qID}" style="width: 100%; height: 100%; background: rgba(255,255,255,0.05); border-radius: 4px;" title="${id}:${damage}"></div>`;
        } else if (id) {
            // И здесь 100%
            iconHTML = `<div class="quest-icon" style="width: 100%; height: 100%; background: rgba(255,100,0,0.2); border-radius: 4px;" title="Icon missing: ${id}:${damage}">?</div>`;
        }
    }
    
    node.innerHTML = `
        ${iconHTML}
        <span>
            <div class='tooltip-header'>${tooltipIconHTML} <b>${cleanName}</b></div>
            <div class='tooltip-id'>ID: ${qID}</div>
            ${depsHTML}
        </span>
    `;
    
    node.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        selectQuest(questObj);
        node.classList.add('selected');
        
        let startNx = e.clientX;
        let startNy = e.clientY;
        let pX = pos['x:3'];
        let pY = pos['y:3'];
        
        const moveNode = (me) => {
            const dx = (me.clientX - startNx) / scale;
            const dy = (me.clientY - startNy) / scale;
            pos['x:3'] = Math.round(pX + dx);
            pos['y:3'] = Math.round(pY + dy);
            node.style.left = pos['x:3'] + 'px';
            node.style.top = pos['y:3'] + 'px';
        };
        const endMove = () => {
            window.removeEventListener('mousemove', moveNode);
            window.removeEventListener('mouseup', endMove);
            if(currentLineKey !== null) {
                renderQuests(db['questLines:9'][currentLineKey]); 
            }
        };
        
        window.addEventListener('mousemove', moveNode);
        window.addEventListener('mouseup', endMove);
    });
    
    // Сначала добавляем пустой квест на холст, чтобы не блокировать интерфейс
    questCanvas.appendChild(node);

    // Только теперь асинхронно применяем иконку
    if (displayNameToLoad && imgUrlToLoad) {
        getOptimizedIcon(displayNameToLoad, imgUrlToLoad, (optimizedBase64) => {
            if (optimizedBase64 !== 'error') {
                const iconEl = node.querySelector(`.target-icon-${qID}`);
                const tooltipEl = node.querySelector(`.target-tooltip-${qID}`);
                
                if (iconEl) {
                    iconEl.style.background = `url('${optimizedBase64}') center/cover no-repeat`;
                }
                if (tooltipEl) {
                    tooltipEl.src = optimizedBase64;
                    tooltipEl.style.display = 'inline-block';
                }
            } else {
                 const iconEl = node.querySelector(`.target-icon-${qID}`);
                 if(iconEl) {
                     iconEl.innerHTML = "?";
                     iconEl.style.background = "rgba(255,100,0,0.2)";
                 }
            }
        });
    }
}

function selectQuest(qObj) {
    if(typeof linkMode !== 'undefined' && linkMode) {
        let qID = qObj['questID:3'];
        if(parentQuestID === null) {
            parentQuestID = qID;
            document.querySelectorAll('.quest-node').forEach(n => {
                if(n.dataset.qid == qID) n.classList.add('parent-selection');
            });
        } else {
            let childID = qID;
            if(childID !== parentQuestID) {
                let childQ = questMap[childID];
                if(!childQ['preRequisites:11']) childQ['preRequisites:11'] = [];
                // Check if already exists
                if(!childQ['preRequisites:11'].includes(parentQuestID)) {
                    childQ['preRequisites:11'].push(parentQuestID);
                }
            }
            parentQuestID = null;
            document.querySelectorAll('.quest-node').forEach(n => n.classList.remove('parent-selection'));
            renderQuests(db['questLines:9'][currentLineKey]);
        }
        return;
    }
    document.querySelectorAll('.quest-node').forEach(n => n.classList.remove('selected'));
    openProperties(qObj);
}
