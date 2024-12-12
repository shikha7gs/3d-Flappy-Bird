import * as THREE from 'three';  
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.152.0/examples/jsm/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x70c5ce); 
scene.fog = new THREE.Fog(0x70c5ce, 0, 1000); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(-2, 1, 5); 
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0x404040, 0.8);  
scene.add(ambientLight);

const light = new THREE.DirectionalLight(0xffffff, 1.5);
light.position.set(-2, 2, 3).normalize();  
scene.add(light);

const light2 = new THREE.DirectionalLight(0xffffff, 0.5);
light2.position.set(2, -2, -3).normalize();  
scene.add(light2);

let bird;
let birdRadius = 0.5;

const loader = new GLTFLoader();
loader.load(
    '/flappy_bird.glb',
    function (gltf) {
        bird = gltf.scene;
        bird.scale.set(0.08, 0.08, 0.08);
        bird.rotation.y = Math.PI / 2;
        bird.position.set(-2, 0, 0);
        scene.add(bird);
        const bbox = new THREE.Box3().setFromObject(bird);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        birdRadius = maxDim / 2;
    },
    undefined,
    function (error) {
        console.error('An error happened while loading the glb model:', error);
    }
);

const obstacleWidth = 1;
const obstacleHeight = 10;
const obstacleGap = 2;
const obstacleSpeed = 0.02;
const obstacles = [];
let obstacleTimer = 0;
const obstacleInterval = 150;

let score = 0;
const scoreElement = document.getElementById('score');

let gameOver = false;
const gameOverElement = document.getElementById('gameOver');

let velocity = 0;
const gravity = -0.001;
const flapStrength = 0.03;

let yMin = 0;
let yMax = 0;
let visibleWidth = 0;

let ground, ceiling;

const wingSound = new Audio('/wing.mp3');
const pointSound = new Audio('/point.mp3');
const dieSound = new Audio('/die.mp3');
const swooshSound = new Audio('/swoosh.mp3');

function calculateBoundaries() {
    const distance = camera.position.z - 0;
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const visibleHeight = 2 * Math.tan(fov / 2) * distance;
    visibleWidth = visibleHeight * camera.aspect;

    yMin = -visibleHeight / 2;
    yMax = visibleHeight / 2;

    if (ground) {
        ground.position.y = yMin;
        ground.scale.x = visibleWidth;
    } else {
        const groundGeometry = new THREE.PlaneGeometry(visibleWidth, 1);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = yMin;
        scene.add(ground);
    }

    if (ceiling) {
        ceiling.position.y = yMax;
        ceiling.scale.x = visibleWidth;
    } else {
        const ceilingGeometry = new THREE.PlaneGeometry(visibleWidth, 1);
        const ceilingMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = yMax;
        scene.add(ceiling);
    }
}

calculateBoundaries();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    calculateBoundaries();
});

function flap() {
    if (!gameOver) {
        velocity = flapStrength;
        wingSound.play();
    }
}
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        flap();
        if (gameOver) restartGame();
    }
});
window.addEventListener('click', () => {
    flap();
    if (gameOver) restartGame();
});

function restartGame() {
    if (bird) {
        bird.position.y = 0;
    }
    velocity = 0;
    obstacles.forEach(obs => {
        scene.remove(obs.top);
        scene.remove(obs.bottom);
    });
    obstacles.length = 0;
    score = 0;
    scoreElement.textContent = score;
    gameOver = false;
    gameOverElement.style.display = 'none';
}

function createObstacle() {
    const minGapPos = yMin + obstacleGap / 2;
    const maxGapPos = yMax - obstacleGap / 2;
    const gapPosition = Math.random() * (maxGapPos - minGapPos) + minGapPos;

    const topGeometry = new THREE.BoxGeometry(obstacleWidth, obstacleHeight, 1);
    const topMaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
    const topObstacle = new THREE.Mesh(topGeometry, topMaterial);
    topObstacle.position.set(10, gapPosition + obstacleGap / 2 + obstacleHeight / 2, 0);
    scene.add(topObstacle);

    const bottomGeometry = new THREE.BoxGeometry(obstacleWidth, obstacleHeight, 1);
    const bottomMaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
    const bottomObstacle = new THREE.Mesh(bottomGeometry, bottomMaterial);
    bottomObstacle.position.set(10, gapPosition - obstacleGap / 2 - obstacleHeight / 2, 0);
    scene.add(bottomObstacle);

    obstacles.push({ top: topObstacle, bottom: bottomObstacle, passed: false, gapPosition });
    swooshSound.play();
}

function checkCollision() {
    if (!bird) return;

    const birdBbox = new THREE.Box3().setFromObject(bird);

    if (bird.position.y - birdRadius <= yMin || bird.position.y + birdRadius >= yMax) {
        dieSound.play();
        endGame();
    }

    obstacles.forEach(obs => {
        const topBbox = new THREE.Box3().setFromObject(obs.top);
        const bottomBbox = new THREE.Box3().setFromObject(obs.bottom);

        if (birdBbox.intersectsBox(topBbox) || birdBbox.intersectsBox(bottomBbox)) {
            dieSound.play();
            endGame();
        }
    });
}

function endGame() {
    gameOver = true;
    gameOverElement.style.display = 'block';
}

function animate() {
    requestAnimationFrame(animate);

    if (!gameOver && bird) {
        velocity += gravity;
        bird.position.y += velocity;

        obstacles.forEach(obs => {
            obs.top.position.x -= obstacleSpeed;
            obs.bottom.position.x -= obstacleSpeed;

            if (obs.top.position.x < -10) {
                scene.remove(obs.top);
                scene.remove(obs.bottom);
                obstacles.splice(obstacles.indexOf(obs), 1);
            }

            if (!obs.passed && obs.top.position.x < bird.position.x) {
                score += 1;
                scoreElement.textContent = score;
                pointSound.play();
                obs.passed = true;
            }
        });

        obstacleTimer++;
        if (obstacleTimer >= obstacleInterval) {
            createObstacle();
            obstacleTimer = 0;
        }

        checkCollision();
    }

    renderer.render(scene, camera);
}

animate();