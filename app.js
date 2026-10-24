const BOARD_SIZES = { '9': 9, '13': 13, '19': 19 };
const STAR_POINTS = {
    9: [[2,2],[6,2],[2,6],[6,6],[4,4]],
    13: [[3,3],[9,3],[3,9],[9,9],[6,6]],
    19: [[3,3],[9,3],[15,3],[3,9],[9,9],[15,9],[3,15],[9,15],[15,15]]
};

class GoGame {
    constructor() {
        this.boardSize = 19;
        this.komi = 6.5;
        this.handicap = 0;
        this.board = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(null));
        this.currentPlayer = 'black';
        this.history = [];
        this.moveCount = 0;
        this.passCount = 0;
        this.blackCaptures = 0;
        this.whiteCaptures = 0;
        this.ko = null; // {x,y} where ko was just captured
        this.moveHistory = [];
        
        this.svg = document.getElementById('board');
        this.initBoard();
        this.setupEventListeners();
        this.applyHandicap();
        this.updateUI();
    }
    
    initBoard() {
        this.margin = 30;
        this.cellSize = (540) / (this.boardSize - 1);
        this.boardPixel = this.margin * 2 + this.cellSize * (this.boardSize - 1);
        this.svg.setAttribute('viewBox', `0 0 ${this.boardPixel} ${this.boardPixel}`);
        this.svg.innerHTML = `
            <defs>
                <radialGradient id="blackGradient" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" style="stop-color:#4a4a4a;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#1a1a1a;stop-opacity:1" />
                </radialGradient>
                <radialGradient id="whiteGradient" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#e8e8e8;stop-opacity:1" />
                </radialGradient>
            </defs>
        `;
        this.drawGrid();
        this.createHitAreas();
    }
    
    drawGrid() {
        // Grid lines
        for (let i = 0; i < this.boardSize; i++) {
            const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            hLine.setAttribute('class', 'grid-line');
            hLine.setAttribute('x1', this.margin);
            hLine.setAttribute('y1', this.margin + i * this.cellSize);
            hLine.setAttribute('x2', this.margin + (this.boardSize - 1) * this.cellSize);
            hLine.setAttribute('y2', this.margin + i * this.cellSize);
            this.svg.appendChild(hLine);
            
            const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            vLine.setAttribute('class', 'grid-line');
            vLine.setAttribute('x1', this.margin + i * this.cellSize);
            vLine.setAttribute('y1', this.margin);
            vLine.setAttribute('x2', this.margin + i * this.cellSize);
            vLine.setAttribute('y2', this.margin + (this.boardSize - 1) * this.cellSize);
            this.svg.appendChild(vLine);
        }
        
        // Star points
        const stars = STAR_POINTS[this.boardSize] || [];
        for (let [x, y] of stars) {
            const star = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            star.setAttribute('class', 'star-point');
            star.setAttribute('cx', this.margin + x * this.cellSize);
            star.setAttribute('cy', this.margin + y * this.cellSize);
            star.setAttribute('r', this.boardSize === 19 ? 3 : (this.boardSize === 13 ? 2.5 : 2));
            this.svg.appendChild(star);
        }
    }
    
    createHitAreas() {
        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                hitArea.setAttribute('x', this.margin + i * this.cellSize - this.cellSize / 2);
                hitArea.setAttribute('y', this.margin + j * this.cellSize - this.cellSize / 2);
                hitArea.setAttribute('width', this.cellSize);
                hitArea.setAttribute('height', this.cellSize);
                hitArea.setAttribute('fill', 'transparent');
                hitArea.setAttribute('data-x', i);
                hitArea.setAttribute('data-y', j);
                hitArea.style.cursor = 'pointer';
                hitArea.addEventListener('click', () => this.playMove(i, j));
                this.svg.appendChild(hitArea);
            }
        }
    }
    
    setupEventListeners() {
        document.getElementById('passBtn').addEventListener('click', () => this.pass());
        document.getElementById('resignBtn').addEventListener('click', () => this.resign());
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('newGameBtn').addEventListener('click', () => this.newGame());
        document.getElementById('boardSize').addEventListener('change', (e) => {
            this.boardSize = parseInt(e.target.value);
            this.newGame();
        });
        document.getElementById('komi').addEventListener('change', (e) => {
            this.komi = parseFloat(e.target.value);
            document.getElementById('komiDisplay').textContent = this.komi;
        });
        document.getElementById('handicap').addEventListener('change', (e) => {
            this.handicap = parseInt(e.target.value);
        });
        document.getElementById('scoreBtn').addEventListener('click', () => this.countScore());
        document.getElementById('saveSgfBtn').addEventListener('click', () => this.saveSGF());
        document.getElementById('loadSgfBtn').addEventListener('click', () => {
            document.getElementById('loadSgfInput').click();
        });
        document.getElementById('loadSgfInput').addEventListener('change', (e) => this.loadSGF(e));
        document.getElementById('closeModal').addEventListener('click', () => {
            document.getElementById('gameOverModal').style.display = 'none';
        });
    }
    
    getNeighbors(x, y) {
        const neighbors = [];
        if (x > 0) neighbors.push([x-1, y]);
        if (x < this.boardSize - 1) neighbors.push([x+1, y]);
        if (y > 0) neighbors.push([x, y-1]);
        if (y < this.boardSize - 1) neighbors.push([x, y+1]);
        return neighbors;
    }
    
    getGroup(x, y, board = this.board) {
        const color = board[x][y];
        if (!color) return {stones: [], liberties: new Set()};
        const visited = new Set();
        const stones = [];
        const stack = [[x,y]];
        visited.add(x + ',' + y);
        while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            stones.push([cx, cy]);
            for (let [nx, ny] of this.getNeighbors(cx, cy)) {
                const key = nx + ',' + ny;
                if (!visited.has(key)) {
                    if (board[nx][ny] === color) {
                        visited.add(key);
                        stack.push([nx, ny]);
                    }
                }
            }
        }
        const liberties = new Set();
        for (let [sx, sy] of stones) {
            for (let [nx, ny] of this.getNeighbors(sx, sy)) {
                if (board[nx][ny] === null) {
                    liberties.add(nx + ',' + ny);
                }
            }
        }
        return {stones, liberties};
    }
    
    playMove(x, y) {
        if (this.board[x][y] !== null) return;
        // Ko rule
        if (this.ko && this.ko.x === x && this.ko.y === y) return;
        
        const boardCopy = this.board.map(row => [...row]);
        boardCopy[x][y] = this.currentPlayer;
        
        const opponent = this.currentPlayer === 'black' ? 'white' : 'black';
        let capturedStones = [];
        let koPoint = null;
        
        // Check opponent groups for capture
        for (let [nx, ny] of this.getNeighbors(x, y)) {
            if (boardCopy[nx][ny] === opponent) {
                const group = this.getGroup(nx, ny, boardCopy);
                if (group.liberties.size === 0) {
                    for (let [sx, sy] of group.stones) {
                        capturedStones.push([sx, sy]);
                    }
                    // Check for ko (single stone captured)
                    if (group.stones.length === 1) {
                        koPoint = [nx, ny];
                    }
                }
            }
        }
        
        // Remove captured stones
        for (let [cx, cy] of capturedStones) {
            boardCopy[cx][cy] = null;
        }
        
        // Check if own group has liberties (suicide rule - usually not allowed in normal Go, but some rules allow; we'll follow standard - no suicide)
        const ownGroup = this.getGroup(x, y, boardCopy);
        if (ownGroup.liberties.size === 0 && capturedStones.length === 0) {
            return; // suicide not allowed
        }
        
        // Save state
        this.history.push({
            board: this.board.map(row => [...row]),
            currentPlayer: this.currentPlayer,
            moveCount: this.moveCount,
            blackCaptures: this.blackCaptures,
            whiteCaptures: this.whiteCaptures,
            ko: this.ko ? {...this.ko} : null,
            passCount: this.passCount
        });
        
        // Apply move
        this.board = boardCopy;
        if (this.currentPlayer === 'black') {
            this.whiteCaptures += capturedStones.length;
        } else {
            this.blackCaptures += capturedStones.length;
        }
        
        // Set ko
        if (capturedStones.length === 1 && koPoint) {
            // Ko point is the position where opponent stone was captured from
            this.ko = {x: koPoint[0], y: koPoint[1]};
        } else {
            this.ko = null;
        }
        
        this.moveCount++;
        this.passCount = 0;
        this.moveHistory.push({x, y, color: this.currentPlayer, captures: capturedStones.length});
        this.drawStones();
        this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black';
        this.updateUI();
    }
    
    drawStones() {
        // Remove all stones
        const stones = this.svg.querySelectorAll('.stone');
        stones.forEach(s => s.remove());
        const koMarkers = this.svg.querySelectorAll('.ko-marker');
        koMarkers.forEach(m => m.remove());
        
        // Draw stones
        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                if (this.board[i][j] === 'black') {
                    const stone = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    stone.setAttribute('class', 'stone black');
                    stone.setAttribute('cx', this.margin + i * this.cellSize);
                    stone.setAttribute('cy', this.margin + j * this.cellSize);
                    stone.setAttribute('r', this.cellSize * 0.42);
                    this.svg.appendChild(stone);
                } else if (this.board[i][j] === 'white') {
                    const stone = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    stone.setAttribute('class', 'stone white');
                    stone.setAttribute('cx', this.margin + i * this.cellSize);
                    stone.setAttribute('cy', this.margin + j * this.cellSize);
                    stone.setAttribute('r', this.cellSize * 0.42);
                    this.svg.appendChild(stone);
                }
            }
        }
        
        // Draw ko marker
        if (this.ko) {
            const ko = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            ko.setAttribute('class', 'ko-marker');
            ko.setAttribute('cx', this.margin + this.ko.x * this.cellSize);
            ko.setAttribute('cy', this.margin + this.ko.y * this.cellSize);
            ko.setAttribute('r', this.cellSize * 0.25);
            this.svg.appendChild(ko);
        }
    }
    
    pass() {
        this.history.push({
            board: this.board.map(row => [...row]),
            currentPlayer: this.currentPlayer,
            moveCount: this.moveCount,
            blackCaptures: this.blackCaptures,
            whiteCaptures: this.whiteCaptures,
            ko: this.ko ? {...this.ko} : null,
            passCount: this.passCount
        });
        
        this.passCount++;
        this.moveHistory.push({type: 'pass', color: this.currentPlayer});
        this.ko = null;
        this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black';
        this.updateUI();
        
        if (this.passCount >= 2) {
            document.getElementById('gameOverText').textContent = 'Game ended by mutual pass. Click "Count Territory" to score.';
            document.getElementById('gameOverModal').style.display = 'flex';
        }
    }
    
    resign() {
        const winner = this.currentPlayer === 'black' ? 'White' : 'Black';
        document.getElementById('gameOverText').textContent = `${this.currentPlayer === 'black' ? 'Black' : 'White'} resigned. ${winner} wins.`;
        document.getElementById('gameOverModal').style.display = 'flex';
    }
    
    undo() {
        if (this.history.length === 0) return;
        const prev = this.history.pop();
        this.board = prev.board;
        this.currentPlayer = prev.currentPlayer;
        this.moveCount = prev.moveCount;
        this.blackCaptures = prev.blackCaptures;
        this.whiteCaptures = prev.whiteCaptures;
        this.ko = prev.ko;
        this.passCount = prev.passCount;
        if (this.moveHistory.length > 0) this.moveHistory.pop();
        this.drawStones();
        this.updateUI();
    }
    
    newGame() {
        this.board = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(null));
        this.currentPlayer = 'black';
        this.history = [];
        this.moveCount = 0;
        this.passCount = 0;
        this.blackCaptures = 0;
        this.whiteCaptures = 0;
        this.ko = null;
        this.moveHistory = [];
        this.drawStones();
        this.applyHandicap();
        document.getElementById('scoreResult').style.display = 'none';
        this.updateUI();
    }
    
    applyHandicap() {
        if (this.handicap === 0) return;
        const stars = STAR_POINTS[this.boardSize] || [];
        if (this.boardSize === 9) {
            const positions = [[2,2],[6,2],[6,6],[2,6],[4,4],[2,4],[6,4],[4,2],[4,6]];
            for (let i = 0; i < this.handicap && i < positions.length; i++) {
                const [x,y] = positions[i];
                this.board[x][y] = 'white';
            }
        } else if (this.boardSize === 13) {
            const positions = [[3,3],[9,3],[9,9],[3,9],[6,6],[3,6],[9,6],[6,3],[6,9]];
            for (let i = 0; i < this.handicap && i < positions.length; i++) {
                const [x,y] = positions[i];
                this.board[x][y] = 'white';
            }
        } else if (this.boardSize === 19) {
            const positions = [[3,3],[15,3],[15,15],[3,15],[9,9],[3,9],[15,9],[9,3],[9,15]];
            for (let i = 0; i < this.handicap && i < positions.length; i++) {
                const [x,y] = positions[i];
                this.board[x][y] = 'white';
            }
        }
        this.currentPlayer = 'black';
        this.drawStones();
    }
    
    countScore() {
        // Simple area scoring approximation
        const territory = {black: 0, white: 0};
        const visited = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(false));
        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                if (this.board[i][j] === null && !visited[i][j]) {
                    const region = this.getEmptyRegion(i, j, visited);
                    if (region.liberties.black && !region.liberties.white) {
                        territory.black += region.size;
                    } else if (region.liberties.white && !region.liberties.black) {
                        territory.white += region.size;
                    }
                }
            }
        }
        const blackScore = territory.black + this.blackCaptures;
        const whiteScore = territory.white + this.whiteCaptures + this.komi;
        const result = document.getElementById('scoreResult');
        result.innerHTML = `
            <strong>Area Scoring (approx)</strong><br>
            Black: ${territory.black} + ${this.blackCaptures} captures = ${blackScore}<br>
            White: ${territory.white} + ${this.whiteCaptures} captures + ${this.komi} komi = ${whiteScore.toFixed(1)}<br><br>
            <strong>${blackScore > whiteScore ? 'Black' : whiteScore > blackScore ? 'White' : 'Draw'} wins by ${Math.abs(blackScore - whiteScore).toFixed(1)}</strong>
        `;
        result.style.display = 'block';
    }
    
    getEmptyRegion(x, y, visited) {
        const region = [];
        const stack = [[x,y]];
        visited[x][y] = true;
        while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            region.push([cx, cy]);
            for (let [nx, ny] of this.getNeighbors(cx, cy)) {
                if (nx >= 0 && nx < this.boardSize && ny >= 0 && ny < this.boardSize) {
                    if (!visited[nx][ny] && this.board[nx][ny] === null) {
                        visited[nx][ny] = true;
                        stack.push([nx, ny]);
                    }
                }
            }
        }
        const liberties = {black: false, white: false};
        for (let [rx, ry] of region) {
            for (let [nx, ny] of this.getNeighbors(rx, ry)) {
                if (nx >= 0 && nx < this.boardSize && ny >= 0 && ny < this.boardSize) {
                    if (this.board[nx][ny] === 'black') liberties.black = true;
                    if (this.board[nx][ny] === 'white') liberties.white = true;
                }
            }
        }
        return {stones: region, size: region.length, liberties};
    }
    
    saveSGF() {
        let sgf = '(;GM[1]FF[4]CA[UTF-8]AP[SoftWeiqi:1]SZ[' + this.boardSize + ']KM[' + this.komi + ']';
        if (this.handicap > 0) sgf += 'HA[' + this.handicap + ']';
        for (let move of this.moveHistory) {
            if (move.type === 'pass') {
                sgf += ';' + (move.color === 'black' ? 'B' : 'W') + '[]';
            } else if (move.x !== undefined) {
                const col = String.fromCharCode(97 + move.x);
                const row = String.fromCharCode(97 + move.y);
                sgf += ';' + (move.color === 'black' ? 'B' : 'W') + '[' + col + row + ']';
            }
        }
        sgf += ')';
        const blob = new Blob([sgf], {type: 'text/plain'});
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'game.sgf';
        a.click();
    }
    
    loadSGF(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            alert('SGF loading simplified - paste moves manually or start new game');
        };
        reader.readAsText(file);
        e.target.value = '';
    }
    
    updateUI() {
        document.getElementById('turnText').textContent = this.currentPlayer === 'black' ? "Black's turn" : "White's turn";
        const indicator = document.getElementById('turnIndicator');
        indicator.className = 'stone-indicator ' + this.currentPlayer;
        document.getElementById('moveCount').textContent = this.moveCount;
        document.getElementById('passCount').textContent = this.passCount;
        document.getElementById('blackCaptures').textContent = this.blackCaptures;
        document.getElementById('whiteCaptures').textContent = this.whiteCaptures;
        document.getElementById('blackCapturesSidebar').textContent = this.blackCaptures;
        document.getElementById('whiteCapturesSidebar').textContent = this.whiteCaptures;
        document.getElementById('komiDisplay').textContent = this.komi;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GoGame();
});
