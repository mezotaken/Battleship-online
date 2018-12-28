const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const uniqid = require('uniqid');
const app = express();
const public_path = path.join(__dirname,'../public');
const port  = process.env.PORT || 3000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const MongoClient = require('mongodb').MongoClient;
const url = "mongodb://localhost:27017/bs-service";


let gstor;//Колеллекция игр в базе данных


app.use(express.static(public_path));

MongoClient.connect(url,{ useNewUrlParser: true },function(err, client){

    let db = client.db("BSdb");
    gstor = db.collection("games");

    let w_player = false; //Есть ли ожидающий подбора игрок
    let w_gameid;   //ID игры, в которой игрок ожидает подбора
    let games = {}; //Проводящиеся в данный момент игры
    let users =  {}; //Находящиеся на сервере пользователи

    //Разослать всем пользователям сообщение text
    function casttousers(text)
    {
        Object.keys(users).forEach(function(key) {
            users[key].sckt.send(JSON.stringify([text]));
        });
    }


//При соединении нового пользователя с сервером
    wss.on('connection', function(client) {
        console.log('Player теперь онлайн');
        let userid = uniqid('user-');   //Присвоить уникальный ID
        users[userid] = {state:-1,sckt:client}; //Состояние -1: находится в меню
        gstor.find({}).toArray().then(function(res){
            users[userid].sckt.send(JSON.stringify(['allgames',res]));
        });
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
                        gstor.insertOne({date:getDateasStr(games[abgame].tstart),
                            time:getTimeasStr(games[abgame].tstart),
                            len:timeMin(games[abgame].tstart),
                            res:2});
                        gstor.find({}).toArray().then(function(res){
                            games[abgame].p2.send(JSON.stringify(['allgames',res]));
                        });
                    } else {
                        games[abgame].p1.send(JSON.stringify(['abandon']));
                        users[games[abgame].p1_id].state = -1;
                        gstor.insertOne({date:getDateasStr(games[abgame].tstart),
                            time:getTimeasStr(games[abgame].tstart),
                            len:timeMin(games[abgame].tstart),
                            res:1});
                        gstor.find({}).toArray().then(function(res){
                            games[abgame].p1.send(JSON.stringify(['allgames',res]));
                        });

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
                case 'playerready': { //Если какой-либо игрок готов
                    if (w_player)    //Если уже есть игра к которой можно подсоединиться
                    {
                        casttousers('gameisnotready');
                        games[w_gameid].p2 = client;
                        games[w_gameid].p2_id = userid;
                        w_player = false;
                        users[userid].state = w_gameid;
                        games[w_gameid].p1.send(JSON.stringify(['bothready']));    //Оповещение обоих
                        games[w_gameid].p2.send(JSON.stringify(['bothready']));    // о готовности
                        games[w_gameid].turn = -1;
                        games[w_gameid].p1alive = 20;
                        games[w_gameid].p2alive = 20;
                        games[w_gameid].tstart = new Date();
                        console.log("Игроки Player1 и Player2 готовы, расстановка кораблей.");

                    } else {    //Если это запуск новой игры
                        casttousers('gameisready');
                        w_gameid = uniqid('game-'); //Уникальный ID для игры
                        games[w_gameid] = {p1_id: userid, p1: client};
                        w_player = true;
                        users[userid].state = w_gameid;
                    }
                    break;
                }
                case 'playerconceded': { //Если игрок сдался
                    let concgame = users[userid].state;
                    if (games[concgame].p1 === client) {    //Оповещаем соперника о победе
                        games[concgame].p2.send(JSON.stringify(['conceded']));
                        gstor.insertOne({date:getDateasStr(games[concgame].tstart),
                            time:getTimeasStr(games[concgame].tstart),
                            len:timeMin(games[concgame].tstart),
                            res:2});
                    } else {
                        gstor.insertOne({date:getDateasStr(games[concgame].tstart),
                            time:getTimeasStr(games[concgame].tstart),
                            len:timeMin(games[concgame].tstart),
                            res:1});
                        games[concgame].p1.send(JSON.stringify(['conceded']));
                    }
                    console.log('Player сдался');
                    users[games[concgame].p1_id].state = -1;
                    users[games[concgame].p2_id].state = -1;
                    gstor.find({}).toArray().then(function(res){
                        games[concgame].p1.send(JSON.stringify(['allgames',res]));
                        games[concgame].p2.send(JSON.stringify(['allgames',res]));
                        delete games[concgame];
                    });
                    break;
                }
                case 'shipsset': {
                    let gameid = users[userid].state;
                    if (userid === games[gameid].p1_id)
                        games[gameid].p1fd = args[1];
                    else
                        games[gameid].p2fd = args[1];
                    games[gameid].turn++;
                    if (games[gameid].turn === 1) {
                        games[gameid].p1.send(JSON.stringify(['result',1,0,0]));
                        games[gameid].p2.send(JSON.stringify(['result',0,0,0]));
                    }
                }
                    break;
                case  'hit': {
                    let gameid = users[userid].state;
                    let i = args[1], j = args[2];
                    let t,mark;
                    if (games[gameid].turn === 1) {
                        t = games[gameid].p2fd;
                        if(t[i][j] === 0) {
                            games[gameid].turn = 2;
                            mark = 0;
                        }
                        else {
                            games[gameid].p2alive--;
                            t[i][j] = 2;
                            mark = isShipAlive(i,j, t);
                        }
                    } else {
                        t = games[gameid].p1fd;
                        if(t[i][j] === 0) {
                            games[gameid].turn = 1;
                            mark = 0;
                        }
                        else {
                            games[gameid].p1alive--;
                            t[i][j] = 2;
                            mark = isShipAlive(i,j, t);
                        }
                    }

                    games[gameid].p1.send(JSON.stringify(['result',mark,i,j]));
                    games[gameid].p2.send(JSON.stringify(['result',mark,i,j]));
                    if (games[gameid].p1alive === 0 || games[gameid].p2alive === 0) {
                        if(games[gameid].turn === 1) {
                            games[gameid].p1.send(JSON.stringify(['gameover', 1]));
                            games[gameid].p2.send(JSON.stringify(['gameover', 0]));
                        }
                        else {
                            games[gameid].p1.send(JSON.stringify(['gameover', 0]));
                            games[gameid].p2.send(JSON.stringify(['gameover', 1]));
                        }
                        gstor.insertOne({date:getDateasStr(games[gameid].tstart),
                            time:getTimeasStr(games[gameid].tstart),
                            len:timeMin(games[gameid].tstart),
                            res:games[gameid].turn});

                        console.log("Game Over! Won Player%d",games[gameid].turn);
                        users[games[gameid].p1_id].state = -1;
                        users[games[gameid].p2_id].state = -1;
                        gstor.find({}).toArray().then(function(res){
                            games[gameid].p1.send(JSON.stringify(['allgames',res]));
                            games[gameid].p2.send(JSON.stringify(['allgames',res]));
                            delete games[gameid];
                        });
                    }
                    break;
                }
            }
        });
    });

    server.listen(8080, function listening() {
        console.log('Listening on %d', server.address().port);
    });

    app.listen(port, ()=> {
        console.log('Server has been started on port %d',port);
    });
});





//Остались ли недобитые куски корабля
function isShipAlive(i_p,j_p, m)
{
    let s = [];
    let e = i_p;
    let res = 1;
    while(m[--e][j_p] >= 1) s.push(m[e][j_p]);
    e = i_p;
    while(m[++e][j_p] >= 1) s.push(m[e][j_p]);
    e = j_p;
    while(m[i_p][--e] >= 1) s.push(m[i_p][e]);
    e = j_p;
    while(m[i_p][++e] >= 1) s.push(m[i_p][e]);
    if(s.indexOf(1) === -1)
        res = 2;
    return res;
}

//Время в мин, сек прошедшее с момента old
function timeMin(old)
{
    let cur = new Date();
    let s = (cur-old)/1000;
    let m = Math.floor(s/60);
    s = Math.round(s-60*m);
    let aux = '';
    if (s < 10)
        aux = '0';
    return m.toString()+'м '+aux+s.toString()+'с';
}

function getDateasStr(fulldate) {
    return fulldate.getDate().toString()+'.'+(fulldate.getMonth()+1).toString()+'.'+fulldate.getFullYear().toString();
}
function getTimeasStr(fulldate) {
    return fulldate.getHours().toString()+':'+fulldate.getMinutes().toString();
}