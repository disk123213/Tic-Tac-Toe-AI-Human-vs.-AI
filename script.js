// 井字棋 — 人机对战（优化版）
// 功能：Alpha-Beta剪枝、难度选择、本地存储比分、响应式适配、加载反馈

// 1. UI元素分组（便于维护）
const UI = {
  board: document.getElementById('board'),
  cells: Array.from(document.querySelectorAll('.cell')),
  statusText: document.getElementById('statusText'),
  loadingSpinner: document.getElementById('loadingSpinner'),
  startBtn: document.getElementById('startBtn'),
  restartBtn: document.getElementById('restartBtn'),
  playerChoice: document.getElementById('playerChoice'),
  difficulty: document.getElementById('difficulty'),
  scores: {
    human: document.getElementById('humanScore'),
    ai: document.getElementById('aiScore'),
    draw: document.getElementById('drawScore')
  }
};

// 2. 游戏状态分组
const GameState = {
  board: Array(9).fill(null), // 'X' | 'O' | null
  human: 'X',
  ai: 'O',
  isHumanTurn: true,
  isActive: false,
  scores: { human: 0, ai: 0, draw: 0 }, // 实时比分
  difficulty: 'hard' // 当前难度
};

// 3. 常量（不可修改）
const CONST = {
  winningCombos: [ // 胜利组合
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ],
  aiDelay: 250, // AI落子延迟（ms，提升体验）
  mediumDepth: 3 // 中等难度Max深度
};

// 初始化：绑定事件+读取本地存储比分
(function init() {
  resetBoard();
  // 读取本地存储的历史比分
  const savedScores = localStorage.getItem('tictactoeScores');
  if (savedScores) {
    GameState.scores = JSON.parse(savedScores);
  }
  updateScoreboard();
  // 绑定按钮事件
  UI.startBtn.addEventListener('click', startGame);
  UI.restartBtn.addEventListener('click', resetScores);
  UI.cells.forEach(cell => cell.addEventListener('click', onCellClick));
})();

/**
 * 开始游戏：初始化参数+判断先手
 */
function startGame() {
  GameState.human = UI.playerChoice.value;
  GameState.ai = GameState.human === 'X' ? 'O' : 'X';
  GameState.difficulty = UI.difficulty.value;
  resetBoard();
  GameState.isActive = true;
  // X先手：人类选X则人类先，否则AI先
  GameState.isHumanTurn = (GameState.human === 'X');
  updateStatus(
    GameState.isHumanTurn ? `轮到你（${GameState.human}）` : '电脑思考中...',
    !GameState.isHumanTurn // AI先手时显示加载
  );
  // AI先手：延迟落子（避免瞬间落子，提升体验）
  if (!GameState.isHumanTurn) {
    setTimeout(() => aiMove(), CONST.aiDelay);
  }
}

/**
 * 重置棋盘（单局）：清空棋子+启用单元格
 */
function resetBoard() {
  GameState.board.fill(null);
  UI.cells.forEach(cell => {
    cell.textContent = '';
    cell.classList.remove('disabled');
    cell.style.background = ''; // 清除胜利高亮
  });
}

/**
 * 重置比分：需确认+清空本地存储
 */
function resetScores() {
  const isConfirm = confirm('确定要重置所有比分吗？此操作不可恢复');
  if (!isConfirm) return;
  GameState.scores = { human: 0, ai: 0, draw: 0 };
  localStorage.removeItem('tictactoeScores'); // 清空本地存储
  updateScoreboard();
  updateStatus('请选择棋子和难度，点击“开始游戏”');
}

/**
 * 点击单元格：人类落子逻辑
 * @param {Event} e - 点击事件
 */
function onCellClick(e) {
  // 游戏未激活/非人类回合/单元格已占用：不响应
  if (!GameState.isActive || !GameState.isHumanTurn) return;
  const idx = Number(e.currentTarget.dataset.index);
  if (GameState.board[idx]) return;

  // 人类落子
  placeMove(idx, GameState.human);
  // 检查游戏结果（胜利/平局）
  const result = evaluateGame(GameState.board);
  if (result) return endGame(result);

  // 切换到AI回合
  GameState.isHumanTurn = false;
  updateStatus('电脑思考中...', true); // 显示加载
  setTimeout(() => aiMove(), 200);
}

