const propertiesContent = document.getElementById('propertiesContent');
let currentQuestObj = null;

const mcColors = {
    '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
    '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
    '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
    'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF',
    'l': 'font-weight:bold;', 'm': 'text-decoration:line-through;',
    'n': 'text-decoration:underline;', 'o': 'font-style:italic;'
};

function formatMinecraftText(text) {
    if (!text) return '';
    let html = '';
    let spanCount = 0;
    
    // Split by section symbol
    const parts = text.split('§');
    html += parts[0]; // first part is unformatted
    
    for (let i = 1; i < parts.length; i++) {
        let code = parts[i].charAt(0).toLowerCase();
        let content = parts[i].substring(1);
        
        if (code === 'r') {
            // Reset all
            while(spanCount > 0) { html += '</span>'; spanCount--; }
        } else if (mcColors[code]) {
            if (code.match(/[lnmo]/)) {
                html += `<span style="${mcColors[code]}">`;
            } else {
                html += `<span style="color:${mcColors[code]}">`;
            }
            spanCount++;
        }
        html += content;
    }
    
    while(spanCount > 0) { html += '</span>'; spanCount--; }
    // Convert newlines to br
    return html.replace(/\n/g, '<br>');
}

function createPaletteWidget(targetInput) {
    const palette = document.createElement('div');
    palette.className = 'color-palette';
    
    const colors = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'l', 'm', 'n', 'o', 'r'];
    colors.forEach(c => {
        const btn = document.createElement('div');
        btn.className = 'color-btn';
        if (c === 'r') {
            btn.textContent = 'Reset';
        } else if (c.match(/[0-9a-f]/)) {
            btn.style.backgroundColor = mcColors[c];
        } else {
            btn.textContent = '§' + c;
        }
        
        btn.onclick = () => {
            const start = targetInput.selectionStart;
            const end = targetInput.selectionEnd;
            const text = targetInput.value;
            const insert = '§' + c;
            targetInput.value = text.substring(0, start) + insert + text.substring(end);
            targetInput.focus();
            targetInput.selectionStart = targetInput.selectionEnd = start + insert.length;
            // trigger change
            targetInput.dispatchEvent(new Event('change'));
        };
        palette.appendChild(btn);
    });
    return palette;
}

