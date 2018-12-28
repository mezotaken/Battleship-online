const statuses = ["Меню","Ожидание второго игрока","Расставьте корабли","Второй игрок расставляет корабли",
    "Ваш ход","Ход соперника"];
let socket = new WebSocket('ws://localhost:8080');
let gamestate = -1;
let almap = Array(12);
let enmap = Array(12);
for(let i = 0;i<12;i++)
{
    almap[i] = Array(12).fill(0);
    enmap[i] = Array(12).fill(0);
}

socket.onopen = function() {
    stat.innerHTML = statuses[0];
};

socket.onclose = function() {
    alert("Соединение с сервером потеряно.");
};

socket.onmessage = function(message) {
    let args = JSON.parse(message.data);
    switch(args[0]){
        case 'bothready':
            stat.innerHTML = statuses[2];
            gamestate = 0;
            break;
        case 'result':
            if(args[2] !== 0)
            {
                let i = args[2], j = args[3];
                if(args[1] >= 1 &&  gamestate === 3) {
                    stat.innerHTML = statuses[4];
                    gamestate = 1;
                    EnemyMap.rows[i].cells[j].style.background = '#fe0101';
                    EnemyMap.rows[i].cells[j].innerText = 'X';
                    enmap[i][j] = 2;
                    //Если убит - окружить обстрелянной зоной
                    if(args[1] === 2)
                    {
                        let iedge = i,jedge = j;
                        while(enmap[--iedge][jedge] === 2);
                        while(enmap[iedge+1][jedge] === 2){
                            enmap[iedge][jedge] = 1;
                            if(iedge>0 && jedge>0 && iedge<11 && jedge<11)
                                EnemyMap.rows[iedge].cells[jedge].innerText = 'o';
                            jedge++;
                        }
                        enmap[iedge][jedge] = 1;
                        if(iedge>0 && jedge>0 && iedge<11 && jedge<11)
                            EnemyMap.rows[iedge].cells[jedge].innerText = 'o';
                        iedge++;
                        while(enmap[iedge][jedge-1] === 2){
                            enmap[iedge][jedge] = 1;
                            if(iedge>0 && jedge>0 && iedge<11 && jedge<11)
                                EnemyMap.rows[iedge].cells[jedge].innerText = 'o';
                            iedge++;
                        }
                        enmap[iedge][jedge] = 1;
                        if(iedge>0 && jedge>0 && iedge<11 && jedge<11)
                            EnemyMap.rows[iedge].cells[jedge].innerText = 'o';
                        jedge--;
                        while(enmap[iedge-1][jedge] === 2){
                            enmap[iedge][jedge] = 1;
                            if(iedge>0 && jedge>0 && iedge<11 && jedge<11)
                                EnemyMap.rows[iedge].cells[jedge].innerText = 'o';
                            jedge--;
                        }
                        enmap[iedge][jedge] = 1;
                        if(iedge>0 && jedge>0 && iedge<11 && jedge<11)
                            EnemyMap.rows[iedge].cells[jedge].innerText = 'o';
                        iedge--;
                        while(enmap[iedge][jedge+1] === 2){
                            enmap[iedge][jedge] = 1;
                            if(iedge>0 && jedge>0 && iedge<11 && jedge<11)
                                EnemyMap.rows[iedge].cells[jedge].innerText = 'o';
                            iedge--;
                        }
                        enmap[iedge][jedge] = 1;
                        if(iedge>0 && jedge>0 && iedge<11 && jedge<11)
                            EnemyMap.rows[iedge].cells[jedge].innerText = 'o';
                        jedge++;
                        while(jedge!==j) {
                            enmap[iedge][jedge] = 1;
                            if(iedge>0 && jedge>0 && iedge<11 && jedge<11)
                                EnemyMap.rows[iedge].cells[jedge].innerText = 'o';
                            jedge++;
                        }
                    }
                } else if(args[1] >= 1 &&  gamestate === 2) {
                    stat.innerHTML = statuses[5];
                    AllyMap.rows[i].cells[j].innerText = 'X';
                } else if(args[1] === 0 &&  gamestate === 3) {
                    stat.innerHTML = statuses[5];
                    EnemyMap.rows[i].cells[j].innerText = 'o';
                    enmap[i][j] = 1;
                    gamestate = 2;
                } else if(args[1] === 0 &&  gamestate === 2) {
                    stat.innerHTML = statuses[4];
                    AllyMap.rows[i].cells[j].innerText = 'o';
                    gamestate = 1;
                }
            } else {
                if(args[1] === 1) {
                    gamestate = 1;
                    stat.innerHTML = statuses[4];
                }
                else {
                    gamestate = 2;
                    stat.innerHTML = statuses[5];
                }
            }
            break;
        case 'gameover':
        {
            if(args[1] === 1)
                alert("Вы победили!");
            else
                alert("Вы проиграли!");
            hidgameelements();
            break;
        }
        case 'abandon':
            alert("Другой игрок покинул игру! Вы победили!");
            hidgameelements();
            break;
        case 'conceded':
            alert("Другой игрок сдался! Вы победили!");
            hidgameelements();
            break;
        case 'gameisready':
            ready.innerHTML = "Присоединиться к игре";
            break;
        case 'gameisnotready':
            ready.innerHTML = "Начать игру";
            break;
        case 'allgames': {
            cleartable(allgames);
            let s = args[1].length;
            let row = allgames.insertRow(0);
            row.insertCell(0).innerHTML = 'Дата';
            row.insertCell(1).innerHTML = 'Время';
            row.insertCell(2).innerHTML = 'Длительность'
            row.insertCell(3).innerHTML = 'Победитель';
            for(let i =1;i<s+1;i++) {
                row = allgames.insertRow(i);
                row.insertCell(0).innerHTML = args[1][s-i]['date'];
                row.insertCell(1).innerHTML = args[1][s-i]['time'];
                row.insertCell(2).innerHTML = args[1][s-i]['len'];
                row.insertCell(3).innerHTML = 'Игрок' + args[1][s-i]['res'];
            }
            break;
        }
    }
};

