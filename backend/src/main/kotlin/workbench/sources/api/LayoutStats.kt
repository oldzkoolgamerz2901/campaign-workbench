package workbench.sources.api

/** Immutable authored values; no rule calculation or HTML interpretation. */
data class LayoutStats(
    val subtitle: String = "",
    val ac: String = "",
    val hp: String = "",
    val speed: String = "",
    val initiative: String = "",
    val cr: String = "",
    val skills: String = "",
    val vulnerabilities: String = "",
    val resistances: String = "",
    val immunities: String = "",
    val gear: String = "",
    val senses: String = "",
    val languages: String = "",
    val abilities: Map<String, LayoutAbility> = emptyMap(),
    val sections: List<LayoutStatSection> = emptyList()
) {
    fun hasContent(): Boolean = listOf(subtitle, ac, hp, speed, initiative, cr, skills, vulnerabilities,
        resistances, immunities, gear, senses, languages).any { it.isNotBlank() } ||
        abilities.values.any { listOf(it.score, it.modifier, it.save).any(String::isNotBlank) } ||
        sections.any { s -> s.entries.any { e -> e.name.isNotBlank() || e.text.isNotBlank() ||
            e.spellcasting?.let { listOf(it.ability, it.dc, it.spells).any(String::isNotBlank) } == true } }

    fun valid(): Boolean {
        val values = listOf(subtitle, ac, hp, speed, initiative, cr, skills, vulnerabilities, resistances, immunities, gear, senses, languages) + abilities.values.flatMap { listOf(it.score, it.modifier, it.save) } +
            sections.flatMap { listOf(it.title) + it.entries.flatMap { e -> listOf(e.name, e.text) + (e.spellcasting?.let { listOf(it.ability, it.dc, it.spells) } ?: emptyList()) } }
        return abilities.keys.all { it in setOf("STR", "DEX", "CON", "INT", "WIS", "CHA") } && sections.size <= 32 &&
            sections.sumOf { it.entries.size } <= 128 && values.all { it.toByteArray(Charsets.UTF_8).size <= 16384 } &&
            values.sumOf { it.toByteArray(Charsets.UTF_8).size.toLong() } <= 65536 &&
            sections.all { it.entries.all { e -> e.spellcasting == null || (e.name.isEmpty() && e.text.isEmpty()) } }
    }
}
data class LayoutAbility(val score: String = "", val modifier: String = "", val save: String = "")
data class LayoutStatSection(val title: String = "", val entries: List<LayoutStatEntry> = emptyList())
data class LayoutStatEntry(val name: String = "", val text: String = "", val spellcasting: LayoutSpellcasting? = null)
data class LayoutSpellcasting(val ability: String = "", val dc: String = "", val spells: String = "")