function renderUIEditor(qObj) {
    const container = document.createElement('div');
    container.className = 'quest-form';
    
    const props = qObj['properties:10']?.['betterquesting:10'];
    if(!props) return container;
    
    const nameStr = props['name:8'] || 'Unknown Quest';
    const descStr = props['desc:8'] || '';

    // Title Section
    const titleGroup = document.createElement('div');
    titleGroup.className = 'form-group';
    titleGroup.innerHTML = `<label>Имя квеста</label><div class="preview-box">${formatMinecraftText(nameStr)}</div>`;
    
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = nameStr;
    titleInput.onchange = (e) => {
        props['name:8'] = e.target.value;
        renderQuests(db['questLines:9'][currentLineId]);
        openProperties(qObj); // re-render panel
    };
    
    titleGroup.appendChild(titleInput);
    titleGroup.appendChild(createPaletteWidget(titleInput));

    // Description Section
    const descGroup = document.createElement('div');
    descGroup.className = 'form-group';
    descGroup.innerHTML = `<label>Описание</label><div class="preview-box">${formatMinecraftText(descStr)}</div>`;
    
    const descInput = document.createElement('textarea');
    descInput.rows = 5;
    descInput.value = descStr;
    descInput.onchange = (e) => {
        props['desc:8'] = e.target.value;
        openProperties(qObj);
    };
    
    descGroup.appendChild(descInput);
    descGroup.appendChild(createPaletteWidget(descInput));
    
    container.appendChild(titleGroup);
    container.appendChild(descGroup);
    
    // Icon Section
    const iconObj = props['icon:10'];
    if (iconObj) {
        const iconId = iconObj['id:8'] || '';
        const iconMeta = iconObj['Damage:2'] || 0;
        const iconGroup = document.createElement('div');
        iconGroup.className = 'form-group';
        iconGroup.innerHTML = `<label>Иконка (ID предмета)</label>`;
        
        const btnChangeIcon = document.createElement('button');
        btnChangeIcon.textContent = `Выбрать (Текущий: ${iconId}:${iconMeta})`;
        btnChangeIcon.onclick = () => {
            openItemPicker((selId, selMeta) => {
                iconObj['id:8'] = selId;
                iconObj['Damage:2'] = selMeta;
                renderQuests(db['questLines:9'][currentLineKey]);
                openProperties(qObj);
            });
        };
        iconGroup.appendChild(btnChangeIcon);
        container.appendChild(iconGroup);
    }
    
    // General Settings Section
    const genHeader = document.createElement('h4');
    genHeader.textContent = "Общие настройки";
    genHeader.style.marginTop = '15px';
    container.appendChild(genHeader);
    
    const genGroup = document.createElement('div');
    genGroup.className = 'form-group-grid';
    
    const createCheckbox = (label, key, parent = props) => {
        const div = document.createElement('label');
        div.className = 'checkbox-label';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = parent[key] === 1;
        cb.onchange = (e) => {
            parent[key] = e.target.value ? 1 : 0; // Wait, checkbox value is 'on'
            parent[key] = e.target.checked ? 1 : 0;
            openProperties(qObj);
        };
        div.appendChild(cb);
        div.append(" " + label);
        return div;
    };

    const createSelect = (label, key, options, parent = props) => {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `<label>${label}</label>`;
        const sel = document.createElement('select');
        options.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt;
            o.textContent = opt;
            if(parent[key] === opt) o.selected = true;
            sel.appendChild(o);
        });
        sel.onchange = (e) => {
            parent[key] = e.target.value;
            openProperties(qObj);
        };
        div.appendChild(sel);
        return div;
    };

    const createNumber = (label, key, parent = props) => {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `<label>${label}</label>`;
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.value = parent[key] || 0;
        inp.onchange = (e) => {
            parent[key] = parseInt(e.target.value) || 0;
            openProperties(qObj);
        };
        div.appendChild(inp);
        return div;
    };

    genGroup.appendChild(createCheckbox("Глобальный (isGlobal)", "isGlobal:1"));
    genGroup.appendChild(createCheckbox("Тихий (isSilent)", "isSilent:1"));
    genGroup.appendChild(createCheckbox("Авто-выдача (autoClaim)", "autoClaim:1"));
    
    const visOptions = ["HIDDEN", "UNLOCKED", "NORMAL", "COMPLETED", "CHAIN", "ALWAYS"];
    genGroup.appendChild(createSelect("Видимость", "visibility:8", visOptions));
    
    const logicOptions = ["AND", "NAND", "OR", "NOR", "XOR", "XNOR"];
    genGroup.appendChild(createSelect("Логика задач", "taskLogic:8", logicOptions));
    genGroup.appendChild(createSelect("Логика квеста", "questLogic:8", logicOptions));
    
    genGroup.appendChild(createNumber("Повтор (тики, -1 = нет)", "repeatTime:3"));
    genGroup.appendChild(createCheckbox("Относительный повтор", "repeat_relative:1"));

    container.appendChild(genGroup);
    
    
    // Prerequisites Section
    const preHeader = document.createElement('h4');
    preHeader.textContent = "Связи (Требования)";
    preHeader.style.marginTop = '15px';
    container.appendChild(preHeader);
    
    const preList = document.createElement('div');
    let pres = qObj['preRequisites:11'];
    if (pres && Array.isArray(pres)) {
        pres.forEach((preID, idx) => {
            const pDiv = document.createElement('div');
            pDiv.className = 'item-box-inner';
            
            // Look up quest name
            let qName = `Unknown Quest #${preID}`;
            const dbQuests = db['questDatabase:9'];
            if(dbQuests) {
                iterateBQArray(dbQuests, (q) => {
                    if(q['questID:3'] === preID) {
                        qName = (q['properties:10']?.['betterquesting:10']?.['name:8'] || qName).replace(/§./g, '');
                    }
                });
            }
            
            pDiv.innerHTML = `&bull; ID: ${preID} <small>(${qName})</small>`;
            
            const btnDel = document.createElement('button');
            btnDel.textContent = '❌';
            btnDel.style.marginLeft = 'auto';
            btnDel.onclick = () => {
                pres.splice(idx, 1);
                renderQuests(db['questLines:9'][currentLineKey]);
                openProperties(qObj);
            };
            
            pDiv.appendChild(btnDel);
            preList.appendChild(pDiv);
        });
    }
    
    const btnAddPre = document.createElement('button');
    btnAddPre.textContent = '+ Добавить связь';
    btnAddPre.style.marginTop = '5px';
    btnAddPre.onclick = () => {
        const reqStr = prompt("Введите Quest ID, который нужен для разблокировки этого квеста:");
        const reqInt = parseInt(reqStr);
        if(!isNaN(reqInt)) {
            if(!qObj['preRequisites:11']) qObj['preRequisites:11'] = [];
            if(!qObj['preRequisites:11'].includes(reqInt)) {
                qObj['preRequisites:11'].push(reqInt);
                openProperties(qObj);
            }
        }
    };
    const tasksHeader = document.createElement('h4');
    tasksHeader.textContent = "Задачи (Tasks)";
    tasksHeader.style.marginTop = '15px';
    container.appendChild(tasksHeader);
    
    if(!qObj['tasks:9']) qObj['tasks:9'] = {};
    const tasksObj = qObj['tasks:9'];
    
    iterateBQArray(tasksObj, (task, idx, tKey) => {
        const taskDiv = document.createElement('div');
        taskDiv.className = 'item-box';
        let taskType = task['taskID:8'];
        taskDiv.style.position = 'relative';
        taskDiv.innerHTML = `<strong>Тип:</strong> ${taskType} <button style="position:absolute; top:8px; right:8px; padding: 2px 5px; border-radius:4px; border:1px solid #555; background:#300; color:white;" onclick="delete currentQuestObj['tasks:9']['${tKey}']; renderQuests(db['questLines:9'][currentLineKey]); openProperties(currentQuestObj);">❌</button>`;
        
        // Retrieval / Crafting / Block Break task-wide properties
        if(taskType === 'bq_standard:retrieval' || taskType === 'bq_standard:crafting' || taskType === 'bq_standard:block_break') {
            const extraProps = document.createElement('div');
            extraProps.className = 'form-group-grid';
            extraProps.style.marginBottom = '10px';
            extraProps.innerHTML = `
                <label class="checkbox-label"><input type="checkbox" ${task['consume:1']?'checked':''} onchange="currentQuestObj['tasks:9']['${tKey}']['consume:1']=this.checked?1:0;"> Потреблять (Consume)</label>
                <label class="checkbox-label"><input type="checkbox" ${task['groupDetect:1']?'checked':''} onchange="currentQuestObj['tasks:9']['${tKey}']['groupDetect:1']=this.checked?1:0;"> Групп. поиск</label>
            `;
            taskDiv.appendChild(extraProps);
        }
        
        // Location / Meeting logic
        if(taskType === 'bq_standard:location' || taskType === 'bq_standard:meeting') {
            const field = taskType === 'bq_standard:location' ? 'name:8' : 'target:8';
            const label = taskType === 'bq_standard:location' ? 'Место' : 'Имя';
            const locDiv = document.createElement('div');
            locDiv.style.marginBottom = '10px';
            locDiv.innerHTML = `${label}: <input type="text" onchange="currentQuestObj['tasks:9']['${tKey}']['${field}'] = this.value;" style="width:140px;padding:4px;background:rgba(0,0,0,0.5);border:1px solid #555;color:white;" value="${task[field] || ''}"> `;
            locDiv.innerHTML += `Радиус: <input type="number" onchange="currentQuestObj['tasks:9']['${tKey}']['range:3'] = parseInt(this.value);" style="width:60px;padding:4px;background:rgba(0,0,0,0.5);border:1px solid #555;color:white;" value="${task['range:3'] || 10}">`;
            taskDiv.appendChild(locDiv);
        }

        const listKey = (taskType === 'bq_standard:block_break') ? 'blocks:9' : 'requiredItems:9';
        if (task[listKey]) {
            const reqList = document.createElement('div');
            iterateBQArray(task[listKey], (reqItem, idx, rKey) => {
                const iDiv = document.createElement('div');
                iDiv.className = 'item-box-inner';
                iDiv.style.flexDirection = 'column';
                iDiv.style.alignItems = 'stretch';
                
                const idField = (taskType === 'bq_standard:block_break') ? 'blockID:8' : 'id:8';
                const metaField = (taskType === 'bq_standard:block_break') ? 'meta:3' : 'Damage:2';
                const countField = (taskType === 'bq_standard:block_break') ? 'amount:3' : 'Count:3';
                
                const topRow = document.createElement('div');
                topRow.style.display = 'flex';
                topRow.style.alignItems = 'center';
                topRow.style.gap = '5px';
                topRow.innerHTML = `<span class="item-box-name" title="${reqItem[idField]}:${reqItem[metaField]||0}">${reqItem[idField]}:${reqItem[metaField]||0}</span> x <input type="number" style="width:45px;padding:2px;background:rgba(0,0,0,0.5);border:1px solid #555;color:white;" value="${reqItem[countField] || 1}">`;
                
                const btnEdit = document.createElement('button');
                btnEdit.textContent = '✎';
                btnEdit.onclick = () => { openItemPicker((sId, sMeta) => { reqItem[idField] = sId; reqItem[metaField] = sMeta; openProperties(qObj); }); };
                
                const btnDel = document.createElement('button');
                btnDel.textContent = '❌';
                btnDel.style.background = '#400';
                btnDel.onclick = () => { delete task[listKey][rKey]; openProperties(qObj); };
                
                topRow.appendChild(btnEdit);
                topRow.appendChild(btnDel);
                iDiv.appendChild(topRow);
                
                const optRow = document.createElement('div');
                optRow.style.display = 'flex';
                optRow.style.gap = '10px';
                optRow.style.marginTop = '4px';
                optRow.style.fontSize = '0.7rem';
                optRow.innerHTML = `
                    <label class="checkbox-label"><input type="checkbox" ${reqItem['ignoreNBT:1']?'checked':''} onchange="currentQuestObj['tasks:9']['${tKey}']['${listKey}']['${rKey}']['ignoreNBT:1']=this.checked?1:0;"> Игнор NBT</label>
                    <input type="text" placeholder="OreDict" style="width:70px;padding:2px;background:rgba(0,0,0,0.2);color:white;border:1px solid #444;" value="${reqItem['oreDict:8'] || ''}" onchange="currentQuestObj['tasks:9']['${tKey}']['${listKey}']['${rKey}']['oreDict:8']=this.value;">
                `;
                iDiv.appendChild(optRow);
                
                topRow.querySelector('input').onchange = (e) => { reqItem[countField] = parseInt(e.target.value) || 1; };
                
                reqList.appendChild(iDiv);
            });
            
            const btnAdd = document.createElement('button');
            btnAdd.textContent = '+ Добавить предмет';
            btnAdd.style.marginTop = '5px';
            btnAdd.onclick = () => {
                openItemPicker((sId, sMeta) => {
                    let nextObjId = 0;
                    while(task[listKey][`${nextObjId}:10`]) nextObjId++;
                    const entry = { "oreDict:8": "" };
                    if(taskType === 'bq_standard:block_break') {
                        entry["blockID:8"] = sId; entry["meta:3"] = sMeta; entry["amount:3"] = 1;
                    } else {
                        entry["id:8"] = sId; entry["Damage:2"] = sMeta; entry["Count:3"] = 1;
                    }
                    task[listKey][`${nextObjId}:10`] = entry;
                    openProperties(qObj);
                });
            };
            reqList.appendChild(btnAdd);
            taskDiv.appendChild(reqList);
        }
        container.appendChild(taskDiv);
    });
    
    // Add New Task Buttons
    const taskAddRow = document.createElement('div');
    taskAddRow.className = 'edit-actions';
    taskAddRow.innerHTML = `
        <button onclick="addTask('bq_standard:retrieval')">+ Найти (Item)</button>
        <button onclick="addTask('bq_standard:crafting')">+ Скрафтить (Craft)</button>
        <button onclick="addTask('bq_standard:block_break')">+ Сломать (Block)</button>
        <button onclick="addTask('bq_standard:checkbox')">+ Галка (Check)</button>
        <button onclick="addTask('bq_standard:location')">+ Точка (Loc)</button>
        <button onclick="addTask('bq_standard:meeting')">+ Встреча (NPC)</button>
    `;
    container.appendChild(taskAddRow);

    // Rewards Section
    const rewardsHeader = document.createElement('h4');
    rewardsHeader.textContent = "Награды (Rewards)";
    rewardsHeader.style.marginTop = '15px';
    container.appendChild(rewardsHeader);
    
    if(!qObj['rewards:9']) qObj['rewards:9'] = {};
    const rewObj = qObj['rewards:9'];
    
    iterateBQArray(rewObj, (rew, idx, reKey) => {
        const rewDiv = document.createElement('div');
        rewDiv.className = 'item-box';
        let rewType = rew['rewardID:8'];
        rewDiv.style.position = 'relative';
        rewDiv.innerHTML = `<strong>Тип:</strong> ${rewType} <button style="position:absolute; top:8px; right:8px; padding: 2px 5px; border-radius:4px; border:1px solid #555; background:#300; color:white;" onclick="delete currentQuestObj['rewards:9']['${reKey}']; renderQuests(db['questLines:9'][currentLineKey]); openProperties(currentQuestObj);">❌</button><br>`;
        
        // XP Editor
        if(rewType === 'bq_standard:xp') {
            rewDiv.innerHTML += `Количество (amount): <input type="number" onchange="currentQuestObj['rewards:9']['${reKey}']['amount:3'] = parseInt(this.value);" style="width:60px;padding:2px;background:rgba(0,0,0,0.5);border:1px solid #555;color:white;" value="${rew['amount:3'] || 1}"><br>`;
            rewDiv.innerHTML += `<label><input type="checkbox" ${rew['isLevels:1']?'checked':''} onchange="currentQuestObj['rewards:9']['${reKey}']['isLevels:1']=this.checked?1:0;"> Как Уровни (Levels)</label>`;
        }
        
        // Command Editor
        if(rewType === 'bq_standard:command') {
            rewDiv.innerHTML += `Команда: <input type="text" onchange="currentQuestObj['rewards:9']['${reKey}']['command:8'] = this.value;" style="width:100%;padding:4px;background:rgba(0,0,0,0.5);border:1px solid #555;color:white;" value="${rew['command:8'] || ''}"><br>`;
            rewDiv.innerHTML += `<label><input type="checkbox" ${rew['hideCommand:1']?'checked':''} onchange="currentQuestObj['rewards:9']['${reKey}']['hideCommand:1']=this.checked?1:0;"> Скрывать команду</label><br>`;
            rewDiv.innerHTML += `<label><input type="checkbox" ${rew['viaPlayer:1']?'checked':''} onchange="currentQuestObj['rewards:9']['${reKey}']['viaPlayer:1']=this.checked?1:0;"> От имени игрока</label>`;
        }
        
        // Items list
        if (rew['rewards:9']) {
            const rewList = document.createElement('div');
            iterateBQArray(rew['rewards:9'], (rItem, idx, rKey) => {
                const iDiv = document.createElement('div');
                iDiv.className = 'item-box-inner';
                iDiv.innerHTML = `<span class="item-box-name" title="${rItem['id:8']}:${rItem['Damage:2']||0}">${rItem['id:8']}:${rItem['Damage:2']||0}</span> x <input type="number" style="width:50px;padding:2px;background:rgba(0,0,0,0.5);border:1px solid #555;color:white;" value="${rItem['Count:3'] || 1}">`;
                
                const btnEdit = document.createElement('button');
                btnEdit.textContent = '✎';
                btnEdit.onclick = () => {
                    openItemPicker((sId, sMeta) => {
                        rItem['id:8'] = sId;
                        rItem['Damage:2'] = sMeta;
                        openProperties(qObj);
                    });
                };
                
                const btnDel = document.createElement('button');
                btnDel.textContent = '❌';
                btnDel.onclick = () => {
                    delete rew['rewards:9'][rKey];
                    openProperties(qObj);
                };
                
                iDiv.querySelector('input').onchange = (e) => {
                    rItem['Count:3'] = parseInt(e.target.value) || 1;
                };
                
                iDiv.appendChild(btnEdit);
                iDiv.appendChild(btnDel);
                rewList.appendChild(iDiv);
            });
            
            const btnAdd = document.createElement('button');
            btnAdd.textContent = '+ Добавить предмет';
            btnAdd.style.marginTop = '5px';
            btnAdd.onclick = () => {
                openItemPicker((sId, sMeta) => {
                    let nextObjId = 0;
                    while(rew['rewards:9'][`${nextObjId}:10`]) nextObjId++; // find highest
                    rew['rewards:9'][`${nextObjId}:10`] = {
                        "id:8": sId,
                        "Count:3": 1,
                        "Damage:2": sMeta,
                        "OreDict:8": ""
                    };
                    openProperties(qObj);
                });
            };
            rewList.appendChild(btnAdd);
            rewDiv.appendChild(rewList);
        }
        container.appendChild(rewDiv);
    });
    
    // Add New Reward Buttons
    const rewAddRow = document.createElement('div');
    rewAddRow.className = 'edit-actions';
    rewAddRow.innerHTML = `
        <button onclick="addReward('bq_standard:item')">+ Предметы</button>
        <button onclick="addReward('bq_standard:choice')">+ Выбор</button>
        <button onclick="addReward('bq_standard:xp')">+ XP (Опыт)</button>
        <button onclick="addReward('bq_standard:command')">+ Команда</button>
    `;
    container.appendChild(rewAddRow);
    
    return container;
}

