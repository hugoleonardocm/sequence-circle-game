// Configurações do jogo
const config = {
    easy: {
        circleCount: 10,
        spawnDelay: 1000,
        timeToClick: 2000,
        hitZoneTolerance: 0.30
    },
    medium: {
        circleCount: 15,
        spawnDelay: 750,
        timeToClick: 1500,
        hitZoneTolerance: 0.25
    },
    hard: {
        circleCount: 20,
        spawnDelay: 600,
        timeToClick: 1200,
        hitZoneTolerance: 0.20
    },
    expert: {
        circleCount: 25,
        spawnDelay: 500,
        timeToClick: 1000,
        hitZoneTolerance: 0.15
    },
    insane: {
        circleCount: 30,
        spawnDelay: 300,
        timeToClick: 600,
        hitZoneTolerance: 0.10
    }
};

// Variáveis do jogo
let gameRunning = false;
let currentLevel;
let currentNumber = 0;
let nextClickNumber = 1;
let score = 0;
let lastCirclePos = null;
let circleElements = [];
let lineElements = [];
let countdownTimers = [];
let activeCircles = {};
let spawnTimer = null;
let isMobile = window.matchMedia("(max-width: 768px)").matches;
// Mapear linhas para círculos
let circleLines = {};
// Variável para controlar se o primeiro círculo já apareceu
let firstCircleSpawned = false;

// Referências aos elementos do DOM
const gameContainer = document.getElementById('game-container');
const levelSelect = document.getElementById('level-select');
const startButton = document.getElementById('start-button');
const scoreElement = document.getElementById('score');

// Carregar sons usando o Web Audio API para melhor compatibilidade
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Função para calcular tamanho dos círculos com base no contêiner
function calculateCircleSize() {
    const containerWidth = gameContainer.offsetWidth;
    const containerHeight = gameContainer.offsetHeight;
    const smallerDimension = Math.min(containerWidth, containerHeight);
    
    // Tamanho base para cada nível, agora como porcentagem do contêiner
    const baseSize = smallerDimension * (isMobile ? 0.20 : 0.14);
    
    // Retorna o tamanho calculado
    return baseSize;
}

// Função para tocar som
function playSound(buffer) {
    if (!buffer || !audioContext) return;
    
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
}

// Criar som de batida de porta (toc toc) - SUAVIZADO
function createKnockSound() {
    if (!audioContext || !gameRunning) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = 180;
    gainNode.gain.value = 0.15;
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
    
    setTimeout(() => oscillator.stop(), 100);
}

// Som de sucesso suavizado
function createSuccessSound() {
    if (!audioContext || !gameRunning) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = 120;
    gainNode.gain.value = 0.15;
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    
    gainNode.gain.setValueAtTime(0.02, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
    
    setTimeout(() => oscillator.stop(), 200);
}

// Som de falha mais suave
function createFailSound() {
    if (!audioContext || !gameRunning) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine'; 
    oscillator.frequency.value = 220;
    gainNode.gain.value = 0.15;
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    
    oscillator.frequency.linearRampToValueAtTime(180, audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.02, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
    
    setTimeout(() => oscillator.stop(), 300);
}

// Som de celebração para conclusão de nível
function createCelebrationSound() {
    if (!audioContext || !gameRunning) return;
    
    const playChord = (baseFreq, time, duration) => {
        const notes = [1, 1.25, 1.5];
        
        notes.forEach(interval => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            
            osc.type = 'sine';
            osc.frequency.value = baseFreq * interval;
            gain.gain.value = 0.1;
            
            osc.connect(gain);
            gain.connect(audioContext.destination);
            
            gain.gain.setValueAtTime(0, audioContext.currentTime + time);
            gain.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + time + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + time + duration);
            
            osc.start(audioContext.currentTime + time);
            osc.stop(audioContext.currentTime + time + duration);
        });
    };
    
    playChord(440, 0, 0.3);
    playChord(523.25, 0.25, 0.3);
    playChord(659.25, 0.5, 0.6);
}

