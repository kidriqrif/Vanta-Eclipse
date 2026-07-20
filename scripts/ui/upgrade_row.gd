class_name UpgradeRow
extends PanelContainer
## One row in the upgrade shop: name, effect, current level, and a buy button.
## The shop panel creates one row per UpgradeDefinition — this script never
## needs to know which upgrades exist.

var _definition: UpgradeDefinition

@onready var _name_label: Label = %NameLabel
@onready var _desc_label: Label = %DescLabel
@onready var _level_label: Label = %LevelLabel
@onready var _buy_button: Button = %BuyButton


## Called by the shop panel BEFORE this row enters the tree.
func setup(definition: UpgradeDefinition) -> void:
	_definition = definition


func _ready() -> void:
	_name_label.text = _definition.display_name
	_desc_label.text = _definition.description
	_buy_button.pressed.connect(_on_buy_pressed)
	# Affordability changes whenever essence changes; level changes on buy.
	EventBus.currency_changed.connect(_on_currency_changed)
	EventBus.upgrade_purchased.connect(_on_upgrade_purchased)
	_refresh()


func _on_buy_pressed() -> void:
	if UpgradeManager.buy(_definition.id):
		SettingsManager.vibrate(15)


func _on_currency_changed(currency: StringName, _balance: float) -> void:
	if currency == CurrencyManager.ESSENCE:
		_refresh()


func _on_upgrade_purchased(id: StringName, _new_level: int) -> void:
	if id == _definition.id:
		_refresh()


func _refresh() -> void:
	var level: int = UpgradeManager.get_level(_definition.id)
	var level_text: String = "Lv. %d" % level
	if level > 0:
		level_text += "  —  %s" % _definition.format_effect(level)
	if _definition.max_level > 0:
		level_text += "  (max %d)" % _definition.max_level
	_level_label.text = level_text

	if UpgradeManager.is_maxed(_definition.id):
		_buy_button.text = "MAX"
		_buy_button.icon = null
		_buy_button.disabled = true
		return
	_buy_button.text = NumberFormat.format(UpgradeManager.get_cost(_definition.id))
	_buy_button.disabled = not UpgradeManager.can_buy(_definition.id)