// Helpers for adding components
window.addTask = function(type) {
    if(!currentQuestObj) return;
    let tObj = currentQuestObj['tasks:9'];
    let idx = 0;
    while(tObj[`${idx}:10`]) idx++;
    
    const block = { "index:3": idx, "taskID:8": type };
    if(type === 'bq_standard:retrieval' || type === 'bq_standard:crafting') {
        block['requiredItems:9'] = {};
        block['consume:1'] = 0;
    } else if(type === 'bq_standard:block_break') {
        block['blocks:9'] = {};
    } else if(type === 'bq_standard:location' || type === 'bq_standard:meeting') {
        block['range:3'] = 10;
        if(type === 'bq_standard:location') block['name:8'] = "New Location";
        else block['target:8'] = "Chicken";
    }
    tObj[`${idx}:10`] = block;
    openProperties(currentQuestObj);
};

window.addReward = function(type) {
    if(!currentQuestObj) return;
    let rObj = currentQuestObj['rewards:9'];
    let idx = 0;
    while(rObj[`${idx}:10`]) idx++;
    
    const block = { "index:3": idx, "rewardID:8": type };
    if(type === 'bq_standard:item' || type === 'bq_standard:choice') {
        block['rewards:9'] = {};
    } else if(type === 'bq_standard:xp') {
        block['amount:3'] = 1;
        block['isLevels:1'] = 0;
    } else if(type === 'bq_standard:command') {
        block['command:8'] = "/say hello";
        block['hideCommand:1'] = 1;
        block['viaPlayer:1'] = 1;
    }
    rObj[`${idx}:10`] = block;
    openProperties(currentQuestObj);
};

