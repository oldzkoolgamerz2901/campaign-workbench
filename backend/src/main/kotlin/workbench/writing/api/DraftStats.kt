package workbench.writing.api

/** Immutable authored values; no rule calculation or HTML interpretation. */
data class DraftStats(
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
    val abilities: Map<String, DraftAbility> = emptyMap(),
    val sections: List<DraftStatSection> = emptyList()
) {
    fun valid(): Boolean {
        val values = listOf(subtitle, ac, hp, speed, initiative, cr, skills, vulnerabilities, resistances, immunities, gear, senses, languages) + abilities.values.flatMap { listOf(it.score, it.modifier, it.save) } +
            sections.flatMap { listOf(it.title) + it.entries.flatMap { e -> listOf(e.name, e.text) + (e.spellcasting?.let { listOf(it.ability, it.dc, it.spells) } ?: emptyList()) } }
        return abilities.keys.all { it in setOf("STR", "DEX", "CON", "INT", "WIS", "CHA") } && sections.size <= 32 &&
            sections.sumOf { it.entries.size } <= 128 && values.all { it.toByteArray(Charsets.UTF_8).size <= 16384 } &&
            values.sumOf { it.toByteArray(Charsets.UTF_8).size.toLong() } <= 65536 &&
            sections.all { it.entries.all { e -> e.spellcasting == null || (e.name.isEmpty() && e.text.isEmpty()) } }
    }
}
data class DraftAbility(val score: String = "", val modifier: String = "", val save: String = "")
data class DraftStatSection(val title: String = "", val entries: List<DraftStatEntry> = emptyList())
data class DraftStatEntry(val name: String = "", val text: String = "", val spellcasting: DraftSpellcasting? = null)
data class DraftSpellcasting(val ability: String = "", val dc: String = "", val spells: String = "")