// Prevenir comportamentos padrão de toque em dispositivos móveis
function preventDefaultTouchBehavior() {
    document.addEventListener('touchmove', function(e) {
        if (gameRunning) {
            e.preventDefault();
        }
    }, { passive: false });
    
    document.addEventListener('touchstart', function(e) {
        if (gameRunning && e.target.closest('#game-container')) {
            e.preventDefault();
        }
    }, { passive: false });
}

// Iniciar o jogo
function startGame() {
    // Iniciar contexto de áudio se necessário
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    // Reset do jogo
    resetGame();
    
    // Configurar o nível
    currentLevel = config[levelSelect.value];
    
    // Marcar o jogo como em execução
    gameRunning = true;
    startButton.disabled = true;
    
    // Redefinir o número para o próximo clique
    nextClickNumber = 1;
    firstCircleSpawned = false;
    
    // Iniciar o spawn de círculos
    spawnCircle();
}

// Resetar o jogo
function resetGame() {
    gameContainer.innerHTML = '';
    circleElements = [];
    lineElements = [];
    currentNumber = 0;
    nextClickNumber = 1;
    score = 0;
    scoreElement.textContent = score;
    lastCirclePos = null;
    activeCircles = {};
    circleLines = {}; // Resetar o mapeamento de linhas
    firstCircleSpawned = false;
    
    // Limpar todos os timers
    countdownTimers.forEach(timer => clearTimeout(timer));
    countdownTimers = [];
    if (spawnTimer) clearTimeout(spawnTimer);
}

// Função para atualizar o destaque visual do próximo círculo
function updateCircleHighlights() {
    // Remover todos os destaques
    document.querySelectorAll('.countdown-circle').forEach(circle => {
        circle.classList.remove('next', 'inactive');
    });
    
    // Adicionar destaque ao próximo círculo e desativar os outros
    document.querySelectorAll('.countdown-circle').forEach(circle => {
        const circleNumber = parseInt(circle.dataset.number);
        if (circleNumber === nextClickNumber) {
            circle.classList.add('next');
        } else if (circleNumber > nextClickNumber) {
            circle.classList.add('inactive');
        }
    });
}

