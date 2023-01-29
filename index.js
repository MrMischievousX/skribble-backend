const http = require("http");
const { stringify } = require("querystring");
const webSocketServer = require("websocket").server;
const httpServer = http.createServer();

const clients = {};
const games = {};
let idx = 0;
const keyWords = [
  "Blueberry",
  "Breakfast",
  "Bubblegum",
  "Cellphone",
  "Dandelion",
  "Hairbrush",
  "Hamburger",
  "Horsewhip",
  "Jellyfish",
  "Landscape",
  "Nightmare",
  "Pensioner",
  "Rectangle",
  "Snowboard",
  "Spaceship",
  "Spongebob",
  "Swordfish",
  "Telephone",
  "Telescope",
];
let answer = "";

httpServer.listen(process.env.PORT || 5000, () => {
  console.log(`Listening to ${process.env.PORT || 5000}`);
});

const wsServer = new webSocketServer({
  httpServer: httpServer,
});

function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  );
}

function randomNum(max) {
  var n = [];
  for (var i = 0; i < 3; i++) {
    n.push(Math.floor(Math.random() * keyWords.length) + 0);
  }
  return n;
}

wsServer.on("request", (request) => {
  const connection = request.accept(null, request.origin);

  connection.on("open", () => {
    console.log("Opened");
  });

  connection.on("close", () => {
    console.log("closed");
  });

  connection.on("message", (message) => {
    const result = JSON.parse(message.utf8Data);

    if (result.method == "create") {
      const clientId = result.clientId;
      const gameId = result.name;
      games[gameId] = {
        id: gameId,
        clients: [],
      };

      const payLoad = {
        method: "create",
        game: games[gameId],
        id: gameId,
      };

      const con = clients[clientId].connection;
      con.send(JSON.stringify(payLoad));
    }

    if (result.method == "join") {
      const clientId = result.clientId;
      const gameId = result.gameId;
      const game = games[gameId];
      const len = game.clients.length;
      if (len >= 10) return;
      game.clients.push({
        clientId: clientId,
        name: result.name,
        score: 0,
        canType: true,
      });
      const payLoad = {
        method: "join",
        game: game,
        id: gameId,
      };
      game.clients.forEach((c) => {
        clients[c.clientId].connection.send(JSON.stringify(payLoad));
      });
    }

    if (result.method == "update") {
      const color = result.color;
      const offset = result.offset;
      const clientId = result.clientId;
      const gameId = result.gameId;
      const game = games[gameId];

      const payLoad = {
        color: color,
        offset: offset,
        method: "update",
      };

      game.clients.forEach((c) => {
        if (c.clientId != clientId)
          clients[c.clientId].connection.send(JSON.stringify(payLoad));
      });
    }

    if (result.method == "startPoint") {
      const offset = result.offset;
      const clientId = result.clientId;
      const gameId = result.gameId;
      const game = games[gameId];

      const payLoad = {
        offset: offset,
        method: "startPoint",
      };

      game.clients.forEach((c) => {
        if (c.clientId != clientId)
          clients[c.clientId].connection.send(JSON.stringify(payLoad));
      });
    }

    if (result.method == "closePoint") {
      const clientId = result.clientId;
      const gameId = result.gameId;
      const game = games[gameId];

      const payLoad = {
        method: "closePoint",
      };

      game.clients.forEach((c) => {
        if (c.clientId != clientId)
          clients[c.clientId].connection.send(JSON.stringify(payLoad));
      });
    }

    if (result.method == "start") {
      const gameId = result.gameId;
      const game = games[gameId];

      const payLoad = {
        method: "start",
        clients: game.clients,
      };

      game.clients.forEach((c) => {
        clients[c.clientId].connection.send(JSON.stringify(payLoad));
      });

      const rand = randomNum();
      const words = [keyWords[rand[0]], keyWords[rand[1]], keyWords[rand[2]]];

      const allotPayLoad = {
        method: "allotChance",
        words: words,
        clientId: game.clients[idx].clientId,
      };

      setTimeout(() => {
        game.clients.forEach((c, index) => {
          clients[c.clientId].connection.send(JSON.stringify(allotPayLoad));
        });
      }, 1000);
    }

    //Validate answer
    if (result.method == "checkAnswer") {
      const clientId = result.clientId;
      const gameId = result.gameId;
      const game = games[gameId];

      if (answer == result.answer) {
        game.clients.map((item, index) => {
          if (clientId == item.clientId && item.canType) {
            const newItem = item;
            newItem.score += 100;
            newItem.canType = false;
            return newItem;
          } else return item;
        });
      }

      const payLoad = {
        method: "updateScore",
        clients: game.clients,
      };

      game.clients.forEach((c) => {
        clients[c.clientId].connection.send(JSON.stringify(payLoad));
      });
    }

    //Change answer
    if (result.method == "changeAnswer") {
      answer = result.answer;
    }

    //Ended drawing
    if (result.method == "allotChance") {
      const gameId = result.gameId;
      const game = games[gameId];

      game.clients.forEach((c, index) => {
        c.canType = true;
      });

      if (idx + 1 >= game.clients.length) idx = 0;
      else idx += 1;

      const rand = randomNum();
      const words = [keyWords[rand[0]], keyWords[rand[1]], keyWords[rand[2]]];

      const allotPayLoad = {
        method: "allotChance",
        words: words,
        clientId: game.clients[idx].clientId,
      };

      setTimeout(() => {
        game.clients.forEach((c, index) => {
          clients[c.clientId].connection.send(JSON.stringify(allotPayLoad));
        });
      }, 1000);
    }
  });

  const clientId = uuidv4();
  clients[clientId] = { connection: connection };

  const payLoad = {
    method: "connect",
    clientId: clientId,
  };

  connection.send(JSON.stringify(payLoad));
});
