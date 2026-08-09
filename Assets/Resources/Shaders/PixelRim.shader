// Ported from effects/pixel_sprite.gdshader
//
// A hard one-texel outline in the creature's own colour. Nothing else.
//
// Replaces a shader that derived a fake surface normal from the alpha channel
// and lit it with a diffuse term, a specular highlight and a grey ambient. That
// was the right shader for 512px vector art built out of smooth gradients. On a
// 64px sprite scaled eight times it sampled a seven-texel bevel radius and a
// 0.42 grey ambient, which is precisely why the first pixel-art render came out
// as a blurred grey smudge: the shader was averaging away the pixels and then
// desaturating what survived.
//
// Pixel art carries its shading IN the pixels — the lit/mid/shadow ramp is
// painted by hand in make_sprites.py — so the only thing a shader can usefully
// add is the outline that keeps the silhouette off the background.
//
// Written against the UI pipeline, not the sprite one: the enemy is a
// UnityEngine.UI.Image inside the screen's canvas, so it needs the stencil,
// clip-rect and vertex-colour plumbing every Canvas material carries. Dropping
// any of that makes the creature ignore masks and Canvas group alpha.
Shader "VantaEclipse/PixelRim"
{
    Properties
    {
        [PerRendererData] _MainTex ("Sprite Texture", 2D) = "white" {}
        _Color ("Tint", Color) = (1,1,1,1)

        // Retinted per enemy from EnemyDefinition.glowColor. Kept under the
        // original name so the call site did not have to change.
        _RimColor ("Rim Colour", Color) = (0.91, 0.20, 0.24, 1)
        _RimStrength ("Rim Strength", Range(0,1)) = 0.85

        _StencilComp ("Stencil Comparison", Float) = 8
        _Stencil ("Stencil ID", Float) = 0
        _StencilOp ("Stencil Operation", Float) = 0
        _StencilWriteMask ("Stencil Write Mask", Float) = 255
        _StencilReadMask ("Stencil Read Mask", Float) = 255
        _ColorMask ("Color Mask", Float) = 15

        [Toggle(UNITY_UI_ALPHACLIP)] _UseUIAlphaClip ("Use Alpha Clip", Float) = 0
    }

    SubShader
    {
        Tags
        {
            "Queue" = "Transparent"
            "IgnoreProjector" = "True"
            "RenderType" = "Transparent"
            "PreviewType" = "Plane"
            "CanUseSpriteAtlas" = "True"
        }

        Stencil
        {
            Ref [_Stencil]
            Comp [_StencilComp]
            Pass [_StencilOp]
            ReadMask [_StencilReadMask]
            WriteMask [_StencilWriteMask]
        }

        Cull Off
        Lighting Off
        ZWrite Off
        ZTest [unity_GUIZTestMode]
        Blend SrcAlpha OneMinusSrcAlpha
        ColorMask [_ColorMask]

        Pass
        {
            Name "Default"
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 2.0

            #include "UnityCG.cginc"
            #include "UnityUI.cginc"

            #pragma multi_compile_local _ UNITY_UI_CLIP_RECT
            #pragma multi_compile_local _ UNITY_UI_ALPHACLIP

            struct appdata_t
            {
                float4 vertex   : POSITION;
                float4 color    : COLOR;
                float2 texcoord : TEXCOORD0;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };

            struct v2f
            {
                float4 vertex        : SV_POSITION;
                fixed4 color         : COLOR;
                float2 texcoord      : TEXCOORD0;
                float4 worldPosition : TEXCOORD1;
                UNITY_VERTEX_OUTPUT_STEREO
            };

            sampler2D _MainTex;
            // xy is 1/width, 1/height — Godot's TEXTURE_PIXEL_SIZE by another
            // name. It is what keeps the halo exactly one SOURCE pixel thick no
            // matter how far the sprite is scaled up, which is what holds it on
            // the same grid as the art instead of shimmering.
            float4 _MainTex_TexelSize;
            fixed4 _Color;
            fixed4 _TextureSampleAdd;
            float4 _ClipRect;
            fixed4 _RimColor;
            float _RimStrength;

            v2f vert(appdata_t v)
            {
                v2f OUT;
                UNITY_SETUP_INSTANCE_ID(v);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(OUT);
                OUT.worldPosition = v.vertex;
                OUT.vertex = UnityObjectToClipPos(OUT.worldPosition);
                OUT.texcoord = v.texcoord;
                OUT.color = v.color * _Color;
                return OUT;
            }

            fixed4 frag(v2f IN) : SV_Target
            {
                fixed4 texel = tex2D(_MainTex, IN.texcoord) + _TextureSampleAdd;
                fixed4 result;

                if (texel.a > 0.5)
                {
                    result = texel * IN.color;
                }
                else
                {
                    float near = 0.0;
                    near = max(near, tex2D(_MainTex,
                        IN.texcoord + float2(_MainTex_TexelSize.x, 0.0)).a);
                    near = max(near, tex2D(_MainTex,
                        IN.texcoord - float2(_MainTex_TexelSize.x, 0.0)).a);
                    near = max(near, tex2D(_MainTex,
                        IN.texcoord + float2(0.0, _MainTex_TexelSize.y)).a);
                    near = max(near, tex2D(_MainTex,
                        IN.texcoord - float2(0.0, _MainTex_TexelSize.y)).a);
                    result = fixed4(_RimColor.rgb,
                        step(0.5, near) * _RimStrength * IN.color.a);
                }

                #ifdef UNITY_UI_CLIP_RECT
                result.a *= UnityGet2DClipping(IN.worldPosition.xy, _ClipRect);
                #endif

                #ifdef UNITY_UI_ALPHACLIP
                clip(result.a - 0.001);
                #endif

                return result;
            }
            ENDCG
        }
    }
}
