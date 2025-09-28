// Config
const GRID_ROWS = 10, GRID_COLS = 10;
const LEVELS = 5;
const CELL_PADDING = 2;
const TIME_PER_LEVEL = 4; // seconds

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const roundLabel = document.getElementById("round");
const timerLabel = document.getElementById("timer");
const movesLabel = document.getElementById("moves");
const message = document.getElementById("message");

const moveSound = new Audio("assets/sounds/move.mp3");
function playMoveSound() {
    const s = moveSound.cloneNode();
    s.play();
}
const eatSound  = new Audio("assets/sounds/eat.mp3");
const winSound  = new Audio("assets/sounds/win.mp3");
const loseSound = new Audio("assets/sounds/lose.mp3");
const startSound = new Audio("assets/sounds/start.mp3")

let selectedPlayerImgSrc = "assets/zen.jpeg"; // default
const playerImg = new Image();
playerImg.src = selectedPlayerImgSrc;

const foodImg = new Image();
foodImg.src = "assets/signlaban.jpg";   

const playerLoseImg = new Image();
playerLoseImg.src = "assets/lose.jpg"


let cellSize = canvas.width / GRID_COLS;

// State
let maps = [];
let order = [];
let currentLevel = 0;
let grid = null;
let player = { r:1, c:1 };
let food = { r:1, c:1 };
let timer = null;
let timeLeft = TIME_PER_LEVEL;
let moves = 0;
let running = false;

// Helpers
function randomInt(min,max){return Math.floor(Math.random()*(max-min+1))+min;}

function makeEmptyGrid(){
  const g=[];
  for(let r=0;r<GRID_ROWS;r++){
    g[r]=[];
    for(let c=0;c<GRID_COLS;c++) g[r][c]=0;
  }
  for(let r=0;r<GRID_ROWS;r++){g[r][0]=1; g[r][GRID_COLS-1]=1;}
  for(let c=0;c<GRID_COLS;c++){g[0][c]=1; g[GRID_ROWS-1][c]=1;}
  return g;
}

function generateMap(){
  while(true){
    const g = makeEmptyGrid();
    for(let r=1;r<GRID_ROWS-1;r++){
      for(let c=1;c<GRID_COLS-1;c++){
        if(Math.random()<0.25) g[r][c]=1;
      }
    }
    g[1][1]=0; // start free

    // check reachable size from (1,1)
    const visited = Array.from({length:GRID_ROWS},()=>Array(GRID_COLS).fill(false));
    const q=[{r:1,c:1}]; visited[1][1]=true; let count=0;
    while(q.length){
      const cur=q.shift(); count++;
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc])=>{
        const nr=cur.r+dr,nc=cur.c+dc;
        if(nr>=0 && nr<GRID_ROWS && nc>=0 && nc<GRID_COLS && !visited[nr][nc] && g[nr][nc]===0){
          visited[nr][nc]=true; q.push({r:nr,c:nc});
        }
      });
    }
    if(count > (GRID_ROWS*GRID_COLS)*0.35) return g; // keep only decently open maps
  }
}

function generateLevels(n){
  const arr=[]; for(let i=0;i<n;i++) arr.push(generateMap()); return arr;
}

function shuffleArray(a){
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
}

// BFS food placement (guarantees reachable)
function placeFoodOnReachableCell(g, player){
  const visited = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(false));
  const q = [{ r: player.r, c: player.c }];
  visited[player.r][player.c] = true;
  const reachable = [];

  while(q.length){
    const {r,c} = q.shift();
    reachable.push({r,c});
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc])=>{
      const nr=r+dr,nc=c+dc;
      if(nr>=0&&nr<GRID_ROWS&&nc>=0&&nc<GRID_COLS && !visited[nr][nc] && g[nr][nc]===0){
        visited[nr][nc]=true;
        q.push({r:nr,c:nc});
      }
    });
  }

  const candidates = reachable.filter(p=>!(p.r===player.r && p.c===player.c));
  if(candidates.length===0) return {r:player.r,c:player.c};
  return candidates[randomInt(0,candidates.length-1)];
}

