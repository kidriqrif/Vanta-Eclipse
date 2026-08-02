shader_type canvas_item;

// Lights a flat 2D sprite as though it had volume, with no extra art.
//
// The sprites are SVGs: clean shapes with a crisp alpha silhouette and no
// shading information of their own. That silhouette is the only 3D data we
// have, so this derives a surface normal from the ALPHA CHANNEL — the alpha
// gradient points into the shape, so its negation is the direction the
// surface faces. Sampling that gradient at a radius of several pixels turns
// a hard edge into a rounded bevel, which is what reads as curvature.
//
// The result is a real normal, not a filter: the highlight, the form shadow,
// and the rim all move correctly when light_direction changes, and every
// sprite in the project gets it without authoring a single normal map.
//
// Mobile budget: 8 texture taps plus arithmetic, no branches, no loops, one
// pass. Sits alongside the nebula backdrop's cost comfortably. Deliberately
// unrolled — no arrays — because nothing in this project can compile-test a
// shader, so it only uses constructs that cannot surprise the parser.

// Direction the light travels FROM, in UV space (+y is DOWN on screen, so a
// negative y is light from above). Height lifts it off the plane: lower means
// a raking light with long shadows, higher means flatter and more frontal.
uniform vec2 light_direction = vec2(-0.55, -0.80);
uniform float light_height : hint_range(0.15, 2.0) = 0.65;
uniform vec3 light_color : source_color = vec3(1.00, 0.96, 0.92);
uniform vec3 ambient_color : source_color = vec3(0.42, 0.42, 0.46);

// How far out the alpha gradient is sampled, in texels. This is the single
// most important knob: it is the width of the bevel, so it decides whether
// the form reads as a sharp chamfer or a soft round mass.
uniform float bevel_radius : hint_range(0.5, 24.0) = 7.0;
// Scales the derived slope. Higher tilts the normals harder at the edge and
// exaggerates the sense of thickness.
uniform float depth_strength : hint_range(0.0, 6.0) = 2.40;
uniform float diffuse_strength : hint_range(0.0, 2.0) = 1.00;

// Rim: the silhouette catching light. This is the term that most sells a
// curved surface, so it is keyed off the normal rather than faked from UV.
uniform vec3 rim_color : source_color = vec3(1.00, 0.231, 0.188);
uniform float rim_strength : hint_range(0.0, 2.0) = 0.55;
uniform float rim_power : hint_range(0.5, 8.0) = 2.60;

uniform float specular_strength : hint_range(0.0, 2.0) = 0.35;
uniform float shininess : hint_range(2.0, 64.0) = 18.0;

void fragment() {
	vec2 texel = TEXTURE_PIXEL_SIZE * bevel_radius;

	// Diagonal taps sit on the same ring as the axial ones, so they are
	// offset by 1/sqrt(2) and weighted by the same factor when summed.
	float diag = 0.70710678;

	float a_r = texture(TEXTURE, UV + vec2(texel.x, 0.0)).a;
	float a_l = texture(TEXTURE, UV + vec2(-texel.x, 0.0)).a;
	float a_d = texture(TEXTURE, UV + vec2(0.0, texel.y)).a;
	float a_u = texture(TEXTURE, UV + vec2(0.0, -texel.y)).a;
	float a_rd = texture(TEXTURE, UV + vec2(texel.x * diag, texel.y * diag)).a;
	float a_ld = texture(TEXTURE, UV + vec2(-texel.x * diag, texel.y * diag)).a;
	float a_ru = texture(TEXTURE, UV + vec2(texel.x * diag, -texel.y * diag)).a;
	float a_lu = texture(TEXTURE, UV + vec2(-texel.x * diag, -texel.y * diag)).a;

	// Sobel-style gradient: alpha increases toward the interior of the shape.
	vec2 gradient = vec2(
		(a_r - a_l) + diag * ((a_rd - a_ld) + (a_ru - a_lu)),
		(a_d - a_u) + diag * ((a_rd - a_ru) + (a_ld - a_lu))
	);

	// Negated because the surface faces OUT of the shape, away from the
	// direction alpha grows. z is 1 so a flat interior stays facing the
	// viewer and only the bevel band tilts.
	vec3 normal = normalize(vec3(-gradient * depth_strength, 1.0));
	vec3 light = normalize(vec3(light_direction, light_height));

	float lambert = max(dot(normal, light), 0.0);
	vec3 shade = ambient_color + light_color * lambert * diffuse_strength;

	// normal.z falls off toward the silhouette, so this is a genuine
	// curvature term, not a screen-space outline that would ring uniformly.
	float rim = pow(1.0 - clamp(normal.z, 0.0, 1.0), rim_power) * rim_strength;

	// Blinn-Phong against a viewer straight down the +z axis.
	vec3 half_vector = normalize(light + vec3(0.0, 0.0, 1.0));
	float specular = pow(max(dot(normal, half_vector), 0.0), shininess) * specular_strength;

	// Modify COLOR in place instead of rebuilding it from TEXTURE. Whatever
	// Godot put there already carries the node's modulate, so enemy_view.gd's
	// hit FLASH_COLOR, the death fade, and every tween on modulate keep
	// working exactly as before. Additive terms are masked by alpha so
	// nothing glows outside the silhouette.
	COLOR.rgb = COLOR.rgb * shade + (rim_color * rim + light_color * specular) * COLOR.a;
}
