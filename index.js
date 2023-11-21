const server = require('http').createServer();
const io = require('socket.io')(server)
let currentMovie = "";
let connectedUsers = [];
let createdSessions = [];


io.on('connection', function (client) {

    console.log('client connect...', client.id);
    client.emit("session_update", JSON.stringify(createdSessions))

    client.on('get4kfilm', async function name(data) {

        get4KMovie(data, client);

    })

    client.on('user_create', function name(data) {

        let user = {
            "id": client.id,
            "username": data,
        }
        connectedUsers.push(user)
        client.emit('user_create', JSON.stringify(user))
    })

    client.on('user_change_username', function name(data) {

        let localUser;

        connectedUsers.forEach((item, index) => {

            if (item.id === client.id) {
                connectedUsers[index].username = data;
                localUser = item;
                return true;
            }

        });

        if (createdSessions.length !== 0) {
            createdSessions.forEach((session, i) => {
                session.connectedUsers.forEach((user, j) => {
                    if (user.id === client.id) {
                        createdSessions[i].connectedUsers[j].username = data;
                        return true;
                    }
                })
            })
        }

        localUser.username = data;

        io.emit('user_change_username', JSON.stringify(localUser))

    });

    client.on('session_connect', function name(data) {

        let dataPack = JSON.parse(data);

        let localUser = JSON.parse(dataPack[0]);
        let localSession = JSON.parse(dataPack[1]);

        if (localSession.sessionId !== "null") {
            createdSessions.forEach(value => {
                if (value.sessionId === localSession.sessionId) {
                    value.connectedUsers.push(localUser);
                    const dataSend = [
                        localUser,
                        value,
                    ];
                    io.emit('session_user_connect', JSON.stringify(dataSend))
                    return true
                }
            })
        }
    })

    client.on('session_sync_time', function name(data) {

        let dataPack = JSON.parse(data);

        let leaderPlayerMS = dataPack.data;
        let localSessionID = dataPack.sessionId;

        if (localSessionID !== "null") {
            const dataSend = [
                leaderPlayerMS,
                localSessionID,
            ];
            io.emit('session_sync_time', dataSend)
        }
    })

    client.on('session_action', function name(data) {

        let dataPack = JSON.parse(data);

        let localAction = dataPack.data;
        let localSessionID = dataPack.sessionId;

        if (localSessionID !== "null") {
            const dataSend = [
                localAction,
                localSessionID,
            ];
            io.emit('session_action', dataSend)
        }
    })

    client.on('session_duration_action', function name(data) {

        let dataPack = JSON.parse(data);

        let localDurationAction = dataPack.data;
        let localSessionID = dataPack.sessionId;

        if (localSessionID !== "null") {
            const dataSend = [
                localDurationAction,
                localSessionID,
            ];
            console.log(dataSend);
            io.emit('session_duration_action', dataSend)
        }
    })

    client.on('session_disconnect', function name(data) {

        let dataPack = JSON.parse(data);

        let localUser = JSON.parse(dataPack[0]);
        let localSession = JSON.parse(dataPack[1]);

        if (localSession.sessionId !== "null") {
            for (let i = 0; i < createdSessions.length; i++) {
                if (createdSessions[i].sessionId === localSession.sessionId) {
                    createdSessions[i].connectedUsers.forEach((item, index) => {
                        if (item.id === localUser.id) {

                            const dataSend = [
                                localUser,
                                createdSessions[i],
                            ];

                            createdSessions[i].connectedUsers.splice(index, 1);
                            if (createdSessions[i].connectedUsers.length === 0) {
                                createdSessions.splice(i, 1);
                            }

                            io.emit('session_user_disconnect', JSON.stringify(dataSend))
                        }
                    })

                    if (createdSessions.length !== 0) {

                        let oldOwner = "";


                        if (createdSessions[i].connectedUsers.length !== 0) {
                            if (localSession.ownerSessionID === localUser.id) {
                                oldOwner = localUser.id;
                                createdSessions[i].ownerSessionID = createdSessions[i].connectedUsers[0].id
                            }
                        }

                        const dataSend = [
                            oldOwner,
                            JSON.stringify(createdSessions[i]),
                        ];

                        io.emit("session_change_owner", dataSend)

                    }
                }
            }
        }

        io.emit("session_update", JSON.stringify(createdSessions))
    })

    client.on('session_set_movie', function name(data) {
        let localSession = JSON.parse(data);

        console.log(localSession.streamLink);

        createdSessions.forEach((item, i) => {
            if (item.sessionId === localSession.sessionId) {
                createdSessions[i].currentMovie = localSession.currentMovie;
                createdSessions[i].streamLink = localSession.streamLink;
                createdSessions[i].audioLink = localSession.audioLink;
                io.emit('session_set_movie', JSON.stringify(createdSessions[i]))
            }
        });
    })

    client.on('session_create', function name(data) {
        let dataPack = JSON.parse(data);
        let localUser = JSON.parse(dataPack[0]);
        let localSession = JSON.parse(dataPack[1]);

        let canCreateSession = true;

        if (createdSessions.length !== 0) {
            createdSessions.forEach((item) => {
                item.connectedUsers.forEach((user) => {
                    if (localUser.id === user.id) {
                        client.emit("error", '{"title": "session create failure", "body" : "you already have session"}')
                        console.log('{"title": "session create failure", "body" : "you already have session"}');
                        canCreateSession = false;
                        return true;
                    } else {
                        canCreateSession = true
                    }
                });
            });
        }

        if (canCreateSession && localSession.sessionId === "null") {
            localSession.sessionId = uuidv4();
            localSession.connectedUsers = [];
            localSession.connectedUsers.push(localUser);
            createdSessions.push(localSession);

            const dataSend = [
                localUser,
                localSession,
            ];

            io.emit("session_update", JSON.stringify(createdSessions))
            client.emit('session_user_connect', JSON.stringify(dataSend))
        } else {
            client.emit('error', '{"title": "session create failure", "body" : "you already have session"}')
        }
    });

    client.on('disconnect', function () {
        console.log('client disconnect...', client.id)
        io.emit('userLeft', client.id)

        let localUser;
        let localSession;

        for (let i = 0; i < createdSessions.length; i++) {
            createdSessions[i].connectedUsers.forEach((item, index) => {
                if (item.id === client.id) {
                    localSession = createdSessions[i]
                    localUser = item
                    createdSessions[i].connectedUsers.splice(index, 1);
                    if (createdSessions[i].connectedUsers.length === 0) {
                        createdSessions.splice(i, 1);
                    }
                }
            })
        }

        const dataSend = [
            localUser,
            localSession,
        ];

        io.emit('session_user_disconnect', JSON.stringify(dataSend))

        io.emit("session_update", JSON.stringify(createdSessions))

        connectedUsers.forEach(value => {
            if (value.id === client.id) {
                let index = connectedUsers.indexOf(value);
                if (index > -1) {
                    connectedUsers.splice(index, 1);
                    return true
                }
            }
        })

        if (client.size === 0) {
            currentMovie = "";
        }
        // handleDisconnect()
    })

    client.on('error', function (err) {
        console.log('received error from client:', client.id)
        console.log(err)
    })
})

