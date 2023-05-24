#version 300 es

#ifdef GL_ES
precision mediump float;
#endif

in vec2 ext_position;

void main() {
    gl_Position = vec4(ext_position, 0.0, 1.0);
}
