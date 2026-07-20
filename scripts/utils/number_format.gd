class_name NumberFormat
extends RefCounted
## Static helpers for displaying the huge numbers incremental games produce.
## 1234 -> "1.23K", 5600000 -> "5.6M", and so on.
##
## TODO(Milestone 8): switch to scientific notation once values pass the
## last suffix (prestige-level numbers).

const SUFFIXES: Array[String] = [
	"", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc",
]


static func format(value: float) -> String:
	var negative: bool = value < 0.0
	var v: float = absf(value)
	if v < 1000.0:
		var whole: String = str(int(round(v)))
		return "-" + whole if negative else whole
	var tier: int = int(floor(log(v) / log(1000.0)))
	tier = mini(tier, SUFFIXES.size() - 1)
	var scaled: float = v / pow(1000.0, tier)
	var decimals: int = 2 if scaled < 10.0 else (1 if scaled < 100.0 else 0)
	var text: String = String.num(scaled, decimals) + SUFFIXES[tier]
	return "-" + text if negative else text