function uuidv4() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}


var server_port = process.env.PORT || 3000;
server.listen(server_port, "192.168.3.19", function (err) {
    if (err) throw err
    console.log('Listening on port %d', server_port);
});

const playwright = require('playwright');
const BeautifulDom = require('beautiful-dom');

let blockList = [
    "code.moviead55.ru",
    "video.onetouch8.info",
    "track.onetouch8.info",
    "serving.laimroll.ru",
    "v.bazonserver.site",
    "app.bazon.site",
]

async function get4KMovie(data, client) {

    let dataPack = JSON.parse(data);

    let localSessionId = dataPack[0];
    let movieLink = dataPack[1];
    let movie = dataPack[2];

    console.log(data)

    if (localSessionId != null) {

        if (createdSessions.length !== 0) {

            let playerGet = false;

            const browser = await playwright.chromium.launch({
                channel: 'msedge',
            })
            const page = await browser.newPage()
            await page.setViewportSize({width: 1280, height: 800})

            await page.goto(movieLink, {
                waitUntil: 'domcontentloaded', // 4
            });

            client.emit("socket_data", "browser_created")

            await page.route("**/*", async (route) => {
                let hasAd = false
                blockList.forEach(value => {
                    if (route.request().url().includes(value)) {
                        hasAd = true;
                        return true;
                    }
                })

                if (hasAd) {
                    await route.abort()
                } else {
                    if (route.request().url().includes("index.m3u8")) {
                        let data = route.request();
                        const response = await fetch(data.url(), {
                            headers: data.headers()
                        });
                        if (response.ok) {
                            await browser.close();
                            client.emit("socket_data", "get_link_complete")

                            createdSessions.forEach((value, index) => {
                                if(value.sessionId === localSessionId) {
                                    createdSessions[index].streamLink = response.url;
                                    createdSessions[index].headers = JSON.stringify(data.headers());
                                    createdSessions[index].currentMovie = movie;
                                    io.emit('session_set_movie', JSON.stringify(createdSessions[index]))

                                }
                            });

                        } else {
                            console.log(data.url())
                            console.log(response.url)
                            console.log("ERROR");
                            console.log("get_link_failed");
                            client.emit("socket_data", "get_link_failed")
                        }
                    }

                    await route.continue()

                }

            });

            client.emit("socket_data", "login")
            await page.getByText('Войти', {exact: true}).click();
            await page.locator('input[id="login_name"]').fill('DenisBlurX');
            await page.locator('input[id="login_password"]').fill('Denis159357');
            await page.getByText('Войти на сайт').click();
            client.emit("socket_data", "login_complete")

            page.on('load', async () => {
                if (!playerGet) {
                    console.log("player_get_link");
                    await page.content().then(async value => {
                        const dom = new BeautifulDom(value);
                        let videoTabs = dom.querySelectorAll('iframe')
                        if (videoTabs.length !== 0) {
                            for (const value of videoTabs) {
                                let attr = value.getAttribute("src");
                                if (attr.includes("bazon.site")) {
                                    playerGet = true;
                                    await page.goto(attr);
                                    let pageSize = page.viewportSize();
                                    client.emit("socket_data", "player_set_2160q")
                                    await page.mouse.click(pageSize.width - 70, pageSize.height - 20, {
                                        delay: 100
                                    });
                                    await page.mouse.click(pageSize.width - 70, pageSize.height - 140, {
                                        delay: 1000
                                    });
                                    await page.mouse.click(pageSize.width - 70, pageSize.height - 180, {
                                        delay: 1000
                                    });
                                    return true;
                                }
                            }
                        }
                    });
                }
            });
        }

    }

}

