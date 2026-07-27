extends Node
## MonetizationManager — opt-in ad offers, purchases, entitlements and cosmetics
## (autoload, after QuestManager).
##
## THE STANCE (GDD, non-negotiable): no mechanic is ever pay-gated. Every ad is
## offered and opt-in, never interstitial; every ad reward is a bonus on top of
## something already earned, never a gate on receiving it; declining is never
## punished. Offers are capped per day so "grind ads" is never optimal.
##
## DEVELOPMENT BUILD: while USE_STUB_PROVIDERS is true, nothing is charged and
## no real ad is shown — see scripts/monetization/stub_*.gd. Milestone 15 must
## implement the real providers, add receipt validation, and flip the flag.

## TODO(Milestone 15): set false once AdMobProvider and PlayBillingProvider
## exist. The Shop shows a development banner while this is true.
const USE_STUB_PROVIDERS: bool = true

const PLACEMENT_DIR: String = "res://data/ads"
const PRODUCT_DIR: String = "res://data/products"
const COSMETIC_DIR: String = "res://data/cosmetics"
const SECONDS_PER_DAY: int = 86400
const DEFAULT_COSMETIC: StringName = &"trail_void"

var _placements: Array[AdPlacementDefinition] = []
var _placements_by_id: Dictionary = {}
var _products: Array[ShopProductDefinition] = []
var _products_by_id: Dictionary = {}
var _cosmetics: Array[CosmeticDefinition] = []
var _cosmetics_by_id: Dictionary = {}

## placement id -> offers used today; keyed to the UTC day like the Journal's
## dailies, and reset only when the day strictly advances.
var _ad_uses: Dictionary = {}
var _ad_day: int = 0
## product id -> true, for ENTITLEMENT products only.
var _entitlements: Dictionary = {}
var _owned_cosmetics: Dictionary = {}
var _equipped_cosmetic: StringName = DEFAULT_COSMETIC
## True while an offer or purchase is in flight, so a double-tap cannot run two.
var _busy: bool = false

var _ads: AdProvider
var _billing: BillingProvider


func _ready() -> void:
	_load_all()
	_ads = StubAdProvider.new(get_tree()) if USE_STUB_PROVIDERS else AdProvider.new()
	_billing = StubBillingProvider.new(get_tree()) if USE_STUB_PROVIDERS \
		else BillingProvider.new()
	SaveManager.register_saveable("shop", self)
	EventBus.game_loaded.connect(_on_game_loaded)


func _load_all() -> void:
	for definition: Resource in _load_dir(PLACEMENT_DIR):
		_placements.append(definition)
		_placements_by_id[definition.id] = definition
	for definition: Resource in _load_dir(PRODUCT_DIR):
		_products.append(definition)
		_products_by_id[definition.id] = definition
	for definition: Resource in _load_dir(COSMETIC_DIR):
		_cosmetics.append(definition)
		_cosmetics_by_id[definition.id] = definition
	_placements.sort_custom(func(a: Resource, b: Resource) -> bool:
		return a.sort_order < b.sort_order)
	_products.sort_custom(func(a: Resource, b: Resource) -> bool:
		return a.sort_order < b.sort_order)
	_cosmetics.sort_custom(func(a: Resource, b: Resource) -> bool:
		return a.sort_order < b.sort_order)


func _load_dir(directory: String) -> Array[Resource]:
	var out: Array[Resource] = []
	for file_name: String in DirAccess.get_files_at(directory):
		# An exported build ships .tres as .tres.remap.
		var clean: String = file_name.trim_suffix(".remap")
		if not clean.ends_with(".tres"):
			continue
		var definition: Resource = load("%s/%s" % [directory, clean])
		if definition == null:
			push_error("MonetizationManager: could not load %s" % clean)
			continue
		out.append(definition)
	return out


# --- Save contract -----------------------------------------------------------