// Draw everything
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for(let r=0;r<GRID_ROWS;r++){
    for(let c=0;c<GRID_COLS;c++){
      const x=c*cellSize,y=r*cellSize;
      if(grid[r][c]===1){
        ctx.fillStyle="#1f2937"; // wall
        ctx.fillRect(x+CELL_PADDING,y+CELL_PADDING,cellSize-2*CELL_PADDING,cellSize-2*CELL_PADDING);
      } else {
        ctx.fillStyle=((r+c)%2===0)?"#f8f9f0":"#eef5e6"; // floor
        ctx.fillRect(x+CELL_PADDING,y+CELL_PADDING,cellSize-2*CELL_PADDING,cellSize-2*CELL_PADDING);
      }
    }
  }
  // food
  const fx=food.c*cellSize, fy=food.r*cellSize;
//   ctx.beginPath(); ctx.arc(fx,fy,cellSize*0.3,0,Math.PI*2);
//   ctx.fillStyle="gold"; ctx.fill();
ctx.drawImage(foodImg, fx, fy, cellSize, cellSize);
  // player
  const px=player.c*cellSize, py=player.r*cellSize;
//   ctx.fillStyle="cyan"; ctx.beginPath(); ctx.arc(px,py,cellSize*0.35,0,Math.PI*2); ctx.fill();
ctx.drawImage(playerImg, px, py, cellSize, cellSize);
}

function tryMove(dr,dc){
  if(!running) return;
  const nr=player.r+dr,nc=player.c+dc;
  if(nr<0||nr>=GRID_ROWS||nc<0||nc>=GRID_COLS) return;
  if(grid[nr][nc]===1) return;
  player.r=nr; player.c=nc; moves++; movesLabel.textContent=moves;moveSound.currentTime=0;playMoveSound();
  if(player.r===food.r && player.c===food.c){ 
    eatSound.play();
    levelComplete(); }
  draw();
}

document.addEventListener("keydown",(e)=>{
  if(!running) return;
  if(e.key==="ArrowUp"||e.key==="w") tryMove(-1,0);
  if(e.key==="ArrowDown"||e.key==="s") tryMove(1,0);
  if(e.key==="ArrowLeft"||e.key==="a") tryMove(0,-1);
  if(e.key==="ArrowRight"||e.key==="d") tryMove(0,1);
});

function startTimer(){
  clearInterval(timer);
  timeLeft=TIME_PER_LEVEL;
  timerLabel.textContent=timeLeft+"s";
  timer=setInterval(()=>{
    timeLeft--; timerLabel.textContent=timeLeft+"s";
    if(timeLeft<=0){ clearInterval(timer); levelFailed(); }
  },1000);
}
function stopTimer(){ clearInterval(timer); }

function levelComplete() {
    stopTimer();
    running = false;

    currentLevel++; // increment immediately
    if (currentLevel >= LEVELS) {
        // Animate player image to fill the canvas
        const startX = player.c * cellSize;
        const startY = player.r * cellSize;
        const startSize = cellSize;
        const endSize = canvas.width;
        const endX = 0;
        const endY = 0;
        const duration = 1000;
        const startTime = performance.now();

        function animate(time) {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const size = startSize + (endSize - startSize) * progress;
            const x = startX + (endX - startX) * progress;
            const y = startY + (endY - startY) * progress;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(playerImg, x, y, size, size);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                message.innerHTML = "<b>YOU WIN!</b>";
                timerLabel.textContent = "--";
                winSound.currentTime=0;
                winSound.play();
            }
        }

        requestAnimationFrame(animate);
    } else {
        roundLabel.textContent = `${currentLevel + 1} / ${LEVELS}`;
        setupLevel(currentLevel);
    }
}


function levelFailed() {
    running = false;
    message.innerHTML = "<b>Time's up!</b> Game over.";

    // Play lose sound
    loseSound.currentTime = 0;
    loseSound.play();

    // Animate player image to fill the canvas
    const startX = player.c * cellSize;
    const startY = player.r * cellSize;
    const startSize = cellSize;
    const endSize = canvas.width; // full canvas
    const endX = 0;
    const endY = 0;
    const duration = 1000; // 1 second animation
    const startTime = performance.now();

    function animate(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const size = startSize + (endSize - startSize) * progress;
        const x = startX + (endX - startX) * progress;
        const y = startY + (endY - startY) * progress;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(playerLoseImg, x, y, size, size);

        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }

    requestAnimationFrame(animate);
}

