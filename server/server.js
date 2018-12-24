const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const uniqid = require('uniqid');

const app = express();
const public_path = path.join(__dirname,'../public');
const port  = process.env.PORT || 3000;

app.use(express.static(public_path));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let w_player = false; //Есть ли ожидающий подбора игрок
let w_gameid;   //ID игры, в которой игрок ожидает подбора
let games = {}; //Проводящиеся в данный момент игры
let users = {}; //Находящиеся на сервере пользователи


//Разослать всем пользователям сообщение text
function casttousers(text)
{
    Object.keys(users).forEach(function(key) {
            users[key].sckt.send(JSON.stringify([text]));
    });
}

//При соединении нового пользователя с сервером
wss.on('connection', function(client) {
    console.log("check1");
    console.log('Player теперь онлайн');
    let userid = uniqid('user-');   //Присвоить уникальный ID
    users[userid] = {state:-1,sckt:client}; //Состояние -1: находится в меню
    //Проверить готова ли игра и сообщить новому пользователю
    if(w_player)
        users[userid].sckt.send(JSON.stringify(['gameisready']));
    else
        users[userid].sckt.send(JSON.stringify(['gameisnotready']));

    //При отсоединении пользователя
    client.on('close', function() {
        let abgame = users[userid].state;
        delete users[userid];
        if(abgame !== -1) { //Если отсоединившийся пользователь был в игре
            if (games[abgame].p1 !== undefined && games[abgame].p2 !== undefined) { //Проверить, успел ли он начать игру
                if (games[abgame].p1 === client) {                                  //Сообщить сопернику о победе
                    games[abgame].p2.send(JSON.stringify(['abandon']));
                    users[games[abgame].p2_id].state = -1;
                } else {
                    games[abgame].p1.send(JSON.stringify(['abandon']));
                    users[games[abgame].p1_id].state = -1;
                }
                console.log('Player покинул игру');
            } else {    //Если он ожидал соперника
                w_player = false;

                casttousers('gameisnotready');
            }
            delete games[abgame];   //Удалить прерванную игру
        }
    });

    client.on('message',function(message){
            const args = JSON.parse(message);
            switch(args[0]){
                case 'playerready': //Если какой-либо игрок готов
                    if(w_player)    //Если уже есть игра к которой можно подсоединиться
                    {

                        casttousers('gameisnotready');
                        games[w_gameid].p2 = client;
                        games[w_gameid].p2_id = userid;
                        w_player = false;
                        users[userid].state = w_gameid;
                        games[w_gameid].p1.send(JSON.stringify(['bothready',w_gameid]));    //Оповещение обоих
                        games[w_gameid].p2.send(JSON.stringify(['bothready',w_gameid]));    // о готовности

                        console.log("Игроки Player1 и Player2 готовы, расстановка кораблей.");

                    } else {    //Если это запуск новой игры
                        casttousers('gameisready');
                        w_gameid = uniqid('game-'); //Уникальный ID для игры
                        games[w_gameid] = {p1_id:userid,p1:client};
                        w_player = true;
                        users[userid].state = w_gameid;
                    }
                    break;
                case 'playerconceded':  //Если игрок сдался
                    let concgame = users[userid].state;
                    if (games[concgame].p1 === client) {    //Оповещаем соперника о победе
                        games[concgame].p2.send(JSON.stringify(['conceded']));
                    } else {
                        games[concgame].p1.send(JSON.stringify(['conceded']));
                    }
                    console.log('Player сдался');
                    users[games[concgame].p1_id].state = -1;
                    users[games[concgame].p2_id].state = -1;
                    delete games[concgame]; //Удаляем игру
                    break;
                case 'gameupdate':

                    break;
            }
    });
});



server.listen(8080, function listening() {
    console.log('Listening on %d', server.address().port);
});

app.listen(port, ()=> {
    console.log('Server has been started on port %d',port);
});