/**
 * 放置棋子：更新UI+游戏状态
 * @param {number} idx - 单元格索引（0-8）
 * @param {string} player - 落子玩家（'X'/'O'）
 */
function placeMove(idx, player) {
  GameState.board[idx] = player;
  const cell = UI.cells[idx];
  cell.textContent = player;
  cell.classList.add('disabled');
}

/**
 * AI落子：根据难度选择策略
 */
function aiMove() {
  let moveIndex;
  const emptyCells = emptyIndices(GameState.board);

  // 难度策略：简单（随机）→ 中等（有限深度）→ 困难（完全剪枝）
  switch (GameState.difficulty) {
    case 'easy':
      // 简单：随机选择空单元格
      moveIndex = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      break;
    case 'medium':
      // 中等：Minimax有限深度（3步预判）
      const mediumBest = minimaxWithDepth(
        GameState.board.slice(), 
        GameState.ai, 
        0, 
        CONST.mediumDepth
      );
      moveIndex = mediumBest?.index || emptyCells[0];
      break;
    case 'hard':
    default:
      // 困难：Minimax+Alpha-Beta剪枝（不可战胜）
      const hardBest = minimax(
        GameState.board.slice(), 
        GameState.ai, 
        0, 
        -Infinity, 
        Infinity
      );
      moveIndex = hardBest?.index || emptyCells[0];
      break;
  }

  // AI落子+检查结果
  placeMove(moveIndex, GameState.ai);
  const result = evaluateGame(GameState.board);
  if (result) return endGame(result);

  // 切换到人类回合
  GameState.isHumanTurn = true;
  updateStatus(`轮到你（${GameState.human}）`);
}

/**
 * 评估游戏结果：判断胜利/平局/未结束
 * @param {Array<string|null>} board - 当前棋盘状态
 * @returns {null|{winner: 'X'|'O'|'draw', combo?: number[]}} - 结果
 */
function evaluateGame(board) {
  // 检查胜利组合
  for (const combo of CONST.winningCombos) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], combo };
    }
  }
  // 检查平局（无空单元格）
  if (board.every(cell => cell !== null)) {
    return { winner: 'draw' };
  }
  // 未结束
  return null;
}

/**
 * 结束游戏：更新比分+显示结果+高亮胜利线
 * @param {Object} result - 游戏结果（evaluateGame返回值）
 */
function endGame(result) {
  GameState.isActive = false;

  // 更新比分+状态文本
  if (result.winner === 'draw') {
    updateStatus('平局 🎗️');
    GameState.scores.draw += 1;
  } else if (result.winner === GameState.human) {
    updateStatus('你赢了！🎉');
    GameState.scores.human += 1;
    highlightCombo(result.combo, 'win'); // 高亮胜利线
  } else {
    updateStatus('电脑获胜 😢');
    GameState.scores.ai += 1;
    highlightCombo(result.combo, 'lose'); // 高亮失败线
  }

  // 保存比分到本地存储+更新UI
  localStorage.setItem('tictactoeScores', JSON.stringify(GameState.scores));
  updateScoreboard();
}

/**
 * 高亮胜利组合：区分胜负颜色
 * @param {number[]} combo - 胜利单元格索引
 * @param {string} type - 结果类型（'win'/'lose'）
 */
function highlightCombo(combo, type) {
  if (!combo) return;
  combo.forEach(idx => {
    const cell = UI.cells[idx];
    // 胜利：绿色渐变；失败：红色渐变
    cell.style.background = type === 'win' 
      ? 'linear-gradient(90deg,#dcfce7,#bbf7d0)' 
      : 'linear-gradient(90deg,#fee2e2,#fecaca)';
  });
}

/**
 * 更新状态文本：支持加载动画切换
 * @param {string} text - 状态文本
 * @param {boolean} isLoading - 是否显示加载动画
 */
function updateStatus(text, isLoading = false) {
  UI.statusText.textContent = text;
  UI.loadingSpinner.style.display = isLoading ? 'inline-block' : 'none';
}

/**
 * 更新比分板：同步UI与游戏状态
 */
function updateScoreboard() {
  UI.scores.human.textContent = GameState.scores.human;
  UI.scores.ai.textContent = GameState.scores.ai;
  UI.scores.draw.textContent = GameState.scores.draw;
}

