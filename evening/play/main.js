// CONSTANTS
const radius = 0.175;
const gravity = -3.0;
const upwards_acceleration = 24.0;
const starting_height = 1.0 - radius;

const first_cycle_duration = Math.sqrt(2.0 * (radius - starting_height) / gravity);
const velocity_after_first_cycle = first_cycle_duration * gravity;
const second_cycle_duration = -velocity_after_first_cycle / upwards_acceleration;
const position_after_second_cycle = 0.5 * upwards_acceleration * Math.pow(second_cycle_duration, 2.0) + velocity_after_first_cycle * second_cycle_duration + radius;
const third_cycle_duration = Math.sqrt(2.0 * (radius - position_after_second_cycle) / upwards_acceleration);
const velocity_after_third_cycle = third_cycle_duration * upwards_acceleration;
const fourth_cycle_duration = -velocity_after_third_cycle / gravity;
const cycle_duration = first_cycle_duration + second_cycle_duration + third_cycle_duration + fourth_cycle_duration;

const shine_offset = 0.375;
const max_dist_from_shine = Math.sqrt(1.0 - shine_offset);

const bounce = new Audio("evening/play/bounce.mp3");

// dubious hack to ensure the animation and audio are synced on startup
var g_performanceNowOnStart = -1;

// WEBGL UTILS
function compileShader(glContext, shaderType, shaderSource) {
    const shader = glContext.createShader(shaderType);
    glContext.shaderSource(shader, shaderSource);
    glContext.compileShader(shader);

    if(glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
        return shader;
    }

    console.log("Failed to compile shader!");
    console.log(glContext.getShaderInfoLog(shader));
    console.log("Shader source:");
    console.log(shaderSource);
    return null;
}

function createGlProgram(glContext, fragShaderSource, vertShaderSource) {
    const fragShader = compileShader(glContext, glContext.FRAGMENT_SHADER, fragShaderSource);
    const vertShader = compileShader(glContext, glContext.VERTEX_SHADER, vertShaderSource)

    const glProgram = glContext.createProgram();
    glContext.attachShader(glProgram, fragShader);
    glContext.attachShader(glProgram, vertShader);
    glContext.linkProgram(glProgram);

    glContext.deleteShader(fragShader);
    glContext.deleteShader(vertShader);

    if(glContext.getProgramParameter(glProgram, glContext.LINK_STATUS)) {
        return glProgram;
    }

    console.log("Failed to create Gl program!");
    console.log(glContext.getProgramInfoLog(glProgram));
    glContext.deleteProgram(glProgram);
    return null;
}

function initializeGlExternalFloat(glContext, glProgram, name, value) {
    const glExternalFloat = glContext.getUniformLocation(glProgram, name);
    glContext.uniform1f(glExternalFloat, value);
}

function initializePhysicsConstants(glContext, glProgram) {
    initializeGlExternalFloat(glContext, glProgram, "ext_ball_radius", radius);
    initializeGlExternalFloat(glContext, glProgram, "ext_gravity", gravity);
    initializeGlExternalFloat(glContext, glProgram, "ext_upwards_acceleration", upwards_acceleration);
    initializeGlExternalFloat(glContext, glProgram, "ext_starting_height", starting_height);
    initializeGlExternalFloat(glContext, glProgram, "ext_first_cycle_duration", first_cycle_duration);
    initializeGlExternalFloat(glContext, glProgram, "ext_velocity_after_first_cycle", velocity_after_first_cycle);
    initializeGlExternalFloat(glContext, glProgram, "ext_second_cycle_duration", second_cycle_duration);
    initializeGlExternalFloat(glContext, glProgram, "ext_position_after_second_cycle", position_after_second_cycle);
    initializeGlExternalFloat(glContext, glProgram, "ext_third_cycle_duration", third_cycle_duration);
    initializeGlExternalFloat(glContext, glProgram, "ext_velocity_after_third_cycle", velocity_after_third_cycle);
    initializeGlExternalFloat(glContext, glProgram, "ext_fourth_cycle_duration", fourth_cycle_duration);
    initializeGlExternalFloat(glContext, glProgram, "ext_cycle_duration", cycle_duration);
    initializeGlExternalFloat(glContext, glProgram, "ext_shine_offset", shine_offset);
    initializeGlExternalFloat(glContext, glProgram, "ext_max_dist_from_shine", max_dist_from_shine);
}

