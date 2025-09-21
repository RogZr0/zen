
// Configuration
const GRID_ROWS = 15;
const GRID_COLS = 15;
const LEVELS = 5;
const CELL_PADDING = 2;
const TIME_PER_LEVEL = 20; // seconds

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const roundLabel = document.getElementById('round');
const timerLabel = document.getElementById('timer');
const movesLabel = document.getElementById('moves');
const message = document.getElementById('message');

let cellSize;
function resizeCanvas(){
    // canvas is square; compute cell size from canvas.width and cols
    cellSize = Math.floor(canvas.width / GRID_COLS);
}
resizeCanvas();

// Game state
let maps = []; // array of grids
let order = [];
let currentLevel = 0;
let grid = null;
let player = {r:1,c:1};
let food = {r:1,c:1};
let timer = null;
let timeLeft = TIME_PER_LEVEL;
let moves = 0;
let running = false;

// Helpers
function makeEmptyGrid(){
    const g = [];
    for(let r=0;r<GRID_ROWS;r++){
    g[r]=[];
    for(let c=0;c<GRID_COLS;c++) g[r][c]=0; // 0 - empty, 1 - wall
    }
    // put border walls
    for(let r=0;r<GRID_ROWS;r++){g[r][0]=1;g[r][GRID_COLS-1]=1}
    for(let c=0;c<GRID_COLS;c++){g[0][c]=1;g[GRID_ROWS-1][c]=1}
    return g;
}

function randomInt(min,max){return Math.floor(Math.random()*(max-min+1))+min}

// Generate a random map but ensure reachability from start to many cells
function generateMap(){
    while(true){
    const g = makeEmptyGrid();
    // random interior walls
    for(let r=1;r<GRID_ROWS-1;r++){
        for(let c=1;c<GRID_COLS-1;c++){
        if(Math.random()<0.25) g[r][c]=1;
        }
    }
    // ensure start is empty
    g[1][1]=0;
    // ensure exit-ish area empty
    g[GRID_ROWS-2][GRID_COLS-2]=0;
    // flood fill to count reachable cells from start
    const visited = Array.from({length:GRID_ROWS},()=>Array(GRID_COLS).fill(false));
    const q=[{r:1,c:1}]; visited[1][1]=true; let count=0;
    while(q.length){
        const cur = q.shift(); count++;
        const deltas = [[1,0],[-1,0],[0,1],[0,-1]];
        for(const d of deltas){
        const nr=cur.r+d[0], nc=cur.c+d[1];
        if(nr>=0 && nr<GRID_ROWS && nc>=0 && nc<GRID_COLS && !visited[nr][nc] && g[nr][nc]===0){
            visited[nr][nc]=true; q.push({r:nr,c:nc});
        }
        }
    }
    // accept if enough reachable space
    if(count >= Math.floor((GRID_ROWS*GRID_COLS)*0.4)) return g;
    // else retry (rare)
    }
}

function generateLevels(n){
    const arr=[];
    for(let i=0;i<n;i++) arr.push(generateMap());
    return arr;
}

function shuffleArray(a){
    for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
    }
}

function placeFoodOnReachableCell(g){
    // BFS from player to collect reachable cells
    const visited = Array.from({length:GRID_ROWS},()=>Array(GRID_COLS).fill(false));
    const q=[{r:player.r,c:player.c}]; visited[player.r][player.c]=true; const reachable=[{r:player.r,c:player.c}];
    while(q.length){
    const cur=q.shift();
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(d=>{
        const nr=cur.r+d[0], nc=cur.c+d[1];
        if(nr>=0 && nr<GRID_ROWS && nc>=0 && nc<GRID_COLS && !visited[nr][nc] && g[nr][nc]===0){
        visited[nr][nc]=true; q.push({r:nr,c:nc}); reachable.push({r:nr,c:nc});
        }
    })
    }
    // pick random reachable cell that's not player's cell
    const candidates = reachable.filter(p=>!(p.r===player.r && p.c===player.c));
    if(candidates.length===0) return {r:player.r,c:player.c};
    return candidates[randomInt(0,candidates.length-1)];
}

// Drawing
function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // draw grid background
    for(let r=0;r<GRID_ROWS;r++){
    for(let c=0;c<GRID_COLS;c++){
        const x=c*cellSize, y=r*cellSize;
        if(grid[r][c]===1){
        ctx.fillStyle='var(--wall)';
        ctx.fillRect(x+CELL_PADDING,y+CELL_PADDING,cellSize-2*CELL_PADDING,cellSize-2*CELL_PADDING);
        } else {
        // subtle checker for floor
        ctx.fillStyle = ((r+c)%2===0)? '#f8f9f0' : '#eef5e6';
        ctx.fillRect(x+CELL_PADDING,y+CELL_PADDING,cellSize-2*CELL_PADDING,cellSize-2*CELL_PADDING);
        }
    }
    }
    // draw food
    const fx = food.c*cellSize + cellSize/2;
    const fy = food.r*cellSize + cellSize/2;
    ctx.beginPath(); ctx.arc(fx,fy,cellSize*0.28,0,Math.PI*2); ctx.fillStyle='var(--food)'; ctx.fill();
    // small shine
    ctx.beginPath(); ctx.arc(fx - cellSize*0.08, fy - cellSize*0.12, cellSize*0.08,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.fill();

    // draw player as circle with eye
    const px = player.c*cellSize + cellSize/2;
    const py = player.r*cellSize + cellSize/2;
    ctx.beginPath(); ctx.arc(px,py,cellSize*0.34,0,Math.PI*2); ctx.fillStyle='var(--player)'; ctx.fill();
    // eye
    ctx.beginPath(); ctx.arc(px + cellSize*0.08, py - cellSize*0.06, cellSize*0.08,0,Math.PI*2); ctx.fillStyle='#03131a'; ctx.fill();
}