/**
 * 获取空单元格索引
 * @param {Array<string|null>} board - 当前棋盘状态
 * @returns {number[]} 空单元格索引数组
 */
function emptyIndices(board) {
  return board.map((val, idx) => val ? null : idx).filter(idx => idx !== null);
}

/**
 * Minimax算法（带Alpha-Beta剪枝）- 困难难度核心
 * @param {Array<string|null>} board - 当前棋盘
 * @param {string} player - 当前玩家
 * @param {number} depth - 递归深度（用于评分微调）
 * @param {number} alpha - 最大化玩家最优分
 * @param {number} beta - 最小化玩家最优分
 * @returns {{index?: number, score: number}} 最优落子+评分
 */
function minimax(board, player, depth, alpha, beta) {
  const result = evaluateGame(board);
  // 终局：返回评分（AI赢+10，人类赢-10，平局0；深度调节：优先快速赢/拖延输）
  if (result) {
    if (result.winner === 'draw') return { score: 0 };
    return { score: result.winner === GameState.ai ? 10 - depth : depth - 10 };
  }

  const moves = [];
  const emptyCells = emptyIndices(board);

  // 遍历所有空单元格，递归评估
  for (const idx of emptyCells) {
    const newBoard = board.slice();
    newBoard[idx] = player;
    // 切换玩家（AI→人类，人类→AI）
    const nextPlayer = player === 'X' ? 'O' : 'X';
    const evalResult = minimax(newBoard, nextPlayer, depth + 1, alpha, beta);
    moves.push({ index: idx, score: evalResult.score });

    // Alpha-Beta剪枝：减少无效递归（核心优化）
    if (player === GameState.ai) {
      // AI（最大化）：更新alpha，超过beta则剪枝
      alpha = Math.max(alpha, evalResult.score);
    } else {
      // 人类（最小化）：更新beta，低于alpha则剪枝
      beta = Math.min(beta, evalResult.score);
    }
    if (beta <= alpha) break; // 无需继续遍历，剪枝
  }

  // 选择最优落子（AI选最大分，人类选最小分）
  let bestMove;
  if (player === GameState.ai) {
    let bestScore = -Infinity;
    moves.forEach(move => {
      if (move.score > bestScore) {
        bestScore = move.score;
        bestMove = move;
      }
    });
  } else {
    let bestScore = Infinity;
    moves.forEach(move => {
      if (move.score < bestScore) {
        bestScore = move.score;
        bestMove = move;
      }
    });
  }
  return bestMove;
}

/**
 * Minimax有限深度版 - 中等难度核心
 * @param {Array<string|null>} board - 当前棋盘
 * @param {string} player - 当前玩家
 * @param {number} depth - 当前深度
 * @param {number} maxDepth - 最大深度（超过则停止）
 * @returns {{index?: number, score: number}} 最优落子+评分
 */
function minimaxWithDepth(board, player, depth, maxDepth) {
  const result = evaluateGame(board);
  // 终局或达到最大深度：返回评分
  if (result || depth >= maxDepth) {
    if (result) {
      if (result.winner === 'draw') return { score: 0 };
      return { score: result.winner === GameState.ai ? 10 - depth : depth - 10 };
    }
    return { score: 0 }; // 深度上限：视为平局（中立）
  }

  const moves = [];
  const emptyCells = emptyIndices(board);

  // 遍历空单元格，递归评估（无剪枝，简化中等难度计算）
  for (const idx of emptyCells) {
    const newBoard = board.slice();
    newBoard[idx] = player;
    const nextPlayer = player === 'X' ? 'O' : 'X';
    const evalResult = minimaxWithDepth(newBoard, nextPlayer, depth + 1, maxDepth);
    moves.push({ index: idx, score: evalResult.score });
  }

  // 选择最优落子（同minimax逻辑）
  let bestMove;
  if (player === GameState.ai) {
    let bestScore = -Infinity;
    moves.forEach(move => {
      if (move.score > bestScore) {
        bestScore = move.score;
        bestMove = move;
      }
    });
  } else {
    let bestScore = Infinity;
    moves.forEach(move => {
      if (move.score < bestScore) {
        bestScore = move.score;
        bestMove = move;
      }
    });
  }
  return bestMove;
}