// ------ MODAL LOGIC ------
let pickerCallbackFn = null;

function openItemPicker(callback) {
    pickerCallbackFn = callback;
    document.getElementById('itemPickerModal').style.display = 'flex';
    document.getElementById('itemSearchQuery').value = '';
    renderPickerResults('');
}

let pickerSearchTimeout = null;
document.getElementById('itemSearchQuery')?.addEventListener('input', (e) => {
    if(pickerSearchTimeout) clearTimeout(pickerSearchTimeout);
    pickerSearchTimeout = setTimeout(() => {
        renderPickerResults(e.target.value.toLowerCase());
    }, 150);
});

function renderPickerResults(query) {
    const resultsDiv = document.getElementById('itemSearchResults');
    if(!resultsDiv) return;
    resultsDiv.innerHTML = '';
    
    if(typeof iconMap === 'undefined' || Object.keys(iconMap).length === 0) {
        resultsDiv.innerHTML = '<p>База не загружена! Нажмите Load itempanel.csv сверху экрана.</p>';
        return;
    }
    
    // Sort and filter async or simply take max 100 to avoid freezing
    let count = 0;
    for (let key in iconMap) {
        const dName = iconMap[key];
        if (dName.toLowerCase().includes(query) || key.toLowerCase().includes(query)) {
            if(count > 100) break; // Optimization
            count++;
            
            const row = document.createElement('div');
            row.className = 'search-item';
            
            const imgPath = `itempanel_icons/${dName.replace(/([?#:])/g, encodeURIComponent)}.png`;
            row.innerHTML = `<img src="${imgPath}" onerror="this.src=''"/> <div><strong>${dName}</strong><br><small style="color:var(--text-muted)">${key}</small></div>`;
            
            row.onclick = () => {
                const parts = key.split(':');
                if(parts.length >= 2) {
                    const meta = parseInt(parts.pop());
                    const id = parts.join(':');
                    pickerCallbackFn(id, meta);
                    document.getElementById('itemPickerModal').style.display = 'none';
                }
            };
            resultsDiv.appendChild(row);
        }
    }
}

