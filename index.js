const http = require("http");
const webSocketServer = require("websocket").server;
const httpServer = http.createServer();
const keyWords = require("./keywords");
const crypto = require("crypto");

//Game Variables
const clients = {};
const games = {};
let idx = 0;

// setInterval(() => {
//   clients = {};
//   games = {};
//   idx = 0;
// }, 1000);

//Starting http server
httpServer.listen(process.env.PORT || 8080, () => {
  console.log(`Listening to ${process.env.PORT || 8080}`);
});

//Starting websocket server
const wsServer = new webSocketServer({
  httpServer: httpServer,
});

//Function to generate uuid
function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  );
}

//Generating 3 random numbers
function randomNum() {
  var n = [];
  for (var i = 0; i < 3; i++) {
    n.push(Math.floor(Math.random() * keyWords.length) + 0);
  }
  return n;
}

//Websocket listener
wsServer.on("request", (request) => {
  const connection = request.accept(null, request.origin);

  //Open connection handler
  connection.on("open", () => {
    console.log("Opened");
  });

  //Close connection handler
  connection.on("close", () => {
    console.log("Closed");
  });

  //Message handler
  connection.on("message", (message) => {
    const result = JSON.parse(message.utf8Data);

    //Creating a game lobby
    if (result.method == "create") {
      const clientId = result.clientId;
      const gameId = result.name;

      //Checking if game with id already exist
      if (games[gameId]) {
        const payLoad = {
          method: "error",
          code: 1,
          error: "Server already exist",
          message: "Name has already have been taken",
        };

        const con = clients[clientId].connection;
        con.send(JSON.stringify(payLoad));
      } else {
        games[gameId] = {
          id: gameId,
          clients: [],
          answer: "",
          timer: 60,
          answerCount: 0,
        };

        const payLoad = {
          method: "create",
          game: games[gameId],
          id: gameId,
        };

        const con = clients[clientId].connection;
        con.send(JSON.stringify(payLoad));
      }
    }

    //Joining a game lobby
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

    //Starting a game
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

      setTimeout(() => {
        cleanGame(gameId);
      }, 1800 * 1000);
    }

    //Game Logics
    //Start drawing
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

    //Updating drawing
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

    //Ending drawing
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

    //Validate answer
    if (result.method == "checkAnswer") {
      const clientId = result.clientId;
      const gameId = result.gameId;
      const game = games[gameId];

      if (game.answer == result.answer) {
        game.clients.forEach((item) => {
          if (clientId == item.clientId && item.canType) {
            const newItem = item;
            newItem.score += 100;
            newItem.canType = false;
          }
        });

        game.clients[idx].score += 25;
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
      const gameId = result.gameId;
      games[gameId].answer = result.answer;
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

      game.clients.forEach((c, index) => {
        clients[c.clientId].connection.send(JSON.stringify(allotPayLoad));
      });
    }
  });

  // Generating unique ids
  const clientId = uuidv4();
  // const clientId = Date.now();
  clients[clientId] = { connection: connection };

  const payLoad = {
    method: "connect",
    clientId: clientId,
  };

  connection.send(JSON.stringify(payLoad));
});

const cleanGame = (gameId) => {
  const game = games[gameId];
  const timeOutPayload = {
    method: "error",
    code: 2,
    error: "Server had timeout",
    message: "Please restart the game",
  };

  game.clients.forEach((item) => {
    const client = item.clientId;
    const con = clients[client].connection;

    con.send(JSON.stringify(timeOutPayload));

    setTimeout(() => {
      delete clients[client];
    }, 200);
  });

  setTimeout(() => {
    delete games[gameId];
  }, 200);
};
