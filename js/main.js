'use strict';

(function() {
  const MAX_OF_DICE = 6;
  const SCALE = 3; // 解像度
  const ROW = 5; // 行
  const COL = 5; // 列
  const UDRL = [
    [0, -1],
    [0, 1],
    [1, 0],
    [-1, 0]
  ];
  const U = 0; // 上
  const D = 1; // 下
  const R = 2; // 右
  const L = 3; // 左
  const X = 0;
  const Y = 1;
  const START_POSITION = [0, 0];
  const GOAL_POSITION = [COL - 1, ROW - 1];
  // すごろく盤の状態
  const NORMAL = 0;
  const BLANK = 1;
  const START = 2;
  const GOAL = 3;
  const SHUFFLE = 4;
  const TELEPORT = 5;
  const NUM_OF_SHUFFLE = 2;
  const NUM_OF_TELEPORT = 2;
  // プレイヤーの色
  const YOU_COLOR = "#D81159";
  const CPU_COLOR = "#3B413C";

  let canvas = document.getElementById('mycanvas');
  canvas.width *= SCALE;
  if (!canvas || !canvas.getContext) {
    return false;
  }
  let ctx = canvas.getContext('2d');

  const SQUARE_WIDTH = canvas.width / COL;
  const SQUARE_HEIGHT = canvas.width / COL;
  canvas.height = SQUARE_HEIGHT * ROW;
  canvas.style.width = canvas.width / SCALE + 'px';
  canvas.style.height = canvas.height / SCALE + 'px';

  const NORMAL_COLOR = "#87ceeb";
  const STAGE_COLOR = "#ffffff";
  const COURSE_COLOR = "#f06543";
  const START_COLOR = "#f5cb5c";
  const GOAL_COLOR = "#f5cb5c";
  const SHUFFLE_COLOR = "#bbd8b3";
  const TELEPORT_COLOR = "#ffc0cb";
  const TEXT_COLOR = "#ffffff";
  const FONT_SIZE = SQUARE_WIDTH / 3;
  const TEXT_FONT = "bold " + FONT_SIZE + "px Arial";
  const BORDER = 4 * SCALE;

  let dice;
  let you;
  let cpu;
  let board;
  let view;
  let yourTurn;
  let isPlaying;

  // ダイス
  let Dice = function(num) {
    this.num = num;
    this.rand = function() {
      return Math.ceil(Math.random() * this.num); // 1~num
    }
  };

  // プレイヤー
  let Player = function(color, goalText) {
    this.X = START_POSITION[X];
    this.Y = START_POSITION[Y];
    this.color = color;
    this.stepsLeft = 0;
    this.point = -1;
    this.path = -1;
    this.courses = [];
    this.goalText = goalText;
    this.passGoal = false;

    this.move = function() {
      setTimeout(() => {
        if (this.point === -1) {
          this.setPoint();
        } else {
          this.stepsLeft -= 1;
          this.X = this.X + UDRL[this.point][X];
          this.Y = this.Y + UDRL[this.point][Y];
          view.drawMap();
          this.setPath();
          this.checkGoal();
          this.point = -1;
          this.courses = [];
          $('#stepsCount').text(this.stepsLeft);
          $('#stepsCount').toggleClass("change");
          if (this.stepsLeft > 0) {
            this.move();
          } else if (isPlaying) {
            this.resetPath();
            $('#turn').toggleClass("change");
            if (yourTurn) {
              yourTurn = false;
              $('#turn').text("CPUのターン");
              cpuTurn();
            } else {
              yourTurn = true;
              $('#turn').text("あなたのターン");
              $('#dice').removeClass("inactive");
            }
            board.shuffle(this);
            board.teleport(this);
          }
        }
      }, 300);
    };

    // 進行方向を決める
    this.setPoint = function() {
      this.setCourses();
      if (this.courses.length === 0) {
        // 進路がない場合は引き返す
        this.point = this.path;
      } else if (this.courses.length === 1) {
        this.point = this.courses[0];
      } else if (this.courses.length >= 2) {
        view.drawCourse(this);
        this.point = -1;
        return false;
      }
      this.move();
    };

    this.setCourses = function() {
      let targetX, targetY;
      for (let i = 0; i < UDRL.length; i++) {
        targetX = this.X + UDRL[i][X];
        targetY = this.Y + UDRL[i][Y];
        if (targetX < 0 || targetX >= COL) {
          continue;
        }
        if (targetY < 0 || targetY >= ROW) {
          continue;
        }
        if (board.map[targetX][targetY] !== BLANK && i !== this.path) {
          this.courses[this.courses.length] = i;
        }
      }
    };

    this.setPath = function() {
      // pathにpointと逆方向を代入
      switch (this.point) {
        case U:
          this.path = D;
          break;
        case D:
          this.path = U;
          break;
        case R:
          this.path = L;
          break;
        case L:
          this.path = R;
          break;
      }
    };

    this.autoSelect = function() {
      if (this.courses.indexOf(R) >= 0) {
        this.point = R;
      } else if (this.courses.indexOf(D) >= 0) {
        this.point = D;
      } else if (this.courses.indexOf(U) >= 0) {
        this.point = U;
      } else if (this.courses.indexOf(L) >= 0) {
        this.point = L;
      }
      this.move();
    };

    this.checkGoal = function() {
      if (board.map[this.X][this.Y] !== GOAL) {
        return false;
      } else if (this.stepsLeft > 0) {
        this.passGoal = true;
        console.log("2" + this.passGoal);
      } else if (this.stepsLeft === 0) {
        isPlaying = false;
        setTimeout(() => {
          showResult(this.goalText);
          // alert(this.goalText);
        }, 500);
      }
    };

    // ゴールを通過したときは、ターン終了後に再びゴール方向に向かう
    this.resetPath = function() {
      if (this.passGoal) {
        this.path = -1;
      }
      this.passGoal = false;
    };
  };

  // すごろく盤
  let Board = function() {
    this.map = [];
    this.num0fSquares;
    this.suffle = [];
    this.warp = [];

    // ランダムな数字を取得
    this.rand = function(n) {
      return Math.floor(Math.random() * n);
    };

    // すごろく盤を生成
    this.setMap = function() {
      this.map = [];
      you.path = -1;
      cpu.path = -1;
      for (let x = 0; x < COL; x++) {
        this.map[x] = [];
        for (let y = 0; y < ROW; y++) {
          this.map[x][y] = NORMAL;
        }
      }
      for (let x = 1; x < COL; x += 2) {
        for (let y = 1; y < ROW; y += 2) {
          this.map[x][y] = BLANK;
        }
      }
      for (let x = 1; x < COL; x += 2) {
        for (let y = 1; y < ROW; y += 2) {
          let r;
          do {
            if (x === 1) {
              r = UDRL[this.rand(UDRL.length)]
            } else {
              r = UDRL[this.rand(UDRL.length - 1)];
            }
          } while (this.map[x + r[X]][y + r[Y]] === BLANK);
          this.map[x + r[X]][y + r[Y]] = BLANK;
        }
      }
      this.map[START_POSITION[X]][START_POSITION[Y]] = START;
      this.map[GOAL_POSITION[X]][GOAL_POSITION[Y]] = GOAL;
      this.setEvent(SHUFFLE, NUM_OF_SHUFFLE);
      this.setEvent(TELEPORT, NUM_OF_TELEPORT);
    };

    this.setEvent = function(event, num) {
      for (let i = 0; i < num; i++) {
        let x, y;
        do {
          x = this.rand(COL);
          y = this.rand(ROW);
        } while (this.map[x][y] !== NORMAL);
        this.map[x][y] = event;
      }
    };

    this.shuffle = function(player) {
      if (this.map[player.X][player.Y] === SHUFFLE) {
        setTimeout(() => {
          this.setMap();
          view.drawMap();
          $('#mycanvas').toggleClass("change");
        }, 400);
      }
    };

    this.teleport = function(player) {
      if (this.map[player.X][player.Y] === TELEPORT) {
        setTimeout(() => {
          for (let x = 0; x < COL; x++) {
            for (let y = 0; y < ROW; y++) {
              if (this.map[x][y] === TELEPORT &&
                (x !== player.X || y !== player.Y)) {
                player.X = x;
                player.Y = y;
                player.path = -1;
                view.drawMap();
                return false;
              }
            }
          }
        }, 400);
      }
    };

  };

  let View = function() {
    this.drawMap = function() {
      this.clearStage();
      for (let x = 0; x < COL; x++) {
        for (let y = 0; y < ROW; y++) {
          if (board.map[x][y] === NORMAL) {
            this.drawNORMAL(x, y);
          } else if (board.map[x][y] === START) {
            this.drawStart(x, y);
          } else if (board.map[x][y] === GOAL) {
            this.drawGoal(x, y);
          } else if (board.map[x][y] === SHUFFLE) {
            this.drawShuffle(x, y);
          } else if (board.map[x][y] === TELEPORT) {
            this.drawTeleport(x, y);
          }
          if (x === you.X && y === you.Y) {
            this.drawPlayer(you);
          }
          if (x === cpu.X && y === cpu.Y) {
            this.drawPlayer(cpu);
          }
        }
      }
    };

    this.drawNORMAL = function(x, y) {
      ctx.fillStyle = NORMAL_COLOR;
      this.drawRect(x, y);
    };

    this.drawStart = function(x, y) {
      ctx.fillStyle = START_COLOR;
      this.drawRect(x, y);
      this.drawText(x, y, "START");
    };

    this.drawGoal = function(x, y) {
      ctx.fillStyle = GOAL_COLOR;
      this.drawRect(x, y);
      this.drawText(x, y, "GOAL");
    };

    this.drawShuffle = function(x, y) {
      ctx.fillStyle = SHUFFLE_COLOR;
      this.drawRect(x, y);
    };

    this.drawTeleport = function(x, y) {
      ctx.fillStyle = TELEPORT_COLOR;
      this.drawRect(x, y);
    };

    this.drawCourse = function(player) {
      this.drawMap();
      for (let i = 0; i < player.courses.length; i++) {
        let x = player.X + UDRL[player.courses[i]][X];
        let y = player.Y + UDRL[player.courses[i]][Y];
        ctx.fillStyle = COURSE_COLOR;
        this.drawRect(x, y);
      }
      if (player === cpu) {
        setTimeout(() => {
          player.autoSelect();
        }, 500);
      } else {
        youSelect();
      }
    };

    this.drawRect = function(x, y) {
      ctx.fillRect(
        x * SQUARE_WIDTH + BORDER,
        y * SQUARE_HEIGHT + BORDER,
        SQUARE_WIDTH - 2 * BORDER,
        SQUARE_HEIGHT - 2 * BORDER);
    };

    this.drawText = function(x, y, text) {
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = TEXT_FONT;
      ctx.textAlign = "center";
      ctx.fillText(
        text,
        (x + 0.5) * SQUARE_WIDTH,
        (y + 1) * SQUARE_HEIGHT - (2 * BORDER),
        SQUARE_WIDTH - (3 * BORDER)
      );
    };

    this.drawPlayer = function(player) {
      let r = SQUARE_WIDTH / 10;
      ctx.beginPath();
      ctx.fillStyle = player.color;
      if (you.X !== cpu.X || you.Y !== cpu.Y) {
        ctx.arc(
          (player.X + 0.5) * SQUARE_WIDTH,
          (player.Y + 0.5) * SQUARE_HEIGHT,
          r, 0, 2 * Math.PI, true);
      } else {
        switch (player) {
          case you:
            ctx.arc(
              (player.X + 0.5) * SQUARE_WIDTH - 1.2 * r,
              (player.Y + 0.5) * SQUARE_HEIGHT,
              r, 0, 2 * Math.PI, true);
            break;
          case cpu:
            ctx.arc(
              (player.X + 0.5) * SQUARE_WIDTH + 1.2 * r,
              (player.Y + 0.5) * SQUARE_HEIGHT,
              r, 0, 2 * Math.PI, true);
            break;
        }
      }
      ctx.fill();
    };

    this.clearStage = function() {
      ctx.fillStyle = STAGE_COLOR;
      // ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

  };

  function init() {
    isPlaying = true;
    yourTurn = true;
    dice = new Dice(MAX_OF_DICE);
    you = new Player(YOU_COLOR, "あなたの勝ちです!!");
    cpu = new Player(CPU_COLOR, "あなたの負けです...");
    board = new Board(COL, ROW);
    view = new View();
    board.setMap();
    view.drawMap();
  }

  function cpuTurn() {
    setTimeout(() => {
      cpu.stepsLeft = dice.rand();
      $('#stepsCount').text(cpu.stepsLeft);
      cpu.move();
    }, 1000);
  }

  function showResult(text) {
    $('#modal').text(text);
    $('#modal').removeClass('hidden');
    $('#mask').removeClass('hidden');
  }

  function youSelect() {
    $('#modal').text("コースを選択してください");
    $('#modal').removeClass('hidden');
  }

  init();

  $('#dice').click(() => {
    if (!$("#dice").hasClass("inactive")) {
      you.stepsLeft = dice.rand();
      $('#stepsCount').text(you.stepsLeft);
      $('#stepsCount').toggleClass("change");
      $('#dice').addClass("inactive");
      you.move();
    }
  });

  $("#mycanvas").on("click", function(e) {
    $('#modal').addClass('hidden');
    let x, y;
    let rect;
    rect = e.target.getBoundingClientRect();
    x = e.clientX - rect.left;
    y = e.clientY - rect.top;
    // 行と列を求める
    let row, col;
    row = Math.floor(y * SCALE / (SQUARE_HEIGHT));
    col = Math.floor(x * SCALE / (SQUARE_WIDTH));
    // クリックされたマスが選択可能なマスか判定
    let isCourse = false;
    for (let i = 0; i < you.courses.length; i++) {
      if (col === you.X + UDRL[you.courses[i]][X] &&
        row === you.Y + UDRL[you.courses[i]][Y]) {
        you.point = you.courses[i];
        isCourse = true;
      }
    }
    if (!isCourse) {
      return false;
    }
    you.move();
  });

  $('#modal').on("click", () => {
    if (isPlaying) {
      $('#modal').addClass('hidden');
    } else {
      location.href = "";
    }
  });

  $('#mask').on("click", () => {
    $('#modal').click();
  });

})();