func get_save_data() -> Dictionary:
	var uses: Dictionary = {}
	for id: StringName in _ad_uses:
		uses[String(id)] = _ad_uses[id]
	var entitlements: Array[String] = []
	for id: StringName in _entitlements:
		entitlements.append(String(id))
	var cosmetics: Array[String] = []
	for id: StringName in _owned_cosmetics:
		cosmetics.append(String(id))
	return {
		"ad_uses": uses,
		"ad_day": _ad_day,
		"entitlements": entitlements,
		"owned_cosmetics": cosmetics,
		"equipped_cosmetic": String(_equipped_cosmetic),
	}


func load_save_data(data: Dictionary) -> void:
	_ad_uses.clear()
	for key: String in data.get("ad_uses", {}):
		_ad_uses[StringName(key)] = int(data["ad_uses"][key])
	_ad_day = maxi(0, int(data.get("ad_day", 0)))
	_entitlements.clear()
	for raw: String in data.get("entitlements", []):
		var product: StringName = StringName(raw)
		if _products_by_id.has(product):
			_entitlements[product] = true
	_owned_cosmetics.clear()
	for raw: String in data.get("owned_cosmetics", []):
		var cosmetic: StringName = StringName(raw)
		if _cosmetics_by_id.has(cosmetic):
			_owned_cosmetics[cosmetic] = true
	var equipped: StringName = StringName(data.get("equipped_cosmetic", ""))
	_equipped_cosmetic = equipped if _cosmetics_by_id.has(equipped) else DEFAULT_COSMETIC


# --- Reads --------------------------------------------------------------------


func get_placements() -> Array[AdPlacementDefinition]:
	return _placements


func get_placement(id: StringName) -> AdPlacementDefinition:
	return _placements_by_id.get(id)


func get_products() -> Array[ShopProductDefinition]:
	return _products


func get_cosmetics() -> Array[CosmeticDefinition]:
	return _cosmetics


func get_cosmetic(id: StringName) -> CosmeticDefinition:
	return _cosmetics_by_id.get(id)


func owns_cosmetic(id: StringName) -> bool:
	return id == DEFAULT_COSMETIC or _owned_cosmetics.has(id)


func get_equipped_cosmetic() -> CosmeticDefinition:
	var cosmetic: CosmeticDefinition = _cosmetics_by_id.get(_equipped_cosmetic)
	return cosmetic if cosmetic != null else _cosmetics_by_id.get(DEFAULT_COSMETIC)


func get_equipped_cosmetic_id() -> StringName:
	return _equipped_cosmetic


func has_entitlement(id: StringName) -> bool:
	return _entitlements.has(id)


## Owning remove_ads turns every offer into a free, instant one-tap bonus. It
## removes the chore, never the benefit — and the daily caps still apply, so it
## cannot break the economy.
func ads_removed() -> bool:
	return has_entitlement(&"remove_ads")


func offers_left(id: StringName) -> int:
	_roll_ad_day()
	var placement: AdPlacementDefinition = _placements_by_id.get(id)
	if placement == null:
		return 0
	return maxi(0, placement.daily_cap - int(_ad_uses.get(id, 0)))


func can_offer(id: StringName) -> bool:
	return not _busy and offers_left(id) > 0


func is_busy() -> bool:
	return _busy


# --- Offers -------------------------------------------------------------------


## Run an opt-in offer. `pending_amount` is only used by MULTIPLY_PENDING (the
## offline doubler). Returns the amount granted, or 0.0 if declined/unavailable.
##
## The caller must already have granted the base reward: an offer is always a
## bonus on top, never a gate on receiving it.
func run_offer(id: StringName, pending_amount: float = 0.0) -> float:
	if not can_offer(id):
		return 0.0
	var placement: AdPlacementDefinition = _placements_by_id.get(id)
	if placement == null:
		return 0.0
	_busy = true
	# remove_ads skips the watch entirely; everyone else watches.
	var watched: bool = true if ads_removed() else await _ads.request_rewarded(id)
	if not watched:
		_busy = false
		return 0.0
	# Count the use only on a completed watch, so a failed or dismissed ad
	# never burns one of the player's daily offers.
	_ad_uses[id] = int(_ad_uses.get(id, 0)) + 1
	var granted: float = _grant(placement, pending_amount)
	SaveManager.save_game()
	_busy = false
	EventBus.ad_reward_granted.emit(id, granted)
	return granted