function openLineProperties(lineObj) {
    currentQuestObj = null; // deselect quest
    propertiesContent.innerHTML = '';
    
    if(!lineObj) return;
    
    const container = document.createElement('div');
    container.className = 'quest-form';
    
    const props = lineObj['properties:10']?.['betterquesting:10'];
    if(!props) return;
    
    container.innerHTML = `<h3>Настройки ветки</h3>`;
    
    // Name
    const nameGroup = document.createElement('div');
    nameGroup.className = 'form-group';
    nameGroup.innerHTML = `<label>Название ветки</label>`;
    const nameInp = document.createElement('input');
    nameInp.type = 'text';
    nameInp.value = props['name:8'] || '';
    nameInp.onchange = (e) => {
        props['name:8'] = e.target.value;
        initSidebar(); // Refresh list names
    };
    nameGroup.appendChild(nameInp);
    nameGroup.appendChild(createPaletteWidget(nameInp));
    container.appendChild(nameGroup);
    
    // Desc
    const descGroup = document.createElement('div');
    descGroup.className = 'form-group';
    descGroup.innerHTML = `<label>Описание ветки</label>`;
    const descInp = document.createElement('textarea');
    descInp.rows = 4;
    descInp.value = props['desc:8'] || '';
    descInp.onchange = (e) => props['desc:8'] = e.target.value;
    descGroup.appendChild(descInp);
    container.appendChild(descGroup);
    
    // Background Image
    const bgGroup = document.createElement('div');
    bgGroup.className = 'form-group';
    bgGroup.innerHTML = `<label>Фоновое изображение (URL или путь)</label>`;
    const bgInp = document.createElement('input');
    bgInp.type = 'text';
    bgInp.value = props['bg_image:8'] || '';
    bgInp.onchange = (e) => {
        props['bg_image:8'] = e.target.value;
        updateBackground(e.target.value);
    };
    bgGroup.appendChild(bgInp);
    container.appendChild(bgGroup);
    
    const bgSizeGroup = document.createElement('div');
    bgSizeGroup.className = 'form-group';
    bgSizeGroup.innerHTML = `<label>Размер фона (default 256)</label>`;
    const bgSizeInp = document.createElement('input');
    bgSizeInp.type = 'number';
    bgSizeInp.value = props['bg_size:3'] || 256;
    bgSizeInp.onchange = (e) => props['bg_size:3'] = parseInt(e.target.value);
    bgSizeGroup.appendChild(bgSizeInp);
    container.appendChild(bgSizeGroup);

    propertiesContent.appendChild(container);
    
    // Update local preview
    updateBackground(props['bg_image:8']);
}

