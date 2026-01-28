let gl: WebGL2RenderingContext | null = null;
let canvas: HTMLCanvasElement | null = null;
let animationId: number = 0;
let startTime: number = 0;

// Stress Shader (Lava Lamp / Raymarching Heavy Load)
// We intentionally do redundant calculations to heat up the GPU
const vsSource = `#version 300 es
in vec4 position;
void main() {
  gl_Position = position;
}
`;

const fsSource = `#version 300 es
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
out vec4 fragColor;

// Artificial load function
float heavyMath(vec2 p) {
    float v = 0.0;
    // Increased iterations from 100 to 2000 for maximum stress
    for (int i = 0; i < 20000; i++) { 
        // Complex non-linear operations that are hard to optimize
        v += sin(p.x * 10.0 + uTime + float(i)) * cos(p.y * 10.0 - uTime + float(i));
        v = log(abs(v) + 1.0) * sqrt(abs(v)) * tan(v * 0.1); 
        v += pow(abs(sin(v)), 1.5);
    }
    return v;
}

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    
    // Create swirling lava effect
    float v = 0.0;
    vec2 p = uv * 5.0;
    
    // Add multiple layers of noise
    v += sin(p.x + uTime);
    v += sin((p.y + uTime) / 2.0);
    v += sin((p.x + p.y + uTime) / 2.0);
    
    // Run hidden heavy load
    float stress = heavyMath(uv);
    
    // Visual output (Lava colors)
    vec3 col = vec3(0.0);
    col.r = sin(v * 3.14 + uTime) * 0.5 + 0.5;
    col.g = sin(v * 3.14 + uTime * 0.5) * 0.2;
    col.b = stress * 0.0001; // Tiny contribution from stress to prevent optimization
    
    // Heat map gradient
    col = mix(vec3(0.1, 0.0, 0.0), vec3(1.0, 0.2, 0.0), col.r);
    
    fragColor = vec4(col, 1.0);
}
`;

export const initGPU = (canvasElement: HTMLCanvasElement) => {
    canvas = canvasElement;
    gl = canvas.getContext('webgl2');

    if (!gl) {
        console.error("WebGL2 not supported");
        return null;
    }

    const program = createProgram(gl, vsSource, fsSource);
    if (!program) return null;

    gl.useProgram(program);

    // Full screen quad
    const positions = new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        -1, 1,
        1, -1,
        1, 1,
    ]);

    const positionAttributeLocation = gl.getAttribLocation(program, "position");
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    const timeLocation = gl.getUniformLocation(program, "uTime");
    const resolutionLocation = gl.getUniformLocation(program, "uResolution");

    const render = (time: number) => {
        if (!gl || !canvas) return;

        // Resize
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);

        // Update Uniforms
        gl.uniform1f(timeLocation, (time - startTime) * 0.001);
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

        // Draw
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // Force flush to ensure GPU processes commands immediately
        gl.flush();
        gl.finish(); // Extremely strict sync (bad for perf, good for stress)

        animationId = requestAnimationFrame(render);
    };

    return {
        start: () => {
            if (animationId) cancelAnimationFrame(animationId);
            startTime = performance.now();
            render(startTime);
        },
        stop: () => {
            if (animationId) cancelAnimationFrame(animationId);
            animationId = 0;
            // Clear to black
            if (gl) {
                gl.clearColor(0, 0, 0, 1);
                gl.clear(gl.COLOR_BUFFER_BIT);
            }
        }
    };
};

function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vertexShader || !fragmentShader) return null;

    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}