func _grant(placement: AdPlacementDefinition, pending_amount: float) -> float:
	match placement.reward_kind:
		AdPlacementDefinition.RewardKind.ARCADE_TOKENS:
			MinigameManager.grant_token(int(placement.reward_amount))
			return placement.reward_amount
		AdPlacementDefinition.RewardKind.MULTIPLY_PENDING:
			var bonus: float = floor(maxf(0.0, pending_amount) * placement.reward_amount)
			if bonus <= 0.0:
				return 0.0
			CurrencyManager.add(CurrencyManager.ESSENCE, bonus)
			EventBus.essence_earned.emit(bonus, &"ad_bonus")
			return bonus
		_:
			var amount: float = maxf(1.0, floor(
				IdleManager.get_live_essence_rate() * placement.reward_amount
			))
			CurrencyManager.add(CurrencyManager.ESSENCE, amount)
			EventBus.essence_earned.emit(amount, &"ad_bonus")
			return amount


# --- Purchases ----------------------------------------------------------------


## Buy a product. Returns true on success. Refuses re-buying an entitlement, so
## a double-tap is safe.
func purchase(id: StringName) -> bool:
	var product: ShopProductDefinition = _products_by_id.get(id)
	if product == null or _busy:
		return false
	if product.kind == ShopProductDefinition.Kind.ENTITLEMENT and _entitlements.has(id):
		return false
	_busy = true
	var bought: bool = await _billing.purchase(id)
	if not bought:
		_busy = false
		return false
	if product.kind == ShopProductDefinition.Kind.ENTITLEMENT:
		_entitlements[id] = true
	if product.crystals > 0.0:
		CurrencyManager.add(CurrencyManager.VOID_CRYSTALS, product.crystals)
	if product.shards > 0.0:
		CurrencyManager.add(CurrencyManager.ASTRAL_SHARDS, product.shards)
	if product.tokens > 0:
		MinigameManager.grant_token(product.tokens)
	if product.cosmetic_id != &"" and _cosmetics_by_id.has(product.cosmetic_id):
		_owned_cosmetics[product.cosmetic_id] = true
	SaveManager.save_game()
	_busy = false
	EventBus.purchase_completed.emit(id)
	return true


# --- Cosmetics ----------------------------------------------------------------


## Buy a cosmetic with Astral Shards. Returns true on success.
func buy_cosmetic(id: StringName) -> bool:
	var cosmetic: CosmeticDefinition = _cosmetics_by_id.get(id)
	if cosmetic == null or owns_cosmetic(id):
		return false
	if not CurrencyManager.try_spend(CurrencyManager.ASTRAL_SHARDS, cosmetic.shard_price):
		return false
	_owned_cosmetics[id] = true
	SaveManager.save_game()
	return true


func equip_cosmetic(id: StringName) -> void:
	if not owns_cosmetic(id):
		return
	_equipped_cosmetic = id
	SaveManager.save_game()
	EventBus.cosmetic_equipped.emit(id)


## Purchases and cosmetics are account-level, never run-level.
func reset_for_prestige() -> void:
	pass


# --- Internals ----------------------------------------------------------------


## Reset the daily offer counts when the UTC day strictly advances — the same
## rule the Journal's dailies use, so a backwards clock cannot mint offers.
func _roll_ad_day() -> void:
	var today: int = int(Time.get_unix_time_from_system()) / SECONDS_PER_DAY
	if today <= _ad_day:
		return
	_ad_uses.clear()
	_ad_day = today


func _on_game_loaded(_is_new_game: bool) -> void:
	_roll_ad_day()
	if not _owned_cosmetics.has(DEFAULT_COSMETIC):
		_owned_cosmetics[DEFAULT_COSMETIC] = true
