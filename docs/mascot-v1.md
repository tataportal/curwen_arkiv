# Pixel mascot v1

Generated with the built-in image_gen tool, using the user's goat-man image as reference. The original selected PNG is stored at `public/mascot/chivo-pixel-v1.png`. It is included in the Pages export and loaded under its configured base path.

The generator returned an opaque background after an extraction retry. The component retains the raster intact and uses an SVG clipping path to display only the character silhouette. No transparent PNG is claimed.

The small companion sits beside the volume control. Idle bob/tilt and click squash/hop are CSS animations. Clicks cycle verbatim through El todo good, Mi amorcito otaku, Pelao chivo, El 3 polvos. Speech is displayed as text bubbles, not synthesized voice. Timers are replaced on successive clicks and cleaned on unmount. Motion pauses during previews and respects prefers-reduced-motion; expanded video hides the mascot.

Generation prompt:

Use case: style-transfer. Asset type: transparent 8-bit website mascot sprite. Reference image: attached bald man/goat head; preserve the recognizable bald shiny head, dark round glasses, tan skin, small dark moustache, pointed grey goatee, two curved goat horns and sideways goat ears, friendly cheeky expression. Redraw as a MUCH simpler authentic 8-bit videogame floating head sprite, coarse 48x48 logical pixel grid upscaled with nearest-neighbor hard square edges, restricted 12-color palette, chunky dark outline, deliberate pixel clusters, readable at 72px. One single centered front-facing head only, full horns/ears/beard uncut, occupies 85% of square canvas. True transparent alpha background; absolutely NO blue background, NO checkerboard baked in, NO text, NO border, NO gradients, NO shadows outside the sprite. This is a single clean sprite to be animated in CSS, not a sheet and not a website mockup. Preserve character identity from reference while making a cute compact retro sprite.

Extraction retry: Preserve the character pixel artwork and remove the opaque background; real alpha requested. The returned output remained RGB, so its display is clipped by the component.