// Gerar um círculo
function spawnCircle() {
    if (!gameRunning) return;
    
    // Calcular tamanho do círculo com base no tamanho do contêiner
    const circleSize = calculateCircleSize();
    
    currentNumber++;
    
    // Posição aleatória (com margem para o círculo caber na tela)
    const margin = circleSize;
    const x = margin + Math.random() * (gameContainer.offsetWidth - 2 * margin);
    const y = margin + Math.random() * (gameContainer.offsetHeight - 2 * margin);
    
    // Criar círculo principal
    const circle = document.createElement('div');
    circle.className = 'circle';
    circle.style.width = circleSize + 'px';
    circle.style.height = circleSize + 'px';
    circle.style.left = (x - circleSize / 2) + 'px';
    circle.style.top = (y - circleSize / 2) + 'px';
    circle.textContent = currentNumber;
    circle.dataset.number = currentNumber;
    gameContainer.appendChild(circle);
    circleElements.push(circle);
    
    // Criar círculo de contagem regressiva (agora clicável)
    const countdownCircle = document.createElement('div');
    countdownCircle.className = 'countdown-circle';
    // Adicionar classe 'inactive' se não for o próximo a ser clicado
    if (currentNumber !== nextClickNumber) {
        countdownCircle.classList.add('inactive');
    } else {
        countdownCircle.classList.add('next');
    }
    
    const countdownSize = circleSize * 2.5;
    countdownCircle.style.width = countdownSize + 'px';
    countdownCircle.style.height = countdownSize + 'px';
    countdownCircle.style.left = (x - countdownSize / 2) + 'px';
    countdownCircle.style.top = (y - countdownSize / 2) + 'px';
    countdownCircle.dataset.number = currentNumber;
    
    // Adicionar eventos para desktop e mobile
    countdownCircle.addEventListener('click', handleCircleClick);
    countdownCircle.addEventListener('touchstart', handleCircleClick, { passive: false });
    
    gameContainer.appendChild(countdownCircle);

    const startDelay = 500; // Atraso inicial para o primeiro círculo
    const timeToClick = currentNumber === 1 ? currentLevel.timeToClick + startDelay : currentLevel.timeToClick;
    
    // Registrar círculo ativo
    activeCircles[currentNumber] = {
        startTime: Date.now(),
        duration: timeToClick, // Usando o tempo ajustado
        element: circle,
        countdownElement: countdownCircle,
        position: { x, y },
        progress: 0,
        clicked: false,
        size: circleSize
    };
    
    // Inicializar o array de linhas para este círculo se não existir
    if (!circleLines[currentNumber]) {
        circleLines[currentNumber] = [];
    }
    
    // Desenhar linha conectando com o círculo anterior
    if (lastCirclePos) {
        const lineElement = drawLine(lastCirclePos.x, lastCirclePos.y, x, y);
        
        // Armazenar a linha para referência futura
        // Cada linha é conectada ao círculo atual e ao anterior
        const previousCircleNumber = currentNumber - 1;
        
        // Associar a linha aos círculos que ela conecta
        if (!circleLines[previousCircleNumber]) {
            circleLines[previousCircleNumber] = [];
        }
        
        circleLines[previousCircleNumber].push(lineElement);
        circleLines[currentNumber].push(lineElement);
    }
    
    // Salvar posição atual para a próxima linha
    lastCirclePos = { x, y };
    
    // Iniciar animação de contagem regressiva
    animateCountdown(currentNumber);
    
    // Tocar som de batida inicial
    createKnockSound();
    
    // Agendar o próximo círculo se não for o último
    if (currentNumber < currentLevel.circleCount) {
        // CORREÇÃO: Se for o primeiro círculo, adicionar um atraso extra para o segundo círculo
        // Isso dará ao jogador tempo suficiente para clicar no primeiro antes que o segundo apareça
        let nextSpawnDelay = currentLevel.spawnDelay;
        
        if (currentNumber === 1) {
            nextSpawnDelay += startDelay;
        }
        
        spawnTimer = setTimeout(spawnCircle, nextSpawnDelay);
    } else {
        // Todos os círculos foram gerados, aguardar finalização
        const lastCircleTime = activeCircles[currentNumber].duration;
        spawnTimer = setTimeout(() => {
            if (gameRunning) {
                endGame(true);
            }
        }, lastCircleTime + 1000); // Usar o tempo do último círculo
    }
    
    // Marcar que o primeiro círculo já foi criado
    if (currentNumber === 1) {
        firstCircleSpawned = true;
    }
}

// Animar o círculo de contagem regressiva
function animateCountdown(circleNumber) {
    if (!activeCircles[circleNumber] || !gameRunning) return;
    
    const circleData = activeCircles[circleNumber];
    const now = Date.now();
    const elapsed = now - circleData.startTime;
    const progress = Math.min(elapsed / circleData.duration, 1);
    
    circleData.progress = progress;
    
    if (progress < 1 && !circleData.clicked) {
        // Calcular novo tamanho do círculo de contagem
        const startSize = circleData.size * 2.5;
        const targetSize = circleData.size;
        const newSize = startSize - (startSize - targetSize) * progress;
        
        // Atualizar tamanho do círculo de contagem
        circleData.countdownElement.style.width = newSize + 'px';
        circleData.countdownElement.style.height = newSize + 'px';
        
        // Centralizar o círculo
        circleData.countdownElement.style.left = (circleData.position.x - newSize / 2) + 'px';
        circleData.countdownElement.style.top = (circleData.position.y - newSize / 2) + 'px';
        
        // Tocar o som de batida a cada porcentagem do tempo (ajustada pelo nível)
        const knockInterval = circleData.duration <= 1000 ? 400 : 
                             (circleData.duration <= 1500 ? 450 : 
                             (circleData.duration <= 2000 ? 500 : 
                             (circleData.duration <= 3000 ? 600 : 700)));
                            
        if (Math.floor(elapsed / knockInterval) !== Math.floor((elapsed - 16) / knockInterval)) {
            createKnockSound();
        }
        
        // Continuar animação
        requestAnimationFrame(() => animateCountdown(circleNumber));
    } else if (!circleData.clicked) {
        // Tempo esgotado, marcar como errado
        circleData.countdownElement.remove();
        circleData.element.style.opacity = '0.4';
        
        // Se era o próximo círculo a ser clicado, avançar para o próximo
        if (circleNumber === nextClickNumber) {
            nextClickNumber++;
            updateCircleHighlights(); // Atualizar destaque visual
        }
        
        // Mostrar indicador de erro
        showResultIndicator(circleData.position.x, circleData.position.y, 'miss');
        createFailSound();
        
        // Remover dos círculos ativos
        delete activeCircles[circleNumber];
        
        // Finalizar o jogo como falha
        gameOver();
    }
}