function setupLevel(index){
  grid = JSON.parse(JSON.stringify(maps[order[index]]));
  player={r:1,c:1};
  if(grid[1][1]===1){
    let found=false;
    for(let r=1;r<GRID_ROWS-1 && !found;r++){
      for(let c=1;c<GRID_COLS-1 && !found;c++){
        if(grid[r][c]===0){ player.r=r; player.c=c; found=true; }
      }
    }
  }
  food=placeFoodOnReachableCell(grid,player);
  moves=0; movesLabel.textContent=moves;
  roundLabel.textContent=`${index +1} / ${LEVELS}`;
  message.innerHTML=`Round ${index+1} — go get the food!`;
  running=true; draw(); startTimer();
}

function startGame(){
  maps=generateLevels(LEVELS);
  order=[...Array(LEVELS).keys()]; shuffleArray(order);
  currentLevel=0; roundLabel.textContent=`1 / ${LEVELS}`;
  setupLevel(0);
}

startBtn.addEventListener("click",()=>{ if(!running) startGame();startSound.currentTime=0; startSound.play() });
restartBtn.addEventListener("click",()=>{ stopTimer(); running=false; startGame(); startSound.currentTime=0; startSound.play() });

// Initial draw
grid=makeEmptyGrid(); draw();

// Character selection logic
window.addEventListener("DOMContentLoaded", () => {
  const videoOverlay = document.getElementById("videoOverlay");
  const introVideo = document.getElementById("introVideo");
  const splashOverlay = document.getElementById("splashOverlay");
  // Hide game UI initially
  canvas.style.display = "none";
  startBtn.style.display = "none";
  restartBtn.style.display = "none";
  roundLabel.style.display = "none";
  timerLabel.style.display = "none";
  movesLabel.style.display = "none";
  message.style.display = "none";
  document.getElementById("characterSelect").style.display = "none"; // Hide character select initially

  // Show splash for 2 seconds, then play video
  setTimeout(() => {
    splashOverlay.style.display = "none";
    videoOverlay.style.display = "flex";
    try {
      introVideo.currentTime = 0;
      introVideo.play().catch(()=>{});
    } catch(e) {}
  }, 2000);

  introVideo.addEventListener("ended", () => {
    videoOverlay.style.display = "none";
    // Show character selection only
    document.getElementById("characterSelect").style.display = "";
    message.style.display = "";
    message.innerHTML = "Choose your player to begin!";
    // Hide game UI until character is chosen
    canvas.style.display = "none";
    startBtn.style.display = "none";
    restartBtn.style.display = "none";
    roundLabel.style.display = "none";
    timerLabel.style.display = "none";
    movesLabel.style.display = "none";
  });

  let characterChosen = false;

  document.querySelectorAll('.char-choice').forEach(img => {
    img.addEventListener('click', function() {
      selectedPlayerImgSrc = this.getAttribute('data-img');
      playerImg.src = selectedPlayerImgSrc;
      // Highlight selected
      document.querySelectorAll('.char-choice').forEach(i => i.style.borderColor = "#ccc");
      this.style.borderColor = "#00f";
      characterChosen = true;
      // Show Start button now
      startBtn.style.display = "";
      message.innerHTML = "Now press <b>Start</b>!";
    });
  });

  startBtn.addEventListener("click", () => {
    if (!characterChosen) {
      message.innerHTML = "Please select a character first!";
      return;
    }
    // Show game UI
    document.getElementById("characterSelect").style.display = "none";
    canvas.style.display = "";
    restartBtn.style.display = "";
    roundLabel.style.display = "";
    timerLabel.style.display = "";
    movesLabel.style.display = "";
    message.style.display = "";
    if(!running){ startGame(); }
  });
});

// Initial draw
grid=makeEmptyGrid(); draw();
