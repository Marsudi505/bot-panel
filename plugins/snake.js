export const command = ["snake", "ular", "snakerun"]

const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
*{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.btn{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:12px;padding:14px;font-size:18px;font-weight:bold;cursor:pointer;backdrop-filter:blur(5px);transition:background .1s,transform .1s;display:flex;align-items:center;justify-content:center}
.btn:active{background:rgba(108,92,231,.5);transform:scale(.92)}
</style></head>
<body style="margin:0;background:transparent;font-family:Arial,sans-serif;color:#eee;touch-action:manipulation">
<div style="width:100%;max-width:620px;margin:auto;padding:12px;box-sizing:border-box">
<div style="background:rgba(255,255,255,.06);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.15);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.35);padding:16px">

<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
<div><div style="font-size:10px;letter-spacing:1.5px;color:rgba(255,255,255,.45)">Rizky GAMES</div><div style="font-size:18px;font-weight:bold;color:#fff">Snake</div></div>
<div style="text-align:right"><div id="score" style="font-size:18px;font-weight:bold;color:#fff;text-shadow:0 0 10px rgba(108,92,231,.85)">00000</div><div id="best" style="font-size:10px;color:rgba(255,255,255,.4)">BEST 00000</div></div>
</div>

<div style="display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:6px 14px;margin-bottom:12px">
<span style="font-size:10px;color:rgba(255,255,255,.5);font-weight:bold;letter-spacing:1px">PANJANG ULAR</span>
<div id="snakeLength" style="font-size:16px;font-weight:bold;color:#00b894">3</div>
</div>

<div style="display:flex;justify-content:center">
<canvas id="game" width="280" height="280" style="width:100%;max-width:280px;height:auto;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.15);border-radius:12px;display:block"></canvas>
</div>

<div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;margin-top:14px;max-width:210px;margin-left:auto;margin-right:auto">
<div></div>
<button class="btn" id="bUp">▲</button>
<div></div>
<button class="btn" id="bLeft">◄</button>
<button class="btn" id="bDown">▼</button>
<button class="btn" id="bRight">►</button>
</div>

</div></div>

<script>
const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score'), bestEl = document.getElementById('best'), lengthEl = document.getElementById('snakeLength');

const GRID = 14, SIZE = 20;
let snake, dir, nextDir, food, score, best = 0, gameOver, gameInterval;

function loadBest(){
  try{let v=localStorage.getItem('snake_best');if(v)return parseInt(v,10)}catch(e){}
  return 0;
}
function saveBest(v){
  try{localStorage.setItem('snake_best',String(v))}catch(e){}
}

best = loadBest();

function reset(){
  snake = [{x: 7, y: 7}, {x: 6, y: 7}, {x: 5, y: 7}];
  dir = {x: 1, y: 0};
  nextDir = {x: 1, y: 0};
  score = 0;
  gameOver = false;
  spawnFood();
  updateScore();
  
  if(gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(gameLoop, 120);
}

function spawnFood(){
  while(true){
    let fx = Math.floor(Math.random() * GRID);
    let fy = Math.floor(Math.random() * GRID);
    if(!snake.some(seg => seg.x === fx && seg.y === fy)){
      food = {x: fx, y: fy};
      break;
    }
  }
}

function setDir(dx, dy){
  if(dx !== -dir.x || dy !== -dir.y){
    nextDir = {x: dx, y: dy};
  }
}

function updateScore(){
  scoreEl.textContent = String(score).padStart(5, '0');
  bestEl.textContent = 'BEST ' + String(best).padStart(5, '0');
  lengthEl.textContent = snake.length;
}

function gameLoop(){
  if(gameOver) return;

  dir = nextDir;
  const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};

  if(head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID){
    triggerGameOver();
    return;
  }

  if(snake.some(seg => seg.x === head.x && seg.y === head.y)){
    triggerGameOver();
    return;
  }

  snake.unshift(head);

  if(head.x === food.x && head.y === food.y){
    score += 10;
    if(score > best) best = score;
    updateScore();
    spawnFood();
  } else {
    snake.pop();
  }

  draw();
}

function triggerGameOver(){
  gameOver = true;
  clearInterval(gameInterval);
  saveBest(best);
  draw();
}

function drawGrid(){
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  for(let i = 0; i < GRID; i++){
    ctx.beginPath(); ctx.moveTo(i * SIZE, 0); ctx.lineTo(i * SIZE, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * SIZE); ctx.lineTo(canvas.width, i * SIZE); ctx.stroke();
  }
}

function draw(){
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  ctx.fillStyle = '#ff7675';
  ctx.shadowColor = 'rgba(255, 118, 117, 0.6)';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(food.x * SIZE + SIZE/2, food.y * SIZE + SIZE/2, SIZE/2 - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  snake.forEach((seg, i) => {
    ctx.fillStyle = i === 0 ? '#00b894' : '#55efc4';
    ctx.fillRect(seg.x * SIZE + 1, seg.y * SIZE + 1, SIZE - 2, SIZE - 2);
    
    if(i === 0){
      ctx.fillStyle = '#2d3436';
      let eyeX = seg.x * SIZE + 6, eyeY = seg.y * SIZE + 6;
      if(dir.x === 1) eyeX += 4;
      if(dir.y === 1) eyeY += 4;
      ctx.fillRect(eyeX, eyeY, 4, 4);
    }
  });

  if(gameOver){
    ctx.fillStyle = 'rgba(15,15,25,.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('GAME OVER', canvas.width / 2, 130);
    ctx.font = '11px Arial';
    ctx.fillText('Tap mana saja untuk restart', canvas.width / 2, 155);
  }
}

document.getElementById('bUp').onclick = () => { if(gameOver) reset(); else setDir(0, -1); };
document.getElementById('bDown').onclick = () => { if(gameOver) reset(); else setDir(0, 1); };
document.getElementById('bLeft').onclick = () => { if(gameOver) reset(); else setDir(-1, 0); };
document.getElementById('bRight').onclick = () => { if(gameOver) reset(); else setDir(1, 0); };

document.addEventListener('keydown', e => {
  if(gameOver){ reset(); return; }
  if(e.code === 'ArrowUp') setDir(0, -1);
  if(e.code === 'ArrowDown') setDir(0, 1);
  if(e.code === 'ArrowLeft') setDir(-1, 0);
  if(e.code === 'ArrowRight') setDir(1, 0);
});

canvas.onclick = () => { if(gameOver) reset(); };

reset();
</script></body></html>`

const payloadData = {
  response_id: "4db57b2c-8393-484d-8b9a-8e6d1a14b349",
  sections: [
    {
      view_model: {
        primitive: {
          __typename: "GenAIaeacdsnwHtmlPrimitive",
          payload: html,
          trusted_sources: ["api.makota.asia"]
        },
        __typename: "GenAISingleLayoutViewModel"
      }
    }
  ]
}

const certificateChain = [
  "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"
]

export default async function (msg, { riz, id, reply }) {
  try {
    const messagePayload = {
      messageContextInfo: {
        deviceListMetadata: {},
        deviceListMetadataVersion: 2,
        botMetadata: {
          messageDisclaimerText: "",
          botResponseId: "b2e40280-433c-45d8-9c1a-270bec558860",
          verificationMetadata: {
            proofs: [
              {
                version: 1,
                useCase: 1,
                signature: "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YeN55YRyad2+ZA==",
                certificateChain
              }
            ]
          }
        }
      },
      botForwardedMessage: {
        message: {
          richResponseMessage: {
            messageType: 1,
            submessages: [
              {
                messageType: 2,
                messageText: "Lenwy Snake Game"
              }
            ],
            unifiedResponse: {
              data: Buffer.from(JSON.stringify(payloadData)).toString("base64")
            },
            contextInfo: {
              forwardingScore: 1,
              isForwarded: true,
              forwardedAiBotMessageInfo: {
                botJid: "867051314767696@bot"
              },
              forwardOrigin: 4
            }
          }
        }
      }
    }

    const socket = riz || global.conn
    const targetChat = id || msg.key?.remoteJid
    return await socket.relayMessage(targetChat, messagePayload, {})
  } catch (err) {
    return reply(`Gagal mengirim AiRich: ${err.message}`)
  }
}