function initializeFlatVertexShader(glContext, positionBuffer) {
    const twoTriangles = new Float32Array([
        -1.0, -1.0,
        -1.0, 1.0,
        1.0, 1.0,

        -1.0, -1.0,
        1.0, -1.0,
        1.0, 1.0
    ]);

    glContext.bindBuffer(glContext.ARRAY_BUFFER, positionBuffer);
    glContext.bufferData(glContext.ARRAY_BUFFER, twoTriangles, glContext.STATIC_DRAW);
}

function initializeGlProgram(glContext, glProgram, positionBuffer) {
    glContext.useProgram(glProgram);

    initializePhysicsConstants(glContext, glProgram);
    initializeFlatVertexShader(glContext, positionBuffer);
}

// SOUND UTILITIES
var playSound = false;

// wrap bounce.play() in a useless function, since otherwise we get cursed invalid invocation errors
function playBounce() {
    if(playSound) {
        bounce.play()
    }
}

// play the bounce once per loop...
function setBounceSoundLoop() {
    setInterval(playBounce, cycle_duration * 1000);
}

// starting right when the ball first hits the ground
function startBounceSoundLoop() {
    bounce.volume = 0.4;
    setTimeout(setBounceSoundLoop, first_cycle_duration * 1000 - 100);
}

function toggleSound() {
    playSound = !playSound;
}

// CONFIG UTILITIES
var configHidden = false;

function toggleConfigHidden() {
    if(!configHidden) {
        const focusButton = document.getElementById("focusButton");
        focusButton.innerText = "Config";
        focusButton.classList.add("focusButtonHidden");

        document.getElementById("soundToggle").classList.add("hidden");
        document.getElementById("fileLink").classList.add("hidden");
    }
    else {
        const focusButton = document.getElementById("focusButton");
        focusButton.innerText = "Focus";
        focusButton.classList.remove("focusButtonHidden");

        document.getElementById("soundToggle").classList.remove("hidden");
        document.getElementById("fileLink").classList.remove("hidden");
    }
    configHidden = !configHidden;
}

// MAIN FUNCTION
async function start(soundEnabled) {
    const canvas = document.getElementById("glCanvas");
    const glContext = canvas.getContext("webgl2");
    if(glContext === null) {
        alert("Your browser doesn't support WebGL!");
        return;
    }

    const [fragShaderSource, vertShaderSource] = await Promise.all([
        fetch("evening/play/ball.frag").then(res => res.text()),
        fetch("evening/play/ball.vert").then(res => res.text())
    ]);
    var positionBuffer = glContext.createBuffer();

    const glProgram = createGlProgram(glContext, fragShaderSource, vertShaderSource);
    initializeGlProgram(glContext, glProgram, positionBuffer);

    const extPosition = glContext.getAttribLocation(glProgram, "ext_position");
    const glExternalTime = glContext.getUniformLocation(glProgram, "ext_time");
    const glExternalRes = glContext.getUniformLocation(glProgram, "ext_res");

    function render() {
        glContext.clearColor(1.0, 1.0, 1.0, 1.0);
        glContext.clear(glContext.COLOR_BUFFER_BIT);

        canvas.height = window.innerHeight;
        canvas.width = window.innerWidth;
        glContext.viewport(0, 0, canvas.width, canvas.height);

        glContext.useProgram(glProgram);
        glContext.uniform1f(glExternalTime, (performance.now() - g_performanceNowOnStart) / 1000.0);
        glContext.uniform2f(glExternalRes, canvas.width, canvas.height);

        glContext.bindBuffer(glContext.ARRAY_BUFFER, positionBuffer);
        glContext.enableVertexAttribArray(extPosition);
        glContext.vertexAttribPointer(extPosition, 2, glContext.FLOAT, false, 0, 0);
        glContext.drawArrays(glContext.TRIANGLES, 0, 6);

        requestAnimationFrame(render);
    }

    g_performanceNowOnStart = performance.now();
    if(soundEnabled) {
        startBounceSoundLoop();
    }
    requestAnimationFrame(render);
}

document.getElementById("checkbox").addEventListener("click", toggleSound);

start(true);
