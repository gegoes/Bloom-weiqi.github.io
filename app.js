const BOARD_SIZE = 19;
const MARGIN = 30;
const CELL_SIZE = (540) / (BOARD_SIZE - 1);
const BOARD_PIXEL = MARGIN * 2 + CELL_SIZE * (BOARD_SIZE - 1);

class GoGame {
    constructor() {
        this.board = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(null));
        this.currentPlayer = 'black'; // black first
        this.history = [];
        this.moveCount = 0;
        this.passCount = 0;
        
        this.svg = document.getElementById('board');
        this.svg.setAttribute('viewBox', `0 0 ${BOARD_PIXEL} ${BOARD_PIXEL}`);
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
        
        this.drawBoard();
        this.setupEventListeners();
        this.updateUI();
    }
    
    drawBoard() {
        // Draw grid lines
        for (let i = 0; i < BOARD_SIZE; i++) {
            // Horizontal
            const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            hLine.setAttribute('class', 'grid-line');
            hLine.setAttribute('x1', MARGIN);
            hLine.setAttribute('y1', MARGIN + i * CELL_SIZE);
            hLine.setAttribute('x2', MARGIN + (BOARD_SIZE - 1) * CELL_SIZE);
            hLine.setAttribute('y2', MARGIN + i * CELL_SIZE);
            this.svg.appendChild(hLine);
            
            // Vertical
            const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            vLine.setAttribute('class', 'grid-line');
            vLine.setAttribute('x1', MARGIN + i * CELL_SIZE);
            vLine.setAttribute('y1', MARGIN);
            vLine.setAttribute('x2', MARGIN + i * CELL_SIZE);
            vLine.setAttribute('y2', MARGIN + (BOARD_SIZE - 1) * CELL_SIZE);
            this.svg.appendChild(vLine);
        }
        
        // Draw star points (hoshi)
        const starPoints = [3, 9, 15];
        for (let i of starPoints) {
            for (let j of starPoints) {
                const star = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                star.setAttribute('class', 'star-point');
                star.setAttribute('cx', MARGIN + i * CELL_SIZE);
                star.setAttribute('cy', MARGIN + j * CELL_SIZE);
                star.setAttribute('r', 3);
                this.svg.appendChild(star);
            }
        }
        
        // Create click areas
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                hitArea.setAttribute('x', MARGIN + i * CELL_SIZE - CELL_SIZE / 2);
                hitArea.setAttribute('y', MARGIN + j * CELL_SIZE - CELL_SIZE / 2);
                hitArea.setAttribute('width', CELL_SIZE);
                hitArea.setAttribute('height', CELL_SIZE);
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
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
    }
    
    playMove(x, y) {
        if (this.board[x][y] !== null) return;
        
        // Save state for undo
        this.history.push({
            board: this.board.map(row => [...row]),
            currentPlayer: this.currentPlayer,
            moveCount: this.moveCount
        });
        
        // Place stone
        this.board[x][y] = this.currentPlayer;
        this.drawStone(x, y, this.currentPlayer);
        this.moveCount++;
        this.passCount = 0;
        
        // Switch player (simple version without full capture rules for speed)
        this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black';
        this.updateUI();
    }
    
    drawStone(x, y, color) {
        const stone = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        stone.setAttribute('class', `stone ${color}`);
        stone.setAttribute('cx', MARGIN + x * CELL_SIZE);
        stone.setAttribute('cy', MARGIN + y * CELL_SIZE);
        stone.setAttribute('r', CELL_SIZE * 0.42);
        stone.setAttribute('data-x', x);
        stone.setAttribute('data-y', y);
        this.svg.appendChild(stone);
    }
    
    pass() {
        this.history.push({
            board: this.board.map(row => [...row]),
            currentPlayer: this.currentPlayer,
            moveCount: this.moveCount
        });
        
        this.passCount++;
        this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black';
        this.updateUI();
        
        if (this.passCount >= 2) {
            setTimeout(() => {
                alert('Game ended by mutual pass');
            }, 100);
        }
    }
    
    undo() {
        if (this.history.length === 0) return;
        
        const prevState = this.history.pop();
        this.board = prevState.board;
        this.currentPlayer = prevState.currentPlayer;
        this.moveCount = prevState.moveCount;
        this.passCount = 0;
        
        // Remove last stones from display
        const stones = this.svg.querySelectorAll('.stone');
        stones.forEach(stone => {
            const sx = parseInt(stone.getAttribute('data-x'));
            const sy = parseInt(stone.getAttribute('data-y'));
            if (this.board[sx][sy] === null) {
                stone.remove();
            }
        });
        
        this.updateUI();
    }
    
    reset() {
        this.board = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(null));
        this.currentPlayer = 'black';
        this.history = [];
        this.moveCount = 0;
        this.passCount = 0;
        
        // Remove all stones
        const stones = this.svg.querySelectorAll('.stone');
        stones.forEach(stone => stone.remove());
        
        this.updateUI();
    }
    
    updateUI() {
        const turnText = document.getElementById('turnText');
        const moveCountEl = document.getElementById('moveCount');
        const indicator = document.querySelector('.stone-indicator');
        
        turnText.textContent = this.currentPlayer === 'black' ? "Black's turn" : "White's turn";
        moveCountEl.textContent = this.moveCount;
        
        indicator.className = 'stone-indicator ' + this.currentPlayer;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GoGame();
});