ready.onclick = function(){
    console.log(Date());
    stat.innerHTML = statuses[1];
    showgameelements();
    socket.send(JSON.stringify(['playerready']));

};

concede.onclick = function(){
    socket.send(JSON.stringify(['playerconceded']));
    hidgameelements();
};

acceptpos.onclick = function(){
    if(checkpos(almap)) {
        stat.innerHTML = statuses[3];
        acceptpos.style.display = "none";
        socket.send(JSON.stringify(['shipsset',almap]));
    }
    else
        alert("Корабли расставлены некорректно!");
};

//Валидация игрового поля
function checkpos(matr) {
    let result = true;
    for(let i = 1; i < 11; i++)
        for(let j = 1;j<11;j++)
            if(almap[i][j] === 1){
                if(almap[i-1][j-1] === 1 || almap[i+1][j-1] === 1 || almap[i-1][j+1]=== 1 || almap[i+1][j+1]=== 1)
                    result = false;
            }
    let ships = [4,3,2,1];

    for(let i = 1; i < 11; i++)
        for(let j = 1;j<11;j++)
            if (almap[i][j] === 1 && almap[i+1][j]!== 1 && almap[i-1][j]!== 1) {
                let len = 0;
                while (almap[i][++j] === 1)
                    len++;
                if(len<4)
                    ships[len]--;
            }
    for(let i = 1; i < 11; i++)
        for(let j = 1;j<11;j++)
            if (almap[j][i] === 1 && almap[j][i+1]!== 1 && almap[j][i-1]!== 1) {
                let len = 0;
                while (almap[++j][i] === 1)
                    len++;
                if(len<4 && len > 0)
                    ships[len]--;
            }

    if(ships[0] !== 0 || ships[1] !== 0 || ships[2] !== 0 || ships[3] !== 0)
        result = false;
    return result;
}
//Создать игровое поле
function createtable(itemid) {
    const letters = 'АБВГДЕЖЗИК';
    let row = itemid.insertRow(0);
    let cell = row.insertCell(0);
    for(let i = 1;i<11;i++) {
        cell = row.insertCell(i);
        cell.innerText = letters[i-1];
    }
    for(let i = 1;i<11;i++) {
        row = itemid.insertRow(i);
        let cell = row.insertCell(0);
        cell.innerText = i;
        for(let j = 1;j<11;j++) {
            cell = row.insertCell(j);
            cell.addEventListener('click',function(){ cellHandler(this)},true);
        }
    }
    itemid.style.visibility = "visible";

}
//Очистить игровое поле
function cleartable(itemid) {
    for(let i = itemid.rows.length-1; i >= 0; i--)
        itemid.deleteRow(i);
}
//Скрыть элементы игры
function hidgameelements() {
    stat.innerHTML = statuses[0];
    cleartable(AllyMap);
    cleartable(EnemyMap);
    ready.style.display = "initial";
    concede.style.display = "none";
    acceptpos.style.display = "none";
    AllyMap.style.visibility = "hidden";
    EnemyMap.style.visibility = "hidden";
    authfd.style.display = "initial";
    lastgames.style.visibility = "visible";
    gamestate=-1;
}
//Показать элементы игры
function showgameelements() {
    clearmatr(almap);
    createtable(AllyMap);
    createtable(EnemyMap);
    concede.style.display = "initial";
    acceptpos.style.display = "initial";
    ready.style.display = "none";
    authfd.style.display = "none";
    lastgames.style.visibility = "hidden";
}
//обработка клика на клетку
function cellHandler(cdcell) {
    tabid = cdcell.parentElement.parentElement.parentElement.id;
    let i = cdcell.parentElement.rowIndex;
    let j = cdcell.cellIndex;
    if(gamestate === 0 && tabid === 'AllyMap') {
        if(almap[i][j] === 0) {
            cdcell.style.background = '#32CD32';
            almap[i][j] = 1;
        } else {
            cdcell.style.background = '#ffffff';
            almap[i][j] = 0;
        }
    }
    if(gamestate === 1 && tabid === 'EnemyMap' && enmap[i][j] === 0) {
        gamestate = 3;
        socket.send(JSON.stringify(['hit',i,j]));
    }
}
//Очистить матрицу
function clearmatr(matr)
{
    for(let i = 0; i < matr.length; i++)
        matr[i].fill(0);
}