// Mostrar indicador de resultado (perfect, good, miss)
function showResultIndicator(x, y, result) {
    const indicator = document.createElement('div');
    indicator.className = `result-indicator ${result}`;
    
    if (result === 'perfect') {
        indicator.textContent = 'PERFEITO!';
    } else if (result === 'good') {
        indicator.textContent = 'BOM!';
    } else {
        indicator.textContent = 'ERROU!';
    }
    
    // Ajustar posição com base no tamanho da tela
    const offset = isMobile ? 30 : 50;
    indicator.style.left = (x - offset) + 'px';
    indicator.style.top = (y - offset) + 'px';
    gameContainer.appendChild(indicator);
    
    // Animação de aparecimento
    setTimeout(() => {
        indicator.style.opacity = '1';
        indicator.style.transform = 'translateY(-20px)';
    }, 10);
    
    // Remover após animação
    setTimeout(() => {
        indicator.style.opacity = '0';
        setTimeout(() => indicator.remove(), 300);
    }, 800);
}

// Desenhar uma linha entre dois pontos
function drawLine(x1, y1, x2, y2) {
    const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const angle = Math.atan2(y2 - y1, x2 - x1);
    
    const line = document.createElement('div');
    line.className = 'line';
    line.style.width = distance + 'px';
    line.style.height = '2px';
    line.style.left = x1 + 'px';
    line.style.top = y1 + 'px';
    line.style.transform = `rotate(${angle}rad)`;
    
    gameContainer.appendChild(line);
    lineElements.push(line);
    
    return line; // Retornar a referência da linha para uso no mapeamento
}

// Função para remover linhas ligadas a um círculo
function removeConnectedLines(circleNumber) {
    // Verificar se há linhas associadas a este círculo
    if (circleLines[circleNumber] && circleLines[circleNumber].length > 0) {
        // Remover cada linha associada
        circleLines[circleNumber].forEach(line => {
            // Adicionar classe para animação de desaparecimento
            line.style.opacity = '0';
            line.style.transform += ' scale(0.5)';
            
            // Remover do DOM após a animação
            setTimeout(() => {
                if (line && line.parentNode) {
                    line.remove();
                }
            }, 300);
        });
        
        // Remover referências das linhas para este círculo
        circleLines[circleNumber] = [];
    }
}

