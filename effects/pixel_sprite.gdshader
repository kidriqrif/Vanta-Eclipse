shader_type canvas_item;
// A hard one-texel outline in the creature's own colour. Nothing else.
//
// Replaces dimensional_sprite.gdshader, which derived a fake surface normal
// from the alpha channel and lit it with a diffuse term, a specular highlight
// and a grey ambient. That was the right shader for 512px vector art built out
// of smooth gradients. On a 64px sprite scaled eight times it sampled a
// seven-texel bevel radius and a 0.42 grey ambient, which is precisely why the
// first pixel-art render came out as a blurred grey smudge: the shader was
// averaging away the pixels and then desaturating what survived.
//
// Pixel art carries its shading IN the pixels — the lit/mid/shadow ramp is
// painted by hand in make_sprites.py — so the only thing a shader can usefully
// add is the outline that keeps the silhouette off the background.

// Retinted per enemy from EnemyDefinition.glow_color. Kept under the original
// uniform name so enemy_view.gd's call site did not have to change.
uniform vec3 rim_color : source_color = vec3(0.91, 0.20, 0.24);
uniform float rim_strength : hint_range(0.0, 1.0) = 0.85;

void fragment() {
	vec4 texel = texture(TEXTURE, UV);
	if (texel.a > 0.5) {
		COLOR = texel * COLOR;
	} else {
		// One TEXEL, not one screen pixel. TEXTURE_PIXEL_SIZE is in UV units
		// of the source image, so the halo stays exactly one source pixel
		// thick no matter how far the sprite is scaled up — which is what
		// keeps it on the same grid as the art instead of shimmering.
		float near = 0.0;
		near = max(near, texture(TEXTURE, UV + vec2(TEXTURE_PIXEL_SIZE.x, 0.0)).a);
		near = max(near, texture(TEXTURE, UV - vec2(TEXTURE_PIXEL_SIZE.x, 0.0)).a);
		near = max(near, texture(TEXTURE, UV + vec2(0.0, TEXTURE_PIXEL_SIZE.y)).a);
		near = max(near, texture(TEXTURE, UV - vec2(0.0, TEXTURE_PIXEL_SIZE.y)).a);
		COLOR = vec4(rim_color, step(0.5, near) * rim_strength * COLOR.a);
	}
}
