shader_type canvas_item;

// Animated void-nebula backdrop: slowly drifting fractal fog, twinkling
// stars, and a vignette. Pure math — no textures — so it costs almost no
// memory and scales to any resolution. Tuned for mobile: 4 noise octaves.

uniform vec3 deep_color : source_color = vec3(0.016, 0.008, 0.035);
uniform vec3 nebula_color : source_color = vec3(0.10, 0.05, 0.22);
uniform vec3 accent_color : source_color = vec3(0.36, 0.19, 0.66);
uniform float drift_speed : hint_range(0.0, 0.2) = 0.018;
uniform float star_density : hint_range(0.9, 1.0) = 0.994;
uniform float nebula_strength : hint_range(0.0, 1.0) = 1.0;

float hash21(vec2 p) {
	p = fract(p * vec2(234.34, 435.345));
	p += dot(p, p + 34.23);
	return fract(p.x * p.y);
}

float value_noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	float a = hash21(i);
	float b = hash21(i + vec2(1.0, 0.0));
	float c = hash21(i + vec2(0.0, 1.0));
	float d = hash21(i + vec2(1.0, 1.0));
	return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
	float value = 0.0;
	float amplitude = 0.5;
	for (int i = 0; i < 4; i++) {
		value += amplitude * value_noise(p);
		p *= 2.03;
		amplitude *= 0.5;
	}
	return value;
}

void fragment() {
	vec2 uv = UV;
	// Portrait-friendly stretch so the fog doesn't look squashed.
	vec2 p = uv * vec2(3.0, 5.2);
	float t = TIME * drift_speed;

	float n = fbm(p + vec2(t * 3.0, t));
	n += 0.55 * fbm(p * 2.1 - vec2(t * 2.0, t * 4.0));
	n /= 1.55;

	vec3 col = mix(deep_color, nebula_color, smoothstep(0.32, 0.78, n) * nebula_strength);
	col = mix(col, accent_color, smoothstep(0.70, 0.96, n) * 0.32 * nebula_strength);

	// Sparse twinkling stars on a jittered grid.
	vec2 grid = uv * vec2(54.0, 96.0);
	vec2 cell = floor(grid);
	float pick = hash21(cell);
	if (pick > star_density) {
		vec2 jitter = vec2(hash21(cell + 11.0), hash21(cell + 37.0)) * 0.6 - 0.3;
		float dist = length(fract(grid) - 0.5 - jitter);
		float twinkle = 0.5 + 0.5 * sin(TIME * (1.0 + pick * 4.0) + pick * 40.0);
		col += vec3(0.82, 0.78, 1.0) * smoothstep(0.16, 0.0, dist) * twinkle * 0.55;
	}

	// Vignette: darken the edges so UI in the center pops.
	float vig = smoothstep(1.15, 0.35, length(uv - 0.5) * 1.65);
	col *= mix(0.5, 1.0, vig);

	COLOR = vec4(col, 1.0);
}