function updateBackground(url) {
    const editorArea = document.querySelector('.editor-area');
    if(url) {
        editorArea.style.backgroundImage = `url('${url}')`;
        editorArea.style.backgroundRepeat = 'repeat';
    } else {
        editorArea.style.backgroundImage = '';
    }
}

function openProperties(qObj) {
    currentQuestObj = qObj;
    propertiesContent.innerHTML = '';
    
    if(!qObj) {
        propertiesContent.innerHTML = '<p>Select a quest to edit</p>';
        return;
    }
    
    propertiesContent.appendChild(renderUIEditor(qObj));
    
    // Add raw NBT editor inside an expander
    const rawDetails = document.createElement('details');
    rawDetails.style.marginTop = '20px';
    rawDetails.innerHTML = '<summary>Raw JSON (Advanced)</summary>';
    
    const rawInput = document.createElement('textarea');
    rawInput.value = JSON.stringify(qObj, null, 2);
    rawInput.rows = 15;
    rawInput.style.marginTop = '10px';
    rawInput.style.fontSize = '0.8rem';
    rawInput.style.background = '#000';
    rawInput.onchange = (e) => {
        try {
            const parsed = JSON.parse(e.target.value);
            // Replace keys on current object
            Object.keys(qObj).forEach(k => delete qObj[k]);
            Object.assign(qObj, parsed);
            renderQuests(db['questLines:9'][currentLineKey]);
            openProperties(qObj);
        } catch(err) {
            alert('Invalid JSON');
        }
    };
    rawDetails.appendChild(rawInput);
    propertiesContent.appendChild(rawDetails);
}
