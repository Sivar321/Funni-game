(function() {
    const GG_ALL_GAME_CONFIG = {
        triangleSize: 20,
        triangleSpeed: 5,
        trailLength: 20,
        trailFadeSpeed: 0.05,
        bulletSpeed: 20,
        bulletSize: 5,
        bulletColor: "red",
        bulletFireRate: 20,
        usernameColor: "white",
        usernameFont: "12px Arial",
        usernameOffset: 30,
        enemySize: 20,
        enemyColor: "red",
        enemyBaseSpeed: 4,
        enemySpeedIncrease: 0.2,
        enemySpawnRate: 1600,
    };
    
    const MULTIPLAYER_CONFIG = { serverPeerId: 'server6' };

    const $ = document.querySelector.bind(document);
    const mainMenu = $('#mainMenu');
    const playButton = $('#playButton');
    const playMultiplayerBtn = $('#playMultiplayerBtn');
    const canvas = $('#gameCanvas');
    const ctx = canvas.getContext('2d');
    const mobileControls = $('#mobileControls');
    const moveJoystick = $('#moveJoystick');
    const shootJoystick = $('#shootJoystick');

    let triangle = { 
        x: 0, 
        y: 0, 
        dx: 0, 
        dy: 0, 
        angle: 0, 
        color: `rgb(${Math.random()*256|0},${Math.random()*256|0},${Math.random()*256|0})`, 
        username: "Player" 
    };

let playerBehaviorTracker = {
    movementPatterns: [],
    shotDirections: [],
    lastPositions: [],
    timeBetweenShots: [],
    dangerLevel: 1
};    

    let peer, connections = {}, isHost = false, hostConnection = null;
    let trail = [], bullets = [], shockwaves = [], players = {}, enemies = [];
    let gameStarted = false, mouseX = 0, mouseY = 0, isShooting = false;
    let lastBulletTime = 0, lastEnemySpawnTime = 0, enemiesKilled = 0;
    const BROADCAST_INTERVAL = 16; // ~60fps
let lastBroadcastTime = 0;
      let moveJoystickTouchId = null,
        shootJoystickTouchId = null;
        

      function startGame() {
        mainMenu.style.display = 'none';
        canvas.style.display = 'block';
        if ('ontouchstart' in window) {
          mobileControls.style.display = 'block';
          shootJoystick.style.display = 'flex';
        }
        gameStarted = true;
        resizeCanvas();
        resetGame();
        gameLoop();
        getUsernameAndStartGame();
      }

      function resetGame() {
        triangle.x = canvas.width / 2;
        triangle.y = canvas.height / 2;
        triangle.dx = 0;
        triangle.dy = 0;
        trail = [];
        bullets = [];
        shockwaves = [];
        enemies = [];
        enemiesKilled = 0;
        lastEnemySpawnTime = 0;
      }

      function getUsernameAndStartGame() {
        window.parent.postMessage({
          type: 'REQUEST_USER_HANDLE_EVENT'
        }, '*');
        window.addEventListener('message', function handleUserHandle(event) {
          const {
            type,
            handle
          } = event.data;
          if (type === 'RESPONSE_USER_HANDLE_EVENT') {
            triangle.username = handle;
            window.removeEventListener('message', handleUserHandle);
            gameLoop();
          }
        });
      }

      function createRoom() {
        isHost = true;
        peer = new Peer(MULTIPLAYER_CONFIG.serverPeerId);
        peer.on('open', id => {
          console.log('Host peer ID is: ' + id);
          startGame();
          peer.on('connection', handleNewConnection);
        });
        peer.on('error', error => {
          console.error('Error creating room:', error);
          joinRoom();
        });
      }

      function joinRoom() {
        isHost = false;
        peer = new Peer();
        peer.on('open', id => {
          console.log('Client peer ID is: ' + id);
          hostConnection = peer.connect(MULTIPLAYER_CONFIG.serverPeerId);
          hostConnection.on('open', () => {
            console.log('Connected to host');
            hostConnection.send({
              type: 'join',
              player: {
                ...triangle,
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height
              },
              peerId: id
            });
            startGame();
            setupDataHandling(hostConnection);
          });
        });
        peer.on('error', error => {
          console.error('Error joining room:', error);
          createRoom(); // Switch to create room if join room fails
        });
      }

      function playMultiplayer() {
        createRoom();
      }

      function handleNewConnection(conn) {
        console.log('New player connected:', conn.peer);
        connections[conn.peer] = conn;
        setupDataHandling(conn);
      }

      function setupDataHandling(conn) {
    conn.on('data', data => {
        if (data.type === 'update') {
            if (isHost) {
                players[conn.peer] = {
                    ...data.player,
                    lastUpdate: Date.now()
                };
            } else {
                players = data.players;
                enemies = data.enemies;
            }
        } else if (data.type === 'update') {
            players = data.players;
            enemies = data.enemies;
          }
        });
        conn.on('close', () => {
          if (isHost) {
            delete players[conn.peer];
            delete connections[conn.peer];
            broadcastGameState();
          }
        });
      }

function broadcastGameState() {
    const now = Date.now();
    if (isHost && now - lastBroadcastTime >= BROADCAST_INTERVAL) {
        players[peer.id] = triangle;
        const gameState = {
            type: 'update',
            players,
            enemies: enemies.map(e => ({...e})) // Send a clean copy of enemies
        };
        Object.values(connections).forEach(conn => {
            if (conn.open) conn.send(gameState);
            lastBroadcastTime = now;
        });
    }
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    triangle.x = canvas.width / 2; // Start triangle in the center
    triangle.y = canvas.height / 2;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Call it initially
    
    
function drawTriangle(player) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.moveTo(0, -GG_ALL_GAME_CONFIG.triangleSize); // Top point
    ctx.lineTo(-GG_ALL_GAME_CONFIG.triangleSize / 2, GG_ALL_GAME_CONFIG.triangleSize / 2); // Bottom left
    ctx.lineTo(GG_ALL_GAME_CONFIG.triangleSize / 2, GG_ALL_GAME_CONFIG.triangleSize / 2); // Bottom right
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    
    // Draw username
    ctx.fillStyle = GG_ALL_GAME_CONFIG.usernameColor;
    ctx.font = GG_ALL_GAME_CONFIG.usernameFont;
    ctx.textAlign = 'center';
    ctx.fillText(player.username, player.x, player.y - GG_ALL_GAME_CONFIG.usernameOffset);
}
    

      function drawTrail() {
        ctx.globalAlpha = 1;
        trail.forEach(segment => {
          ctx.beginPath();
          ctx.arc(segment.x, segment.y, GG_ALL_GAME_CONFIG.triangleSize / 4, 0, Math.PI * 2);
          ctx.fillStyle = segment.color.replace('rgb', 'rgba').replace(')', `,${segment.alpha})`);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
      }

      function drawBullets() {
        ctx.fillStyle = GG_ALL_GAME_CONFIG.bulletColor;
        bullets.forEach(bullet => {
          ctx.beginPath();
          ctx.arc(bullet.x, bullet.y, GG_ALL_GAME_CONFIG.bulletSize, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      function drawShockwaves() {
        shockwaves.forEach(shockwave => {
          ctx.beginPath();
          ctx.arc(shockwave.x, shockwave.y, shockwave.radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 255, 0, ${shockwave.alpha})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        });
      }

      function drawEnemies() {
        ctx.fillStyle = GG_ALL_GAME_CONFIG.enemyColor;
        enemies.forEach(enemy => {
          ctx.fillRect(enemy.x - GG_ALL_GAME_CONFIG.enemySize / 2, enemy.y - GG_ALL_GAME_CONFIG.enemySize / 2, GG_ALL_GAME_CONFIG.enemySize, GG_ALL_GAME_CONFIG.enemySize);
        });
      }

      function updatePosition() {
      if (!isHost && Object.keys(players).length > 1) {
    playerBehaviorTracker.movementPatterns.push({
        dx: triangle.dx,
        dy: triangle.dy,
        timestamp: Date.now()
    });   
    if (playerBehaviorTracker.movementPatterns.length > 100) {
        playerBehaviorTracker.movementPatterns.shift();
    }
    return;
}

          
        triangle.x += triangle.dx;
        triangle.y += triangle.dy;
        triangle.x = Math.max(GG_ALL_GAME_CONFIG.triangleSize / 2, Math.min(canvas.width - GG_ALL_GAME_CONFIG.triangleSize / 2, triangle.x));
        triangle.y = Math.max(GG_ALL_GAME_CONFIG.triangleSize / 2, Math.min(canvas.height - GG_ALL_GAME_CONFIG.triangleSize / 2, triangle.y));
        if (triangle.dx !== 0 || triangle.dy !== 0) {
          triangle.angle = Math.atan2(triangle.dy, triangle.dx) + Math.PI / 2;
          trail.unshift({
            x: triangle.x,
            y: triangle.y,
            color: triangle.color,
            alpha: 1
          });
          if (trail.length > GG_ALL_GAME_CONFIG.trailLength) trail.pop();
        }
        trail.forEach(segment => segment.alpha -= GG_ALL_GAME_CONFIG.trailFadeSpeed);
        trail = trail.filter(segment => segment.alpha > 0);
        bullets.forEach(bullet => {
          bullet.x += bullet.dx;
          bullet.y += bullet.dy;
        });
        bullets = bullets.filter(bullet => bullet.x > 0 && bullet.x < canvas.width && bullet.y > 0 && bullet.y < canvas.height);
        shockwaves.forEach(shockwave => {
          shockwave.radius += shockwave.speed;
          shockwave.alpha = 1 - (shockwave.radius / GG_ALL_GAME_CONFIG.shockwaveMaxRadius);
        });
        shockwaves = shockwaves.filter(shockwave => shockwave.alpha > 0);
          const enemySpeed = GG_ALL_GAME_CONFIG.enemyBaseSpeed
        enemies.forEach(enemy => {
          const dx = triangle.x - enemy.x;
          const dy = triangle.y - enemy.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          enemy.x += (dx / distance) * enemySpeed;
          enemy.y += (dy / distance) * enemySpeed;
          if (distance < GG_ALL_GAME_CONFIG.triangleSize + GG_ALL_GAME_CONFIG.enemySize / 2) {
            gameOver();
          }
        });
        bullets = bullets.filter(bullet => {
          let bulletHit = false;
          enemies = enemies.filter(enemy => {
            const dx = bullet.x - enemy.x;
            const dy = bullet.y - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < GG_ALL_GAME_CONFIG.bulletSize + GG_ALL_GAME_CONFIG.enemySize / 2) {
              bulletHit = true;
              enemiesKilled++;
              return false;
            }
            return true;
          });
          return !bulletHit;
        });
        const currentTime = Date.now();
        if (currentTime - lastEnemySpawnTime > GG_ALL_GAME_CONFIG.enemySpawnRate) {
          spawnEnemy();
          lastEnemySpawnTime = currentTime;
        }
      }

function spawnEnemy() {
    const recentMovements = playerBehaviorTracker.movementPatterns.slice(-10);
    const averageMovementDirection = calculateAverageMovementDirection(recentMovements);
    
    let x, y;
    if (playerBehaviorTracker.dangerLevel > 1) {
        x = triangle.x + (Math.random() * 200 - 100) * (Math.random() > 0.5 ? 1 : -1);
        y = triangle.y + (Math.random() * 200 - 100) * (Math.random() > 0.5 ? 1 : -1);
    } else {
        if (Math.random() < 0.5) {
            x = Math.random() < 0.5 ? 0 : canvas.width;
            y = Math.random() * canvas.height;
        } else {
            x = Math.random() * canvas.width;
            y = Math.random() < 0.5 ? 0 : canvas.height;
        }
    }
    
    adjustDifficulty();
    
    enemies.push({ x, y, size: GG_ALL_GAME_CONFIG.enemySize });
}

function calculateAverageMovementDirection(movements) {
}

function adjustDifficulty() {
    const shotFrequency = calculateShotFrequency();
    const movementComplexity = calculateMovementComplexity();
    
    playerBehaviorTracker.dangerLevel = 1 + 
        (shotFrequency * 0.5) + 
        (movementComplexity * 0.5);
}

function calculateShotFrequency() {
    if (playerBehaviorTracker.timeBetweenShots.length === 0) return 0;
    const avgTimeBetweenShots = playerBehaviorTracker.timeBetweenShots.reduce((a, b) => a + b, 0) / playerBehaviorTracker.timeBetweenShots.length;
    return avgTimeBetweenShots < 200 ? 1 : 0; // More frequent shots increase difficulty
}

function calculateMovementComplexity() {
    return Math.random(); // Placeholder
}
    

      function gameOver() {
        gameStarted = false;
        mainMenu.style.display = 'flex';
        canvas.style.display = 'none';
        mobileControls.style.display = 'none';
        shootJoystick.style.display = 'none';
        alert(`Game Over! You killed ${enemiesKilled} enemies.`);
        resetGame();
      }

      function gameLoop() {
        if (!gameStarted) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        updatePosition();
        drawTrail();
        drawBullets();
        drawShockwaves();
        drawEnemies();
        drawTriangle(triangle);
        Object.values(players).forEach(drawTriangle);
        if (isShooting) shootBullet();
        if (isHost) broadcastGameState();
        else sendPlayerUpdate();
        requestAnimationFrame(gameLoop);
      }
    
      function sendPlayerUpdate() {
        if (hostConnection && hostConnection.open) {
          hostConnection.send({
            type: 'update',
            player: triangle,
            peerId: peer.id
          });
        }
      }

      function handleKeyDown(e) {
        const speed = GG_ALL_GAME_CONFIG.triangleSpeed;
        switch (e.key) {
          case 'w':
          case 'W':
          case 'ArrowUp':
            triangle.dy = -speed;
            break;
          case 's':
          case 'S':
          case 'ArrowDown':
            triangle.dy = speed;
            break;
          case 'a':
          case 'A':
          case 'ArrowLeft':
            triangle.dx = -speed;
            break;
          case 'd':
          case 'D':
          case 'ArrowRight':
            triangle.dx = speed;
            break;
        }
      }

      function handleKeyUp(e) {
        switch (e.key) {
          case 'w':
          case 'W':
          case 's':
          case 'S':
          case 'ArrowUp':
          case 'ArrowDown':
            triangle.dy = 0;
            break;
          case 'a':
          case 'A':
          case 'd':
          case 'D':
          case 'ArrowLeft':
          case 'ArrowRight':
            triangle.dx = 0;
            break;
        }
      }

      function updateJoystick(touch, joystick, updateFunction) {
        const rect = joystick.getBoundingClientRect();
        const knob = joystick.querySelector('.joystick-knob');
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        let x = touch.clientX - rect.left;
        let y = touch.clientY - rect.top;
        let deltaX = x - centerX;
        let deltaY = y - centerY;
        const distance = Math.hypot(deltaX, deltaY);
        const maxDistance = rect.width / 2 - knob.offsetWidth / 2;
        if (distance > maxDistance) {
          const angle = Math.atan2(deltaY, deltaX);
          deltaX = Math.cos(angle) * maxDistance;
          deltaY = Math.sin(angle) * maxDistance;
        }
        knob.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        updateFunction(deltaX, deltaY, maxDistance);
      }

function shootBullet() {
    const currentTime = Date.now();
    
    // Check if enough time has passed since the last bullet
    if (currentTime - lastBulletTime < 1000 / GG_ALL_GAME_CONFIG.bulletFireRate) return;
    
    // Calculate bullet direction based on mouse position
    const angle = Math.atan2(mouseY - triangle.y, mouseX - triangle.x);
    
    // Track shot directions and timing
    playerBehaviorTracker.shotDirections.push({
        angle: angle,
        timestamp: currentTime
    });
    
    // Calculate time between shots
    if (playerBehaviorTracker.shotDirections.length > 1) {
        const lastShot = playerBehaviorTracker.shotDirections[playerBehaviorTracker.shotDirections.length - 2];
        playerBehaviorTracker.timeBetweenShots.push(currentTime - lastShot.timestamp);
    }
    
    // Limit stored shot directions
    if (playerBehaviorTracker.shotDirections.length > 50) {
        playerBehaviorTracker.shotDirections.shift();
    }
    
    // Create and add a new bullet
    const bullet = {
        x: triangle.x,
        y: triangle.y,
        dx: Math.cos(angle) * GG_ALL_GAME_CONFIG.bulletSpeed,
        dy: Math.sin(angle) * GG_ALL_GAME_CONFIG.bulletSpeed
    };
    
    bullets.push(bullet);
    
    // Update last bullet time
    lastBulletTime = currentTime;
}
    
      playButton.addEventListener('click', startGame);
      playMultiplayerBtn.addEventListener('click', playMultiplayer);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('mousemove', e => {
        mouseX = e.clientX;
        mouseY = e.clientY;
      });
      window.addEventListener('mousedown', e => {
        e.preventDefault();
        isShooting = true;
      });
      window.addEventListener('mouseup', e => {
        e.preventDefault();
        isShooting = false;
      });
      window.addEventListener('contextmenu', e => e.preventDefault());
      if ('ontouchstart' in window) {
        [moveJoystick, shootJoystick].forEach(joystick => {
          joystick.addEventListener('touchstart', e => {
            e.preventDefault();
            if ((joystick === moveJoystick && moveJoystickTouchId === null) ||
              (joystick === shootJoystick && shootJoystickTouchId === null)) {
              const touch = e.changedTouches[0];
              if (joystick === moveJoystick) moveJoystickTouchId = touch.identifier;
              else shootJoystickTouchId = touch.identifier;
              updateJoystick(touch, joystick, (dx, dy, max) => {
                if (joystick === moveJoystick) {
                  triangle.dx = (dx / max) * GG_ALL_GAME_CONFIG.triangleSpeed;
                  triangle.dy = (dy / max) * GG_ALL_GAME_CONFIG.triangleSpeed;
                } else {
                  mouseX = triangle.x + (dx / max) * canvas.width;
                  mouseY = triangle.y + (dy / max) * canvas.height;
                  isShooting = true;
                }
              });
            }
          });
          joystick.addEventListener('touchmove', e => {
            e.preventDefault();
            const touch = Array.from(e.changedTouches).find(t =>
              (joystick === moveJoystick && t.identifier === moveJoystickTouchId) ||
              (joystick === shootJoystick && t.identifier === shootJoystickTouchId)
            );
            if (touch) {
              updateJoystick(touch, joystick, (dx, dy, max) => {
                if (joystick === moveJoystick) {
                  triangle.dx = (dx / max) * GG_ALL_GAME_CONFIG.triangleSpeed;
                  triangle.dy = (dy / max) * GG_ALL_GAME_CONFIG.triangleSpeed;
                } else {
                  mouseX = triangle.x + (dx / max) * canvas.width;
                  mouseY = triangle.y + (dy / max) * canvas.height;
                }
              });
            }
          });
          joystick.addEventListener('touchend', e => {
            e.preventDefault();
            if (joystick === moveJoystick) {
              moveJoystickTouchId = null;
              triangle.dx = triangle.dy = 0;
            } else {
              shootJoystickTouchId = null;
              isShooting = false;
            }
            joystick.querySelector('.joystick-knob').style.transform = 'translate(0px, 0px)';
          });
          joystick.addEventListener('touchcancel', e => {
            e.preventDefault();
            if (joystick === moveJoystick) {
              moveJoystickTouchId = null;
              triangle.dx = triangle.dy = 0;
            } else {
              shootJoystickTouchId = null;
              isShooting = false;
            }
            joystick.querySelector('.joystick-knob').style.transform = 'translate(0px, 0px)';
          });
        });
      }
      document.body.addEventListener('touchmove', e => e.preventDefault(), {
        passive: false
      });
      window.addEventListener('beforeunload', () => {
        if (peer) {
          if (hostConnection && !isHost) {
            hostConnection.send({
              type: 'leave',
              peerId: peer.id
            });
          }
          peer.destroy();
        }
      });
    })();