// Movement
function tryMove(dr,dc){
    if(!running) return;
    const nr = player.r + dr, nc = player.c + dc;
    if(nr<0||nr>=GRID_ROWS||nc<0||nc>=GRID_COLS) return;
    if(grid[nr][nc]===1) return; // wall
    player.r=nr; player.c=nc; moves++; movesLabel.textContent=moves;
    // check food
    if(player.r===food.r && player.c===food.c){
    levelComplete();
    }
    draw();
}

document.addEventListener('keydown',(e)=>{
    if(!running) return;
    const k=e.key;
    if(k==='ArrowUp' || k==='w' || k==='W') tryMove(-1,0);
    if(k==='ArrowDown' || k==='s' || k==='S') tryMove(1,0);
    if(k==='ArrowLeft' || k==='a' || k==='A') tryMove(0,-1);
    if(k==='ArrowRight' || k==='d' || k==='D') tryMove(0,1);
});

// Timer functions
function startTimer(){
    clearInterval(timer);
    timeLeft = TIME_PER_LEVEL;
    timerLabel.textContent = timeLeft + 's';
    timer = setInterval(()=>{
    timeLeft--;
    timerLabel.textContent = timeLeft + 's';
    if(timeLeft<=0){ clearInterval(timer); levelFailed(); }
    },1000);
}

function stopTimer(){ clearInterval(timer); }

function playLoseSound(){
    try{
    const ctxA = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctxA.createOscillator();
    const g = ctxA.createGain();
    o.type='sawtooth'; o.frequency.value=220;
    o.connect(g); g.connect(ctxA.destination);
    g.gain.value=0.0001;
    const now = ctxA.currentTime;
    g.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
    o.start(now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    o.stop(now + 1.3);
    }catch(e){ console.warn('Audio not available'); }
}

function playWinSound(){
    try{
    const ctxA = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctxA.createOscillator();
    const o2 = ctxA.createOscillator();
    const g = ctxA.createGain();
    o.type='sine'; o2.type='sine';
    o.frequency.value=880; o2.frequency.value=1320;
    o.connect(g); o2.connect(g); g.connect(ctxA.destination);
    g.gain.value=0.0001;
    const now = ctxA.currentTime;
    g.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    o.start(now); o2.start(now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    o.stop(now + 0.7); o2.stop(now + 0.7);
    }catch(e){ console.warn('Audio not available'); }
}

// Level progression
function levelComplete(){
    stopTimer();
    message.innerHTML = `<strong>Nice!</strong> You ate the food. Loading next map...`;
    currentLevel++;
    setTimeout(()=>{
    if(currentLevel>=LEVELS){
        // player wins full game
        message.innerHTML = `<strong>YOU WIN!</strong> You completed ${LEVELS} rounds.`;
        playWinSound();
        running=false;
        roundLabel.textContent = `${currentLevel} / ${LEVELS}`;
        timerLabel.textContent='--';
    } else {
        roundLabel.textContent = `${currentLevel} / ${LEVELS}`;
        setupLevel(currentLevel);
    }
    },700);
}

function levelFailed(){
    running=false;
    playLoseSound();
    message.innerHTML = `<strong>Time's up!</strong> You failed to eat the food. Game over.`;
    timerLabel.textContent='0s';
}

function setupLevel(index){
    // load map from maps order
    grid = JSON.parse(JSON.stringify(maps[order[index]])); // deep copy
    // place player at start (1,1) or nearest free cell
    if(grid[1][1]===1){
    // find nearest empty cell to (1,1)
    let found=false;
    for(let r=1;r<GRID_ROWS-1 && !found;r++){
        for(let c=1;c<GRID_COLS-1 && !found;c++){
        if(grid[r][c]===0){ player.r=r; player.c=c; found=true; }
        }
    }
    } else { player.r=1; player.c=1; }
    // place food on reachable cell
    food = placeFoodOnReachableCell(grid);
    moves = 0; movesLabel.textContent=moves;
    roundLabel.textContent = `${index} / ${LEVELS}`;
    message.innerHTML = `Round ${index+1} — go get the food!`;
    running=true;
    draw();
    startTimer();
}

// start game
function startGame(){
    maps = generateLevels(LEVELS);
    order = [...Array(LEVELS).keys()]; shuffleArray(order);
    currentLevel = 0; roundLabel.textContent = `0 / ${LEVELS}`;
    message.innerHTML = 'Get ready...';
    // small delay then start
    setTimeout(()=>{
    setupLevel(0);
    },300);
}

startBtn.addEventListener('click',()=>{
    if(running){ message.innerHTML='Game already running'; return; }
    startGame();
});
restartBtn.addEventListener('click',()=>{
    stopTimer(); running=false; message.innerHTML='Restarting...';
    setTimeout(()=>{ startGame(); },200);
});

// initial draw of an empty maze preview
grid = makeEmptyGrid();
draw();

// handle resize (keep canvas square)
window.addEventListener('resize',()=>{ /* no-op: canvas fixed size in this demo */ });