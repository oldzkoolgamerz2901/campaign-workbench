package workbench.preparation.application

import workbench.preparation.api.*
import workbench.sources.api.*

internal fun PreparedStats.layoutStats() = LayoutStats(
    subtitle, ac, hp, speed, initiative, cr, skills, vulnerabilities, resistances, immunities, gear, senses, languages,
    abilities.mapValues { (_, a) -> LayoutAbility(a.score, a.modifier, a.save) },
    sections.map { s -> LayoutStatSection(s.title, s.entries.map { e -> LayoutStatEntry(e.name, e.text,
        e.spellcasting?.let { LayoutSpellcasting(it.ability, it.dc, it.spells) }) }) }
)

internal fun workbench.writing.api.DraftStats.preparedStats() = PreparedStats(
    subtitle, ac, hp, speed, initiative, cr, skills, vulnerabilities, resistances, immunities, gear, senses, languages,
    abilities.mapValues { (_, a) -> PreparedAbility(a.score, a.modifier, a.save) },
    sections.map { s -> PreparedStatSection(s.title, s.entries.map { e -> PreparedStatEntry(e.name, e.text,
        e.spellcasting?.let { PreparedSpellcasting(it.ability, it.dc, it.spells) }) }) }
)