// Tratamento do clique no círculo
function handleCircleClick(event) {
    // Evitar comportamento padrão para garantir funcionamento em touch devices
    event.preventDefault();
    event.stopPropagation();
    
    const clickedNumber = parseInt(event.target.dataset.number);
    
    // Verificar se o círculo está ativo e é o próximo a ser clicado
    if (activeCircles[clickedNumber] && !activeCircles[clickedNumber].clicked && clickedNumber === nextClickNumber) {
        const circleData = activeCircles[clickedNumber];
        circleData.clicked = true;
        
        // Remover as linhas conectadas a este círculo
        removeConnectedLines(clickedNumber);
        
        // Calcular a precisão do clique
        const progress = circleData.progress;
        const hitZoneStart = 1 - currentLevel.hitZoneTolerance * 2;
        const perfectZoneStart = 1 - currentLevel.hitZoneTolerance;
        
        let result, points;
        
        if (progress >= perfectZoneStart && progress <= 1) {
            // Acerto perfeito (timing perfeito)
            result = 'perfect';
            points = 30;
            createSuccessSound();
        } else if (progress >= hitZoneStart) {
            // Acerto bom (dentro da zona de acerto)
            result = 'good';
            points = 15;
            createSuccessSound();
        } else {
            // Acerto ruim (muito cedo)
            result = 'miss';
            points = 0;
            createFailSound();
            
            // Finalizar o jogo como falha se clicou cedo demais
            setTimeout(() => gameOver(), 800);
        }
        
        // Avançar para o próximo número a ser clicado
        nextClickNumber++;
        updateCircleHighlights(); // Atualizar destaque visual
        
        // Atualizar pontuação
        score += points;
        scoreElement.textContent = score;
        
        // Mostrar indicador de resultado
        showResultIndicator(circleData.position.x, circleData.position.y, result);
        
        // Remover elementos visuais com animação
        circleData.countdownElement.style.opacity = '0';
        circleData.countdownElement.style.transform = 'scale(0.5)';
        
        // Remover elementos do DOM após a animação
        setTimeout(() => {
            circleData.countdownElement.remove();
            circleData.element.remove();
        }, 300);
        
        // Remover dos círculos ativos
        delete activeCircles[clickedNumber];
        
        // Se foi o último número, encerrar o jogo
        if (result !== 'miss' && clickedNumber === currentLevel.circleCount && Object.keys(activeCircles).length === 0) {
            setTimeout(() => endGame(true), 1000);
        }
    }
}

// Finalizar o jogo como falha (Game Over)
function gameOver() {
    gameRunning = false;
    
    // Limpar todos os timers
    countdownTimers.forEach(timer => clearTimeout(timer));
    if (spawnTimer) clearTimeout(spawnTimer);
    
    // Desativar cliques nos círculos restantes
    Object.values(activeCircles).forEach(circleData => {
        circleData.countdownElement.style.pointerEvents = 'none';
    });
    
    // Criar overlay de Game Over
    const gameOverOverlay = document.createElement('div');
    gameOverOverlay.className = 'game-over';
    gameOverOverlay.innerHTML = `
        <div>GAME OVER</div>
        <span>Sua pontuação: ${score}</span>
        <button id="restart-button">Tentar Novamente</button>
    `;
    gameContainer.appendChild(gameOverOverlay);
    startButton.disabled = false;
    
    // Configurar botão de reinício
    document.getElementById('restart-button').addEventListener('click', () => {
        gameOverOverlay.remove();
        resetGame();
    });
    
    // Som de falha mais suave (apenas um som)
    createFailSound();
}

// Finalizar o jogo com sucesso
function endGame(success) {
    gameRunning = false;
    startButton.disabled = false;
    
    if (success) {
        // Substituir o alert por um overlay de sucesso
        const successOverlay = document.createElement('div');
        successOverlay.className = 'success-overlay';
        
        // Pegar o nome do nível atual
        const levelName = levelSelect.options[levelSelect.selectedIndex].text;
        
        successOverlay.innerHTML = `
            <div class="title">PARABÉNS!</div>
            <div class="message">Você completou o nível ${levelName}</div>
            <div class="message">com ${score} pontos!</div>
            <button id="continue-button">Continuar</button>
        `;
        
        gameContainer.appendChild(successOverlay);
        
        // Tocar som de celebração
        createCelebrationSound();
        
        // Configurar botão de continuar
        document.getElementById('continue-button').addEventListener('click', () => {
            successOverlay.remove();
            resetGame();
        });
    }
}

// Eventos
startButton.addEventListener('click', startGame);
document.onkeydown = function(event) {
    if (event.key === 'Enter') {
        startGame();
    }
};