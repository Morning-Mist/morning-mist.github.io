#version 300 es

#ifdef GL_ES
precision highp float;
#endif

out vec4 fragColor;

uniform highp float ext_time;
uniform vec2 ext_res;

vec2 g_red_hs = vec2(355.0 / 360.0, 0.9);

vec3 g_red = vec3(255.0 / 255.0, 25.0 / 255.0, 45.0 / 255.0);
vec4 g_white = vec4(0.75, 0.75, 0.75, 1.0);

uniform float ext_ball_radius;
uniform float ext_gravity;
uniform float ext_upwards_acceleration;
uniform float ext_starting_height;

uniform float ext_first_cycle_duration;
uniform float ext_velocity_after_first_cycle;
uniform float ext_second_cycle_duration;
uniform float ext_position_after_second_cycle;
uniform float ext_third_cycle_duration;
uniform float ext_velocity_after_third_cycle;
uniform float ext_fourth_cycle_duration;
uniform float ext_cycle_duration;

uniform float ext_shine_offset;
uniform float ext_max_dist_from_shine;

float get_first_cycle_position(float first_cycle_time) {
    return 0.5 * ext_gravity * pow(first_cycle_time, 2.0) + ext_starting_height;
}

float get_second_cycle_position(float second_cycle_time) {
    return 0.5 * ext_upwards_acceleration * pow(second_cycle_time, 2.0) + ext_velocity_after_first_cycle * second_cycle_time + ext_ball_radius;
}

float get_third_cycle_position(float third_cycle_time) {
    return 0.5 * ext_upwards_acceleration * pow(third_cycle_time, 2.0) + ext_position_after_second_cycle;
}

float get_fourth_cycle_position(float fourth_cycle_time) {
    return 0.5 * ext_gravity * pow(fourth_cycle_time, 2.0) + ext_velocity_after_third_cycle * fourth_cycle_time + ext_ball_radius;
}

float get_vertical_position() {
    // our model for elasticity is as follows:
    // when not touching the ground (y > radius), uniformly accelerate downward
    // when touching the ground (y <= radius), uniformly accelerate upward
    // this gives the "squish and bounce" effect

    // this calculation would be very simple in a physics engine,
    // where we can store the previous state and increment it on each tick
    // without that, we need to find the position as a function of time
    
    // to this end: the ball will go through four cycles:
    // - falling from y=starting_height to y=radius, accelerating downward
    // - falling from y=radius to some "compressed" height, accelerating upward
    // - rising from "compressed" height to y=radius, accelerating upward
    // - rising from y=radius to y=starting_height, accelerating downward
    
    // the durations for all of these cycles are given above
    float cycle_time = mod(ext_time, ext_cycle_duration);
    if(cycle_time < ext_first_cycle_duration) {
        return get_first_cycle_position(cycle_time);
    }

    cycle_time -= ext_first_cycle_duration;
    if(cycle_time < ext_second_cycle_duration) {
        return get_second_cycle_position(cycle_time);
    }

    cycle_time -= ext_second_cycle_duration;
    if(cycle_time < ext_third_cycle_duration) {
        return get_third_cycle_position(cycle_time);
    }
    else {
        return get_fourth_cycle_position(cycle_time - ext_third_cycle_duration);
    }
}

void main() {
    // set default color to white
    //fragColor = vec4(1.0);

    // ensure a circle, rather than an ellipse, by using the minimum dimension
    float min_dimension = min(ext_res.x, ext_res.y);

    // get current center of the ball
    float vertical_position = get_vertical_position();
    vec2 circle_center = vec2(0.5, vertical_position) * ext_res / vec2(min_dimension);

    // turn the circle into an ellipse if it needs to squish against the ground
    float squish_distance = ext_ball_radius - vertical_position;
    vec2 ellipse_radii = vec2(ext_ball_radius, ext_ball_radius);
    if(squish_distance > 0.0) {
        ellipse_radii = ellipse_radii + vec2(squish_distance / 1.75, -squish_distance);
    }

    // draw the circle, using fwidth and smoothstep for anti-aliasing
    vec2 norm_coords = gl_FragCoord.xy / vec2(min_dimension);
    float point_radius = length((norm_coords - circle_center) / ellipse_radii);

    float delta = fwidth(point_radius);
    float alpha = smoothstep(1.0 - delta, 1.0, point_radius);

    // darken the color based on distance from the shine point
    vec2 shine_center = circle_center + vec2(ext_shine_offset) * ellipse_radii;
    float shine_point_radius = length((norm_coords - shine_center) / ellipse_radii);
    float brightness = 0.9 - 0.15 * pow(shine_point_radius / ext_max_dist_from_shine, 2.0);
    fragColor = mix(vec4(g_red * vec3(brightness), 1.0), fragColor, alpha);

    // apply shine
    alpha = smoothstep(0.0, 0.15, shine_point_radius);
    fragColor = mix(g_white, fragColor, alpha);
}
