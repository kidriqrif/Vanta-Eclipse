extends Node
## DELIBERATELY BROKEN. Do not "fix" this file.
##
## The positive control for logic_harness.gd's _check_scripts_parse(). That
## check exists because all four Arcade minigames once shipped with exactly
## this defect and a 14-stage sweep called it green — and the check itself was
## written wrong TWICE before it worked, passing both times against a defect it
## could not see.
##
## A const initialiser must be a constant expression. A static call is not one,
## so this file cannot compile, and the check must say so on every run.
##
## It lives under tools/ because the check walks res://scripts, which must stay
## clean; nothing here is exported (see export_presets.cfg's exclude_filter).
const NOT_A_CONSTANT_EXPRESSION: Color = UIPalette.ink()