//Писк на базовом сайте с фильмами
async function searchBaseMovie(data, client) {

    ///Инициализируем браузер
    const browser = await playwright.chromium.launch({
        headless: false,
        channel: 'msedge',
    })

    ///Создаем новую вкладку в браузере
    const page = await browser.newPage()
    await page.setViewportSize({width: 1280, height: 800})
    //Переход на страницу
    await page.goto("https://kinoka.ru/");


    //Находим все инпуты на сайте
    let input = await page.locator('input[id="story"]').all();
    if (input.length !== 0) {
        //Устанавливаем в них значение
        await input[0].fill(data);
        await input[1].fill(data);
        //Отправляем
        await page.keyboard.press("Enter")
        ///Ждем загрузку
        await page.on("load", async load => {
            //Отправка данных на клиент

            //Заканчиваем работу с браузером
            await browser.close();
        })
    }
}

//Получение ссылки на фильм из базовой библиотеки фильмов
async function getBaseMovie(data, client) {

    ///Инициализируем браузер
    const browser = await playwright.chromium.launch({
        headless: false,
        channel: 'msedge',
    })

    ///Создаем новую вкладку в браузере
    const page = await browser.newPage()
    await page.setViewportSize({width: 1280, height: 800})

    ///Смотрим запросы на сайте (ОБЯЗАТЕЛЬНО ДО GOTO)
    await page.on("request", async request => {
        ///Если находим главный файл (содержит качество фильмов)
        if (request.url().includes(".m3u8")) {
            ///отправляем запрос на по ссылки и получаем все "качества" фильма
            const response = await fetch(request.url());
            if (response.ok) {
                //Отправка данных на клиент

                console.log(await response.text())
                console.log(request.url())

                //Заканчиваем работу с браузером
                await browser.close();

            }
        }
    })

    //Переход на страницу
    await page.goto(data);

}

async function main(movieLink) {
    let playerLink = "";
    playerLink = "";
    const response = await fetch(movieLink);

    if (!response.ok) {
        throw new Error(`Error! status: ${response.status}`);
    } else {

        const result = await response.text();
        const dom = new BeautifulDom(result);
        let videoTabs = dom.getElementsByClassName('tabs-b');

        videoTabs.forEach(value => {
            let players = value.getElementsByTagName("iframe");
            if (players.length !== 0) {
                let attr = players[0].getAttribute("src");
                if (attr.includes("filippaaniketos")) {
                    playerLink = attr;
                    return true;
                }
            }
        });

        if (playerLink !== "") {
            const browser = await playwright.chromium.launch({
                channel: 'msedge',
            })
            const page = await browser.newPage()
            await page.setViewportSize({width: 1280, height: 800})
            page.on("request", async function name(request) {
                if (request.url().includes(".txt")) {
                    let data = await request.response();
                    const response = await fetch(await data.body());
                    if (response.ok) {
                        console.log(await response.text());
                    }
                }
            });

            await page.goto(playerLink, {
                waitUntil: 'domcontentloaded', // 4
            });
            console.log(`page goto`)
            await page.screenshot({path: 'example.png'});

        } else {
            console.log(`error...`)
        }


    }


    //await browser.close();
}

